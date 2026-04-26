import { NextResponse } from "next/server";
import { initDb, sql } from "@/lib/db";
import { requireAdmin, HttpError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  try {
    await initDb();
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const calendar = searchParams.get("calendar");

    if (calendar !== "elites" && calendar !== "plats") {
      return NextResponse.json(
        { error: "Calendar must be 'elites' or 'plats'" },
        { status: 400 }
      );
    }

    // Delete all events from today (start of today UTC) onwards
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const result = await sql`
      DELETE FROM events
      WHERE calendar = ${calendar}
        AND starts_at >= ${startOfToday.toISOString()}
      RETURNING id
    `;

    return NextResponse.json({
      deleted: result.rows.length,
      message: `Deleted ${result.rows.length} upcoming event${result.rows.length === 1 ? "" : "s"} from the ${calendar === "elites" ? "Elites" : "Plats"} calendar`,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[clear-upcoming]", err);
    return NextResponse.json({ error: "Failed to clear upcoming events" }, { status: 500 });
  }
}
