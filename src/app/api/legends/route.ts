import { NextResponse } from "next/server";
import { initDb, sql } from "@/lib/db";
import { requireAdmin, requireSession, HttpError } from "@/lib/auth";
import type { LegendRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function rowToLegend(r: any): LegendRecord {
  return {
    id: r.id,
    calendar: r.calendar,
    label: r.label,
    color: r.color,
    sortOrder: r.sort_order,
    createdBy: r.created_by || null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function GET() {
  try {
    await initDb();
    await requireSession();
    const result = await sql`
      SELECT * FROM legends ORDER BY calendar, sort_order ASC, created_at ASC
    `;
    return NextResponse.json({ legends: result.rows.map(rowToLegend) });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[legends GET]", err);
    return NextResponse.json({ error: "Failed to load legends" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDb();
    const session = await requireAdmin();
    const body = await req.json().catch(() => ({}));

    const calendar = body.calendar;
    const label = String(body.label || "").trim();
    const color = String(body.color || "#6b7280").trim();

    if (calendar !== "elites" && calendar !== "plats") {
      return NextResponse.json(
        { error: "Calendar must be 'elites' or 'plats'" },
        { status: 400 }
      );
    }
    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json({ error: "Invalid color format" }, { status: 400 });
    }

    // Get next sort order
    const maxOrder = await sql`
      SELECT COALESCE(MAX(sort_order), -1) as max_order
      FROM legends WHERE calendar = ${calendar}
    `;
    const sortOrder = (maxOrder.rows[0]?.max_order ?? -1) + 1;

    const id =
      "leg_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6);

    await sql`
      INSERT INTO legends (id, calendar, label, color, sort_order, created_by)
      VALUES (${id}, ${calendar}, ${label}, ${color}, ${sortOrder}, ${session.email})
    `;

    const result = await sql`SELECT * FROM legends WHERE id = ${id}`;
    return NextResponse.json(
      { legend: rowToLegend(result.rows[0]) },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[legends POST]", err);
    return NextResponse.json({ error: "Failed to create legend" }, { status: 500 });
  }
}
