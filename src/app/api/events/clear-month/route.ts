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
    const year = parseInt(searchParams.get("year") || "");
    const month = parseInt(searchParams.get("month") || ""); // 1-12

    if (calendar !== "elites" && calendar !== "plats") {
      return NextResponse.json(
        { error: "Calendar must be 'elites' or 'plats'" },
        { status: 400 }
      );
    }
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Valid year and month (1–12) are required" },
        { status: 400 }
      );
    }

    // Build start/end of month in UTC
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const endOfMonth = new Date(Date.UTC(year, month, 1)).toISOString();

    const result = await sql`
      DELETE FROM events
      WHERE calendar = ${calendar}
        AND starts_at >= ${startOfMonth}
        AND starts_at < ${endOfMonth}
      RETURNING id
    `;

    return NextResponse.json({
      deleted: result.rows.length,
      message: `Deleted ${result.rows.length} event${result.rows.length === 1 ? "" : "s"} from ${calendar} · ${year}-${String(month).padStart(2, "0")}`,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[clear-month]", err);
    return NextResponse.json({ error: "Failed to clear events" }, { status: 500 });
  }
}
