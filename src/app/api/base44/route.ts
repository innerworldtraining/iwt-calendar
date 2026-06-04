import { NextRequest, NextResponse } from "next/server";
import { initDb, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

// ── Auth helper ──────────────────────────────────────────────────────────────
function checkApiKey(req: NextRequest): boolean {
  const key = req.headers.get("x-api-key");
  return !!key && key === process.env.ADMIN_API_KEY;
}

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized — invalid or missing x-api-key header" },
    { status: 401 }
  );
}

// ── Row mapper ───────────────────────────────────────────────────────────────
function rowToEvent(r: any) {
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
    createdAt: new Date(r.created_at).toISOString(),
  };
}

// ── GET /api/base44 — list events ────────────────────────────────────────────
// Query params:
//   calendar=elites|plats  (required)
//   action=events|legends  (optional, default: events)
export async function GET(req: NextRequest) {
  if (!checkApiKey(req)) return unauthorized();

  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "events";
    const calendar = searchParams.get("calendar");

    // ── List legends ──────────────────────────────────────────────────────
    if (action === "legends") {
      const result = calendar
        ? await sql`SELECT * FROM legends WHERE calendar = ${calendar} ORDER BY label`
        : await sql`SELECT * FROM legends ORDER BY calendar, label`;
      return NextResponse.json({
        legends: result.rows.map((r: any) => ({
          id: r.id,
          label: r.label,
          color: r.color,
          calendar: r.calendar,
        })),
      });
    }

    // ── List events ───────────────────────────────────────────────────────
    if (!calendar || (calendar !== "elites" && calendar !== "plats")) {
      return NextResponse.json(
        { error: "calendar param must be 'elites' or 'plats'" },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT * FROM events
      WHERE calendar = ${calendar}
      ORDER BY starts_at ASC
    `;

    return NextResponse.json({ events: result.rows.map(rowToEvent) });
  } catch (err: any) {
    console.error("[base44 GET]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST /api/base44 — create event ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!checkApiKey(req)) return unauthorized();

  try {
    await initDb();
    const body = await req.json();
    const {
      calendar, title, description = "", location = "", url = "",
      organizer = "", organizerEmail = "", startsAt, endsAt = null,
      timezone = "America/New_York", allDay = false, legendId = null,
    } = body;

    if (!calendar || !title || !startsAt) {
      return NextResponse.json(
        { error: "calendar, title, and startsAt are required" },
        { status: 400 }
      );
    }
    if (calendar !== "elites" && calendar !== "plats") {
      return NextResponse.json(
        { error: "calendar must be 'elites' or 'plats'" },
        { status: 400 }
      );
    }

    const id = "ev_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    await sql`
      INSERT INTO events (
        id, calendar, title, description, location, url,
        organizer, organizer_email, starts_at, ends_at,
        timezone, all_day, legend_id, created_by
      ) VALUES (
        ${id}, ${calendar}, ${title}, ${description}, ${location}, ${url},
        ${organizer}, ${organizerEmail}, ${startsAt}, ${endsAt},
        ${timezone}, ${allDay}, ${legendId}, ${"base44"}
      )
    `;

    const result = await sql`SELECT * FROM events WHERE id = ${id}`;
    return NextResponse.json({ event: rowToEvent(result.rows[0]) }, { status: 201 });
  } catch (err: any) {
    console.error("[base44 POST]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── PATCH /api/base44 — update event ────────────────────────────────────────
// Query params: id=<event_id>
export async function PATCH(req: NextRequest) {
  if (!checkApiKey(req)) return unauthorized();

  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

    const body = await req.json();
    const {
      title, description, location, url, organizer, organizerEmail,
      startsAt, endsAt, timezone, allDay, legendId,
    } = body;

    await sql`
      UPDATE events SET
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        location = COALESCE(${location}, location),
        url = COALESCE(${url}, url),
        organizer = COALESCE(${organizer}, organizer),
        organizer_email = COALESCE(${organizerEmail}, organizer_email),
        starts_at = COALESCE(${startsAt}, starts_at),
        ends_at = COALESCE(${endsAt}, ends_at),
        timezone = COALESCE(${timezone}, timezone),
        all_day = COALESCE(${allDay}, all_day),
        legend_id = COALESCE(${legendId}, legend_id),
        updated_at = NOW()
      WHERE id = ${id}
    `;

    const result = await sql`SELECT * FROM events WHERE id = ${id}`;
    if (!result.rows.length) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ event: rowToEvent(result.rows[0]) });
  } catch (err: any) {
    console.error("[base44 PATCH]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── DELETE /api/base44 — delete event ───────────────────────────────────────
// Query params: id=<event_id>  series=true (optional)
export async function DELETE(req: NextRequest) {
  if (!checkApiKey(req)) return unauthorized();

  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const series = searchParams.get("series") === "true";
    if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

    if (series) {
      const ev = await sql`SELECT recurrence_group_id FROM events WHERE id = ${id}`;
      if (ev.rows[0]?.recurrence_group_id) {
        await sql`DELETE FROM events WHERE recurrence_group_id = ${ev.rows[0].recurrence_group_id}`;
        return NextResponse.json({ ok: true, deletedSeries: true });
      }
    }

    await sql`DELETE FROM events WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[base44 DELETE]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
