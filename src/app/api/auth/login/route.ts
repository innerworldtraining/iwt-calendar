import { NextResponse } from "next/server";
import { resolveAccess, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "That doesn't look like a valid email address" },
        { status: 400 }
      );
    }

    const session = await resolveAccess(email);
    if (!session) {
      return NextResponse.json(
        {
          error:
            "We don't have that email on file, or it doesn't have calendar access yet. Please contact your account manager.",
        },
        { status: 403 }
      );
    }

    await setSessionCookie(session);
    return NextResponse.json({
      ok: true,
      email: session.email,
      name: session.name,
      isAdmin: session.isAdmin,
      calendars: session.calendars,
    });
  } catch (err: any) {
    console.error("[login] error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
