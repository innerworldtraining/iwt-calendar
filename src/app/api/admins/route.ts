import { NextResponse } from "next/server";
import { initDb, sql } from "@/lib/db";
import { requireAdmin, getBootstrapAdmins, HttpError } from "@/lib/auth";
import type { AdminRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDb();
    await requireAdmin();

    const result = await sql`
      SELECT email, name, added_by, added_at FROM admins ORDER BY added_at DESC
    `;
    const dbAdmins: AdminRecord[] = result.rows.map((r) => ({
      email: r.email,
      name: r.name || "",
      addedBy: r.added_by || null,
      addedAt: new Date(r.added_at).toISOString(),
      isBootstrap: false,
    }));

    const bootstrap = getBootstrapAdmins().map<AdminRecord>((email) => ({
      email,
      name: "(Bootstrap admin)",
      addedBy: null,
      addedAt: new Date(0).toISOString(),
      isBootstrap: true,
    }));

    return NextResponse.json({ admins: [...bootstrap, ...dbAdmins] });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admins GET]", err);
    return NextResponse.json({ error: "Failed to load admins" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await initDb();
    const session = await requireAdmin();
    const body = await req.json().catch(() => ({}));

    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    if (getBootstrapAdmins().includes(email)) {
      return NextResponse.json(
        { error: "That email is already a bootstrap admin (set in environment)" },
        { status: 409 }
      );
    }

    const exists = await sql`SELECT email FROM admins WHERE email = ${email} LIMIT 1`;
    if (exists.rows.length > 0) {
      return NextResponse.json(
        { error: "That email is already an admin" },
        { status: 409 }
      );
    }

    await sql`
      INSERT INTO admins (email, name, added_by)
      VALUES (${email}, ${name}, ${session.email})
    `;

    return NextResponse.json({
      admin: { email, name, addedBy: session.email, addedAt: new Date().toISOString() },
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admins POST]", err);
    return NextResponse.json({ error: "Failed to add admin" }, { status: 500 });
  }
}
