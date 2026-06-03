// =============================================================
// Auth: JWT session cookies + role resolution
// =============================================================

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { initDb, sql } from "./db";
import { getContactCalendarRoles } from "./ac";
import { headers } from "next/headers";

const COOKIE_NAME = "iwt_cal_session";
const SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "";
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET environment variable must be set to a string of at least 32 characters"
    );
  }
  return new TextEncoder().encode(secret);
}

export type Role = "admin" | "elites" | "plats";

export type Session = {
  email: string;
  name: string;
  /** Roles the user has access to. Admin always sees both calendars. */
  roles: Role[];
  /** Calendars they can view */
  calendars: Array<"elites" | "plats">;
  /** True if they can create/edit/delete events and manage admins */
  isAdmin: boolean;
};

/**
 * Returns the bootstrap admin emails from env (always lowercase, trimmed).
 */
export function getBootstrapAdmins(): string[] {
  return (process.env.BOOTSTRAP_ADMINS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check if an email is an admin (either bootstrap or in the admins table).
 */
export async function isAdminEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (getBootstrapAdmins().includes(normalized)) return true;
  await initDb();
  const result = await sql`
    SELECT 1 FROM admins WHERE email = ${normalized} LIMIT 1
  `;
  return result.rows.length > 0;
}

/**
 * Resolve what access an email should have.
 * Returns null if the email has no access at all.
 */
export async function resolveAccess(email: string): Promise<Session | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const isAdmin = await isAdminEmail(normalized);

  // For admins, we don't bother checking AC — they get full access
  if (isAdmin) {
    // Try to get name from AC for nicer display, but don't fail if not found
    let name = normalized;
    try {
      const { contact } = await getContactCalendarRoles(normalized);
      if (contact) {
        const fullName = `${contact.firstName} ${contact.lastName}`.trim();
        if (fullName) name = fullName;
      }
    } catch {
      // ignore — admin works regardless
    }
    return {
      email: normalized,
      name,
      roles: ["admin"],
      calendars: ["elites", "plats"],
      isAdmin: true,
    };
  }

  // Not an admin — must be in AC with the right tag
  const { contact, hasElites, hasPlats } = await getContactCalendarRoles(
    normalized
  );
  if (!contact) return null;

  const calendars: Array<"elites" | "plats"> = [];
  const roles: Role[] = [];

  // Plats first — if they have Plats tag, that's their primary calendar
  if (hasPlats) {
    calendars.push("plats");
    roles.push("plats");
  }
  if (hasElites) {
    calendars.push("elites");
    roles.push("elites");
  }
  if (calendars.length === 0) return null; // no access

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  return {
    email: normalized,
    name: fullName || normalized,
    roles,
    calendars,
    isAdmin: false,
  };
}

/**
 * Issue a session cookie for the given session payload.
 */
export async function setSessionCookie(session: Session): Promise<void> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(COOKIE_NAME);
}

/**
 * Read & validate the session from the request cookie.
 * Returns null if invalid/expired/missing.
 */
export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    // Light validation
    if (!payload || typeof payload !== "object") return null;
    const p = payload as any;
    if (!p.email || !Array.isArray(p.calendars)) return null;
    return {
      email: String(p.email),
      name: String(p.name || ""),
      roles: Array.isArray(p.roles) ? p.roles : [],
      calendars: p.calendars,
      isAdmin: !!p.isAdmin,
    };
  } catch {
    return null;
  }
}

/**
 * Helper for API routes — returns the session or throws a 401.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new HttpError(401, "Not signed in");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  // Check for API key auth (for Base44 integration)
  try {
    const headersList = await headers();
    const apiKey = headersList.get("x-api-key");
    if (apiKey && apiKey === process.env.ADMIN_API_KEY) {
      return {
        email: "api@iwt",
        name: "API",
        isAdmin: true,
        calendars: ["elites", "plats"] as CalendarKey[],
        roles: ["elites", "plats"] as Role[],
      };
    }
  } catch {}

  // Existing JWT check
  const session = await requireSession();
  if (!session.isAdmin) {
    throw new HttpError(403, "Admin access required");
  }
  return session;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
