// =============================================================
// ICS Parser — parses Google Calendar .ics files
// Handles: UTC times, timezone-specified times, all-day dates,
//          multi-line folded values, HTML descriptions, RRULE expansion
// =============================================================

export type ParsedEvent = {
  uid: string;
  title: string;
  description: string;
  location: string;
  url: string;
  startsAt: string; // ISO UTC
  endsAt: string | null; // ISO UTC
  timezone: string;
  allDay: boolean;
  status: "confirmed" | "cancelled" | "tentative";
};

/** Unfold RFC 5545 line continuations (lines starting with space/tab) */
function unfold(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, "").replace(/\r\n/g, "\n");
}

/** Unescape ICS text values */
function unescape(val: string): string {
  return val
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/** Strip HTML tags from descriptions */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parse a DTSTART / DTEND value with optional TZID parameter.
 * Returns ISO UTC string or null if parsing fails.
 */
function parseDt(
  value: string,
  params: string,
  calTz: string
): { iso: string; allDay: boolean; tz: string } | null {
  const isDate = params.includes("VALUE=DATE") || /^\d{8}$/.test(value.trim());

  if (isDate) {
    const v = value.trim();
    const year = parseInt(v.slice(0, 4));
    const month = parseInt(v.slice(4, 6)) - 1;
    const day = parseInt(v.slice(6, 8));
    const d = new Date(Date.UTC(year, month, day));
    return { iso: d.toISOString(), allDay: true, tz: calTz || "UTC" };
  }

  const v = value.trim();

  // UTC time (ends with Z)
  if (v.endsWith("Z")) {
    const d = parseIcsDateTime(v.slice(0, -1));
    if (!d) return null;
    return { iso: new Date(Date.UTC(...d)).toISOString(), allDay: false, tz: "UTC" };
  }

  // Timezone-specified
  const tzidMatch = params.match(/TZID=([^;:]+)/);
  const tz = tzidMatch ? tzidMatch[1].trim() : calTz || "UTC";

  const parts = parseIcsDateTime(v);
  if (!parts) return null;

  // Convert local time in `tz` to UTC
  try {
    const localStr = `${parts[0]}-${String(parts[1] + 1).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}T${String(parts[3]).padStart(2, "0")}:${String(parts[4]).padStart(2, "0")}:${String(parts[5]).padStart(2, "0")}`;
    const iso = localToUtc(localStr, tz);
    return { iso, allDay: false, tz };
  } catch {
    return null;
  }
}

function parseIcsDateTime(s: string): [number, number, number, number, number, number] | null {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  return [
    parseInt(m[1]),
    parseInt(m[2]) - 1,
    parseInt(m[3]),
    parseInt(m[4]),
    parseInt(m[5]),
    parseInt(m[6]),
  ];
}

/** Convert a naive datetime string (YYYY-MM-DDTHH:mm:ss) in a given tz to UTC ISO */
function localToUtc(localStr: string, tz: string): string {
  // Use Intl to find the offset at that moment
  const naive = new Date(localStr + "Z"); // treat as UTC temporarily
  if (isNaN(naive.getTime())) return new Date(localStr).toISOString();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Format the naive-UTC time as if it were in the target tz
  const parts = formatter.formatToParts(naive);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "0";
  const localAsDate = new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`
  );
  const offsetMs = localAsDate.getTime() - naive.getTime();
  return new Date(naive.getTime() - offsetMs).toISOString();
}

/** Expand RRULE recurring events up to 2 years from now */
function expandRRule(
  baseStart: Date,
  baseEnd: Date | null,
  rrule: string,
  maxDate: Date
): Array<{ start: Date; end: Date | null }> {
  const results: Array<{ start: Date; end: Date | null }> = [];
  const duration = baseEnd ? baseEnd.getTime() - baseStart.getTime() : 0;

  const params: Record<string, string> = {};
  rrule.split(";").forEach((part) => {
    const [k, v] = part.split("=");
    params[k] = v;
  });

  const freq = params.FREQ;
  const count = params.COUNT ? parseInt(params.COUNT) : null;
  const until = params.UNTIL ? parseUntil(params.UNTIL) : null;
  const interval = params.INTERVAL ? parseInt(params.INTERVAL) : 1;
  const byDay = params.BYDAY ? params.BYDAY.split(",") : null;

  let current = new Date(baseStart);
  let iterations = 0;
  const limit = count || 500;

  while (iterations < limit) {
    if (until && current > until) break;
    if (current > maxDate) break;

    // Check BYDAY filter for WEEKLY
    if (freq === "WEEKLY" && byDay) {
      const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
      const currentDay = dayNames[current.getUTCDay()];
      if (byDay.some((d) => d.includes(currentDay))) {
        results.push({
          start: new Date(current),
          end: baseEnd ? new Date(current.getTime() + duration) : null,
        });
      }
    } else {
      results.push({
        start: new Date(current),
        end: baseEnd ? new Date(current.getTime() + duration) : null,
      });
    }

    // Advance
    switch (freq) {
      case "DAILY":
        current = new Date(current.getTime() + interval * 86400000);
        break;
      case "WEEKLY":
        current = new Date(current.getTime() + interval * 7 * 86400000);
        break;
      case "MONTHLY":
        current = new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth() + interval,
            current.getUTCDate(),
            current.getUTCHours(),
            current.getUTCMinutes(),
            current.getUTCSeconds()
          )
        );
        break;
      case "YEARLY":
        current = new Date(
          Date.UTC(
            current.getUTCFullYear() + interval,
            current.getUTCMonth(),
            current.getUTCDate(),
            current.getUTCHours(),
            current.getUTCMinutes(),
            current.getUTCSeconds()
          )
        );
        break;
      default:
        iterations = limit; // unknown freq, stop
    }
    iterations++;
  }

  return results;
}

function parseUntil(s: string): Date {
  if (s.endsWith("Z")) {
    return new Date(s.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"));
  }
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return new Date(Date.UTC(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])));
  return new Date(s);
}

/** Main parser — returns list of expanded events from ICS content */
export function parseIcs(content: string): ParsedEvent[] {
  const lines = unfold(content);
  const events: ParsedEvent[] = [];

  // Get calendar-level timezone
  const calTzMatch = lines.match(/^X-WR-TIMEZONE:(.+)$/m);
  const calTz = calTzMatch ? calTzMatch[1].trim() : "UTC";

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 2);

  // Split into VEVENT blocks
  const eventBlocks = lines.split(/BEGIN:VEVENT/g).slice(1);

  for (const block of eventBlocks) {
    const end = block.indexOf("END:VEVENT");
    const raw = block.slice(0, end > -1 ? end : undefined);

    // Parse key-value pairs (with parameter support)
    const kvMap: Record<string, { value: string; params: string }> = {};
    const lineArr = raw.split("\n");
    for (const line of lineArr) {
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const keyFull = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1).trim();
      const semiIdx = keyFull.indexOf(";");
      const key = semiIdx > -1 ? keyFull.slice(0, semiIdx) : keyFull;
      const params = semiIdx > -1 ? keyFull.slice(semiIdx + 1) : "";
      if (key) kvMap[key] = { value, params };
    }

    const uid = kvMap["UID"]?.value || "";
    if (!uid) continue;

    const status = (kvMap["STATUS"]?.value || "CONFIRMED").toLowerCase() as any;
    if (status === "cancelled") continue;

    const title = unescape(kvMap["SUMMARY"]?.value || "Untitled");
    const rawDesc = unescape(kvMap["DESCRIPTION"]?.value || "");
    const description = stripHtml(rawDesc);
    const location = unescape(kvMap["LOCATION"]?.value || "");

    // Extract URL from location or DESCRIPTION if it looks like a URL
    let url = "";
    if (location.startsWith("http")) url = location.split(" ")[0];
    else if (!location) {
      const urlMatch = rawDesc.match(/https?:\/\/[^\s<"\\]+/);
      if (urlMatch) url = urlMatch[0].replace(/\\$/, "");
    }

    const dtStartEntry = kvMap["DTSTART"];
    const dtEndEntry = kvMap["DTEND"];

    if (!dtStartEntry) continue;

    const parsedStart = parseDt(dtStartEntry.value, dtStartEntry.params, calTz);
    if (!parsedStart) continue;

    const parsedEnd = dtEndEntry
      ? parseDt(dtEndEntry.value, dtEndEntry.params, calTz)
      : null;

    const baseStart = new Date(parsedStart.iso);
    const baseEnd = parsedEnd ? new Date(parsedEnd.iso) : null;
    const tz = parsedStart.tz;
    const allDay = parsedStart.allDay;

    const rrule = kvMap["RRULE"]?.value;

    let occurrences: Array<{ start: Date; end: Date | null }>;
    if (rrule) {
      occurrences = expandRRule(baseStart, baseEnd, rrule, maxDate);
    } else {
      occurrences = [{ start: baseStart, end: baseEnd }];
    }

    occurrences.forEach(({ start, end }, idx) => {
      events.push({
        uid: occurrences.length > 1 ? `${uid}_${idx}` : uid,
        title,
        description,
        location: location.startsWith("http") ? "" : location,
        url,
        startsAt: start.toISOString(),
        endsAt: end ? end.toISOString() : null,
        timezone: tz,
        allDay,
        status: "confirmed",
      });
    });
  }

  return events;
}
