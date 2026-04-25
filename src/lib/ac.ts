// =============================================================
// ActiveCampaign API client
// Used to look up contacts and check their tags.
// =============================================================

const AC_API_URL = process.env.AC_API_URL || "";
const AC_API_KEY = process.env.AC_API_KEY || "";

const TAG_ELITES = parseInt(process.env.AC_TAG_ELITES || "136", 10);
const TAG_PLATS = parseInt(process.env.AC_TAG_PLATS || "137", 10);

if (!AC_API_URL || !AC_API_KEY) {
  console.warn(
    "[ac] AC_API_URL or AC_API_KEY missing — ActiveCampaign lookups will fail"
  );
}

async function acFetch(path: string): Promise<any> {
  const url = `${AC_API_URL.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    headers: {
      "Api-Token": AC_API_KEY,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ActiveCampaign ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Look up a contact by email. Returns null if not found.
 * AC stores emails in mixed case, so we match case-insensitively.
 */
export async function findContactByEmail(
  email: string
): Promise<{ id: string; email: string; firstName: string; lastName: string } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  // AC's email_like is a partial match — we filter exact below
  const data = await acFetch(
    `/api/3/contacts?email_like=${encodeURIComponent(normalized)}&limit=20`
  );
  const contacts = data.contacts || [];
  const match = contacts.find(
    (c: any) => String(c.email || "").toLowerCase() === normalized
  );
  if (!match) return null;
  return {
    id: String(match.id),
    email: String(match.email),
    firstName: String(match.firstName || ""),
    lastName: String(match.lastName || ""),
  };
}

/**
 * Get the tag IDs assigned to a contact.
 */
export async function getContactTagIds(contactId: string): Promise<number[]> {
  const data = await acFetch(`/api/3/contacts/${contactId}/contactTags`);
  const tags = data.contactTags || [];
  return tags
    .map((t: any) => parseInt(t.tag, 10))
    .filter((n: number) => !isNaN(n));
}

/**
 * Determine which calendars an AC contact should have access to,
 * based on their tags.
 */
export async function getContactCalendarRoles(
  email: string
): Promise<{
  contact: { id: string; email: string; firstName: string; lastName: string } | null;
  hasElites: boolean;
  hasPlats: boolean;
}> {
  const contact = await findContactByEmail(email);
  if (!contact) {
    return { contact: null, hasElites: false, hasPlats: false };
  }
  const tagIds = await getContactTagIds(contact.id);
  return {
    contact,
    hasElites: tagIds.includes(TAG_ELITES),
    hasPlats: tagIds.includes(TAG_PLATS),
  };
}

export const AC_TAGS = { ELITES: TAG_ELITES, PLATS: TAG_PLATS };
