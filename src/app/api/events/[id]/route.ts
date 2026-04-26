import { NextResponse } from "next/server";
import { initDb, sql } from "@/lib/db";
import { requireAdmin, HttpError } from "@/lib/auth";
import type { EventRecord } from "@/lib/types";

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
    createdBy: r.created_by || null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initDb();
    await requireAdmin();
    const id = params.id;
    const body = await req.json().catch(() => ({}));

    const existing = await sql`SELECT * FROM events WHERE id = ${id}`;
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const current = existing.rows[0];

    const calendar = body.calendar ?? current.calendar;
    const title = body.title !== undefined ? String(body.title).trim() : current.title;
    const startsAt = body.startsAt ?? current.starts_at;
    const endsAt = body.endsAt !== undefined ? body.endsAt : current.ends_at;
    const timezone = body.timezone ?? current.timezone;
    const allDay = body.allDay !== undefined ? !!body.allDay : current.all_day;
    const description = body.description !== undefined ? String(body.description) : current.description;
    const location = body.location !== undefined ? String(body.location) : current.location;
    const url = body.url !== undefined ? String(body.url) : current.url;
    const organizer = body.organizer !== undefined ? String(body.organizer) : current.organizer;
    const organizerEmail = body.organizerEmail !== undefined ? String(body.organizerEmail) : current.organizer_email;
    const legendId = body.legendId !== undefined ? body.legendId : current.legend_id;

    if (calendar !== "elites" && calendar !== "plats") {
      return NextResponse.json({ error: "Calendar must be 'elites' or 'plats'" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!startsAt || isNaN(new Date(startsAt).getTime())) {
      return NextResponse.json({ error: "Valid start time is required" }, { status: 400 });
    }
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    await sql`
      UPDATE events SET
        calendar = ${calendar},
        title = ${title},
        description = ${description},
        location = ${location},
        url = ${url},
        organizer = ${organizer},
        organizer_email = ${organizerEmail},
        starts_at = ${startsAt},
        ends_at = ${endsAt},
        timezone = ${timezone},
        all_day = ${allDay},
        legend_id = ${legendId},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    const result = await sql`SELECT * FROM events WHERE id = ${id}`;
    return NextResponse.json({ event: rowToEvent(result.rows[0]) });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[events PATCH]", err);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initDb();
    await requireAdmin();
    await sql`DELETE FROM events WHERE id = ${params.id}`;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[events DELETE]", err);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
