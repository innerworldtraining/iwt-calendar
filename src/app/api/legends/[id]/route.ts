import { NextResponse } from "next/server";
import { initDb, sql } from "@/lib/db";
import { requireAdmin, HttpError } from "@/lib/auth";
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

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initDb();
    await requireAdmin();
    const id = params.id;
    const body = await req.json().catch(() => ({}));

    const existing = await sql`SELECT * FROM legends WHERE id = ${id}`;
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: "Legend not found" }, { status: 404 });
    }

    const current = existing.rows[0];
    const label =
      body.label !== undefined ? String(body.label).trim() : current.label;
    const color =
      body.color !== undefined ? String(body.color).trim() : current.color;

    if (!label) {
      return NextResponse.json({ error: "Label is required" }, { status: 400 });
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return NextResponse.json({ error: "Invalid color format" }, { status: 400 });
    }

    await sql`
      UPDATE legends SET label = ${label}, color = ${color}
      WHERE id = ${id}
    `;

    const result = await sql`SELECT * FROM legends WHERE id = ${id}`;
    return NextResponse.json({ legend: rowToLegend(result.rows[0]) });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[legends PATCH]", err);
    return NextResponse.json({ error: "Failed to update legend" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initDb();
    await requireAdmin();
    // Events with this legend will have legend_id set to NULL (ON DELETE SET NULL)
    await sql`DELETE FROM legends WHERE id = ${params.id}`;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[legends DELETE]", err);
    return NextResponse.json({ error: "Failed to delete legend" }, { status: 500 });
  }
}
