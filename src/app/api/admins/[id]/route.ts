import { NextResponse } from "next/server";
import { initDb, sql } from "@/lib/db";
import { requireAdmin, getBootstrapAdmins, HttpError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await initDb();
    await requireAdmin();

    const email = decodeURIComponent(params.id).trim().toLowerCase();

    if (getBootstrapAdmins().includes(email)) {
      return NextResponse.json(
        { error: "Bootstrap admins can only be changed via environment variables" },
        { status: 403 }
      );
    }

    await sql`DELETE FROM admins WHERE email = ${email}`;
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admins DELETE]", err);
    return NextResponse.json({ error: "Failed to remove admin" }, { status: 500 });
  }
}
