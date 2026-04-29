import { NextResponse } from "next/server";
import { initDb, sql } from "@/lib/db";
import { requireAdmin, requireSession, HttpError } from "@/lib/auth";
import { expandRecurrence } from "@/lib/recurrence";
import type { EventRecord, RecurrenceRule } from "@/lib/types";

export const dynamic = "force-dynamic";

function rowToEvent(r: any): EventRecord {
  return {
    id: r.id,
    calendar: r.calendar,
    title: r.title,
    description: r.description || "",
    location: r.location || "",
    url: r.url || "",
    organizer: r.organizer || "",
    organizerEmail: r.organizer_email || "",
    startsAt: new Date(r.starts_at).toISOString(),
    endsAt: r.ends_at ? new Date(r.ends_at).toISOString() : null,
    timezone: r.timezone || "UTC",
    allDay: !!r.all_day,
    legendId: r.legend_id || null,
    recurrenceGroupId: r.recurrence_group_id || null,
    createdBy: r.created_by || null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function GET() {
  try {
    await initDb();
    const session = await requireSession();
    const calendars = session.calendars;
    if (calendars.length === 0) return NextResponse.json({ events: [] });

    // Admins see everything; members see only their own calendars
    let rows;
    if (session.isAdmin) {
      const result = await sql`SELECT * FROM events ORDER BY starts_at ASC`;
      rows = result.rows;
    } else {
      // We can have 1 or 2 calendar values; build query accordingly
      if (calendars.length === 1) {
        const cal = calendars[0];
        const result = await sql`
          SELECT * FROM events WHERE calendar = ${cal} ORDER BY starts_at ASC
        `;
        rows = result.rows;
      } else {
        const result = await sql`
          SELECT * FROM events
          WHERE calendar = ANY(${calendars as any})
          ORDER BY starts_at ASC
        `;
        rows = result.rows;
      }
    }

    return NextResponse.json({ events: rows.map(rowToEvent) });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[events GET]", err);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDb();
    const session = await requireAdmin();
    const body = await req.json().catch(() => ({}));

    const calendar = body.calendar;
    const title = String(body.title || "").trim();
    const startsAt = body.startsAt;
    const endsAt = body.endsAt || null;
    const timezone = String(body.timezone || "UTC");
    const allDay = !!body.allDay;
    const description = String(body.description || "");
    const location = String(body.location || "");
    const url = String(body.url || "");
    const organizer = String(body.organizer || "");
    const organizerEmail = String(body.organizerEmail || "");
    const legendId = body.legendId || null;
    const recurrenceRule: RecurrenceRule | null = body.recurrenceRule || null;

    if (calendar !== "elites" && calendar !== "plats") {
      return NextResponse.json(
        { error: "Calendar must be 'elites' or 'plats'" },
        { status: 400 }
      );
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!startsAt || isNaN(new Date(startsAt).getTime())) {
      return NextResponse.json({ error: "Valid start time is required" }, { status: 400 });
    }
    if (endsAt && isNaN(new Date(endsAt).getTime())) {
      return NextResponse.json({ error: "Invalid end time" }, { status: 400 });
    }
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return NextResponse.json(
        { error: "End time must be after start time" },
        { status: 400 }
      );
    }

    // If recurring, expand occurrences
    if (recurrenceRule) {
      const baseStart = new Date(startsAt);
      const baseEnd = endsAt ? new Date(endsAt) : null;
      const occurrences = expandRecurrence(baseStart, baseEnd, recurrenceRule);

      if (occurrences.length === 0) {
        return NextResponse.json({ error: "No occurrences generated from recurrence rule" }, { status: 400 });
      }

      const groupId = "rg_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const insertedIds: string[] = [];

      for (const occ of occurrences) {
        const id = "ev_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        await sql`
          INSERT INTO events (
            id, calendar, title, description, location, url, organizer, organizer_email,
            starts_at, ends_at, timezone, all_day, legend_id, recurrence_group_id, created_by
          ) VALUES (
            ${id}, ${calendar}, ${title}, ${description}, ${location}, ${url},
            ${organizer}, ${organizerEmail},
            ${occ.startsAt.toISOString()}, ${occ.endsAt ? occ.endsAt.toISOString() : null},
            ${timezone}, ${allDay}, ${legendId}, ${groupId}, ${session.email}
          )
        `;
        insertedIds.push(id);
      }

      const firstResult = await sql`SELECT * FROM events WHERE id = ${insertedIds[0]}`;
      return NextResponse.json({
        event: rowToEvent(firstResult.rows[0]),
        recurring: true,
        count: occurrences.length,
      }, { status: 201 });
    }

    // Non-recurring single event
    const id = "ev_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    await sql`
      INSERT INTO events (
        id, calendar, title, description, location, url, organizer, organizer_email,
        starts_at, ends_at, timezone, all_day, legend_id, created_by
      ) VALUES (
        ${id}, ${calendar}, ${title}, ${description}, ${location}, ${url},
        ${organizer}, ${organizerEmail},
        ${startsAt}, ${endsAt}, ${timezone}, ${allDay}, ${legendId}, ${session.email}
      )
    `;

    const result = await sql`SELECT * FROM events WHERE id = ${id} LIMIT 1`;
    return NextResponse.json({ event: rowToEvent(result.rows[0]) }, { status: 201 });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[events POST]", err);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
