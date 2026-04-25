// =============================================================
// Calendar export utilities (Google/Outlook/Yahoo URLs + ICS)
// Pure functions, used in the browser.
// =============================================================

import type { EventRecord } from "./types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function fmtIcsUtc(date: Date): string {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    "T" +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}

export function fmtIcsDateInZone(date: Date, zone: string): string {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date).replace(/-/g, "");
}

export function buildDescription(ev: EventRecord): string {
  const parts: string[] = [];
  if (ev.description) parts.push(ev.description);
  if (ev.url) parts.push(`Join: ${ev.url}`);
  if (ev.organizer) {
    parts.push(
      `Organizer: ${ev.organizer}${ev.organizerEmail ? ` (${ev.organizerEmail})` : ""}`
    );
  }
  return parts.join("\n\n");
}

export function googleCalLink(ev: EventRecord): string {
  const start = new Date(ev.startsAt);
  const end = new Date(ev.endsAt || ev.startsAt);
  const startStr = ev.allDay ? fmtIcsDateInZone(start, ev.timezone) : fmtIcsUtc(start);
  const endStr = ev.allDay ? fmtIcsDateInZone(end, ev.timezone) : fmtIcsUtc(end);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title || "Event",
    dates: `${startStr}/${endStr}`,
    details: buildDescription(ev),
    location: ev.location || "",
    ctz: ev.timezone,
  });
  return `https://www.google.com/calendar/render?${params}`;
}

export function outlookLink(ev: EventRecord, host: "live" | "office" = "live"): string {
  const start = new Date(ev.startsAt);
  const end = new Date(ev.endsAt || ev.startsAt);
  const base =
    host === "office" ? "https://outlook.office.com" : "https://outlook.live.com";
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title || "Event",
    startdt: start.toISOString(),
    enddt: end.toISOString(),
    body: buildDescription(ev),
    location: ev.location || "",
    allday: ev.allDay ? "true" : "false",
  });
  return `${base}/calendar/0/deeplink/compose?${params}`;
}

export function yahooLink(ev: EventRecord): string {
  const start = new Date(ev.startsAt);
  const params = new URLSearchParams({
    v: "60",
    title: ev.title || "Event",
    st: fmtIcsUtc(start),
    desc: buildDescription(ev),
    in_loc: ev.location || "",
  });
  if (ev.endsAt && !ev.allDay) {
    params.set("et", fmtIcsUtc(new Date(ev.endsAt)));
  } else if (ev.allDay) {
    params.set("dur", "allday");
  }
  return `https://calendar.yahoo.com/?${params}`;
}

function icsEscape(s: string): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcsForEvent(ev: EventRecord): string[] {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${ev.id}@iwt-calendar`,
    `DTSTAMP:${fmtIcsUtc(new Date())}`,
  ];
  const start = new Date(ev.startsAt);
  const end = new Date(ev.endsAt || ev.startsAt);
  if (ev.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${fmtIcsDateInZone(start, ev.timezone)}`);
    if (ev.endsAt) {
      const endDate = new Date(end);
      const startStr = fmtIcsDateInZone(start, ev.timezone);
      const endStr = fmtIcsDateInZone(endDate, ev.timezone);
      if (startStr === endStr) endDate.setUTCDate(endDate.getUTCDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${fmtIcsDateInZone(endDate, ev.timezone)}`);
    }
  } else {
    lines.push(`DTSTART:${fmtIcsUtc(start)}`);
    lines.push(`DTEND:${fmtIcsUtc(end)}`);
  }
  lines.push(`SUMMARY:${icsEscape(ev.title || "Event")}`);
  if (ev.description || ev.url || ev.organizer) {
    lines.push(`DESCRIPTION:${icsEscape(buildDescription(ev))}`);
  }
  if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
  if (ev.url) lines.push(`URL:${icsEscape(ev.url)}`);
  if (ev.organizerEmail) {
    lines.push(
      `ORGANIZER;CN=${icsEscape(ev.organizer || "")}:mailto:${ev.organizerEmail}`
    );
  }
  lines.push(`CATEGORIES:${ev.calendar.toUpperCase()}`);
  lines.push("STATUS:CONFIRMED");
  lines.push("SEQUENCE:0");
  lines.push("END:VEVENT");
  return lines;
}

export function buildIcs(events: EventRecord[], calName = "IWT Calendar"): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IWT//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calName)}`,
  ];
  events.forEach((ev) => lines.push(...buildIcsForEvent(ev)));
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============= Display helpers =============
export function fmtTimeShort(date: Date, zone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return "";
  }
}

export function fmtDateLong(date: Date, zone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return "";
  }
}

export function fmtDisplay(
  start: Date,
  end: Date | null,
  zone: string,
  allDay: boolean
): string {
  const startStr = fmtDateLong(start, zone);
  if (allDay) {
    if (end) {
      const endStr = fmtDateLong(end, zone);
      if (endStr !== startStr) return `${startStr} – ${endStr}`;
    }
    return `${startStr} · all day`;
  }
  const startTime = fmtTimeShort(start, zone);
  if (!end) return `${startStr} · ${startTime}`;
  const sameDayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const sameDay = sameDayFmt.format(start) === sameDayFmt.format(end);
  const endTime = fmtTimeShort(end, zone);
  if (sameDay) return `${startStr} · ${startTime} – ${endTime}`;
  return `${startStr}, ${startTime} – ${fmtDateLong(end, zone)}, ${endTime}`;
}

export function dateKeyInZone(date: Date, zone: string): string {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}

/** Convert UTC date to a `datetime-local` form-input value in target zone */
export function utcToZonedInput(date: Date, zone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("sv-SE", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  } catch {
    return "";
  }
}

/** Convert a `datetime-local` value (interpreted in `zone`) to a real UTC ISO */
export function zonedInputToISO(value: string, zone: string): string | null {
  if (!value) return null;
  try {
    const naive = new Date(value + "Z");
    if (isNaN(naive.getTime())) return null;
    const local = new Date(naive.toLocaleString("en-US", { timeZone: zone, hour12: false }));
    const utc = new Date(naive.toLocaleString("en-US", { timeZone: "UTC", hour12: false }));
    const offsetMin = Math.round((local.getTime() - utc.getTime()) / 60000);
    return new Date(naive.getTime() - offsetMin * 60000).toISOString();
  } catch {
    return null;
  }
}
