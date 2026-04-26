import { NextResponse } from "next/server";
import { initDb, sql } from "@/lib/db";
import { requireAdmin, HttpError } from "@/lib/auth";
import { parseIcs } from "@/lib/ics-parser";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await initDb();
    const session = await requireAdmin();

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { calendar, icsContent } = body;

    if (calendar !== "elites" && calendar !== "plats") {
      return NextResponse.json(
        { error: "Calendar must be 'elites' or 'plats'" },
        { status: 400 }
      );
    }

    if (!icsContent || typeof icsContent !== "string") {
      return NextResponse.json({ error: "ICS content is required" }, { status: 400 });
    }

    const events = parseIcs(icsContent);

    if (events.length === 0) {
      return NextResponse.json({ imported: 0, updated: 0, skipped: 0, message: "No events found in file" });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const ev of events) {
      try {
        // Check if event already exists by external_uid
        const existing = await sql`
          SELECT id FROM events
          WHERE external_uid = ${ev.uid} AND calendar = ${calendar}
          LIMIT 1
        `;

        if (existing.rows.length > 0) {
          // Update existing event
          await sql`
            UPDATE events SET
              title = ${ev.title},
              description = ${ev.description},
              location = ${ev.location},
              url = ${ev.url},
              starts_at = ${ev.startsAt},
              ends_at = ${ev.endsAt},
              timezone = ${ev.timezone},
              all_day = ${ev.allDay},
              updated_at = NOW()
            WHERE external_uid = ${ev.uid} AND calendar = ${calendar}
          `;
          updated++;
        } else {
          // Insert new event
          const id =
            "ev_" +
            Date.now().toString(36) +
            Math.random().toString(36).slice(2, 7);

          await sql`
            INSERT INTO events (
              id, calendar, title, description, location, url,
              starts_at, ends_at, timezone, all_day,
              external_uid, created_by
            ) VALUES (
              ${id}, ${calendar}, ${ev.title}, ${ev.description},
              ${ev.location}, ${ev.url},
              ${ev.startsAt}, ${ev.endsAt}, ${ev.timezone}, ${ev.allDay},
              ${ev.uid}, ${session.email}
            )
          `;
          imported++;
        }
      } catch (err) {
        console.error("[import] event error:", ev.uid, err);
        skipped++;
      }
    }

    return NextResponse.json({
      imported,
      updated,
      skipped,
      total: events.length,
      message: `Import complete: ${imported} added, ${updated} updated${skipped > 0 ? `, ${skipped} skipped` : ""}`,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[import]", err);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
