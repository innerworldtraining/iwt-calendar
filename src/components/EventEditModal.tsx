"use client";
import { useEffect, useState } from "react";
import type { CalendarKey, EventRecord, LegendRecord } from "@/lib/types";
import { utcToZonedInput, zonedInputToISO } from "@/lib/calendar-utils";

const TZ_LIST = (() => {
  const browserTz =
    typeof window !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";
  const common = [
    "UTC",
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
    "America/New_York",
    "America/Toronto",
    "America/Sao_Paulo",
    "America/Mexico_City",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Rome",
    "Europe/Athens",
    "Europe/Moscow",
    "Africa/Lagos",
    "Africa/Cairo",
    "Africa/Johannesburg",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Bangkok",
    "Asia/Singapore",
    "Asia/Manila",
    "Asia/Hong_Kong",
    "Asia/Tokyo",
    "Asia/Seoul",
    "Asia/Shanghai",
    "Australia/Perth",
    "Australia/Sydney",
    "Australia/Melbourne",
    "Pacific/Auckland",
    "Pacific/Honolulu",
  ];
  const list = common.slice();
  if (!list.includes(browserTz)) list.unshift(browserTz);
  else {
    list.splice(list.indexOf(browserTz), 1);
    list.unshift(browserTz);
  }
  return list;
})();

type Props = {
  existing: EventRecord | null;
  defaultCalendar: CalendarKey;
  defaultDate: Date | null;
  browserTz: string;
  legends: LegendRecord[];
  onClose: () => void;
  onSave: (payload: any) => Promise<boolean>;
};

export function EventEditModal({
  existing,
  defaultCalendar,
  defaultDate,
  browserTz,
  legends,
  onClose,
  onSave,
}: Props) {
  const [calendar, setCalendar] = useState<CalendarKey>(
    existing?.calendar || defaultCalendar
  );
  const [title, setTitle] = useState(existing?.title || "");
  const [tz, setTz] = useState(existing?.timezone || browserTz);
  const [allDay, setAllDay] = useState(existing?.allDay || false);
  const [location, setLocation] = useState(existing?.location || "");
  const [url, setUrl] = useState(existing?.url || "");
  const [organizer, setOrganizer] = useState(existing?.organizer || "");
  const [orgEmail, setOrgEmail] = useState(existing?.organizerEmail || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [legendId, setLegendId] = useState<string | null>(existing?.legendId || null);
  const [submitting, setSubmitting] = useState(false);

  // start/end as datetime-local strings
  const [startStr, setStartStr] = useState(() => {
    if (existing?.startsAt) {
      return utcToZonedInput(new Date(existing.startsAt), existing.timezone || browserTz);
    }
    const start = defaultDate ? new Date(defaultDate) : new Date();
    if (!defaultDate) start.setDate(start.getDate() + 1);
    start.setHours(14, 0, 0, 0);
    return utcToZonedInput(start, browserTz);
  });
  const [endStr, setEndStr] = useState(() => {
    if (existing?.endsAt) {
      return utcToZonedInput(new Date(existing.endsAt), existing.timezone || browserTz);
    }
    const start = defaultDate ? new Date(defaultDate) : new Date();
    if (!defaultDate) start.setDate(start.getDate() + 1);
    start.setHours(15, 0, 0, 0);
    return utcToZonedInput(start, browserTz);
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!startStr) newErrors.start = "Start time is required";

    if (startStr && endStr) {
      const startISO = zonedInputToISO(startStr, tz);
      const endISO = zonedInputToISO(endStr, tz);
      if (startISO && endISO && new Date(endISO) <= new Date(startISO)) {
        newErrors.end = "End time must be after start time";
      }
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    const startISO = zonedInputToISO(startStr, tz);
    const endISO = endStr ? zonedInputToISO(endStr, tz) : null;
    const ok = await onSave({
      calendar,
      title: title.trim(),
      description,
      location,
      url,
      organizer,
      organizerEmail: orgEmail,
      startsAt: startISO,
      endsAt: endISO,
      timezone: tz,
      allDay,
      legendId,
    });
    if (!ok) setSubmitting(false);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="modal-title">{existing ? "Edit event" : "New event"}</div>
            <div className="modal-sub">
              {existing ? "Update the event details below" : "Schedule something for your members"}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
              <line x1={18} y1={6} x2={6} y2={18} />
              <line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Calendar</label>
            <div className="seg">
              <button
                type="button"
                className={`seg-opt${calendar === "elites" ? " active" : ""}`}
                onClick={() => { setCalendar("elites"); setLegendId(null); }}
              >
                <span className="dot" style={{ background: "var(--elites)" }} />
                Elites
              </button>
              <button
                type="button"
                className={`seg-opt${calendar === "plats" ? " active" : ""}`}
                onClick={() => { setCalendar("plats"); setLegendId(null); }}
              >
                <span className="dot" style={{ background: "var(--plats)" }} />
                Plats
              </button>
            </div>
          </div>

          {/* Legend picker */}
          {(() => {
            const calLegends = legends.filter((l) => l.calendar === calendar);
            if (calLegends.length === 0) return null;
            const selected = calLegends.find((l) => l.id === legendId);
            return (
              <div className="field">
                <label>Event type (legend)</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setLegendId(null)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 10px", borderRadius: "var(--r-sm)",
                      border: legendId === null ? "2px solid var(--text)" : "1px solid var(--border)",
                      background: legendId === null ? "var(--surface-2)" : "white",
                      fontSize: 12, fontWeight: legendId === null ? 600 : 500,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "#6b7280", display: "inline-block" }} />
                    None
                  </button>
                  {calLegends.map((leg) => (
                    <button
                      key={leg.id}
                      type="button"
                      onClick={() => setLegendId(leg.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "6px 10px", borderRadius: "var(--r-sm)",
                        border: legendId === leg.id ? `2px solid ${leg.color}` : "1px solid var(--border)",
                        background: legendId === leg.id ? `${leg.color}18` : "white",
                        fontSize: 12, fontWeight: legendId === leg.id ? 600 : 500,
                        cursor: "pointer", color: legendId === leg.id ? leg.color : "var(--text)",
                      }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: leg.color, display: "inline-block" }} />
                      {leg.label}
                    </button>
                  ))}
                </div>
                {selected && (
                  <div className="field-help">Events will show in <strong style={{ color: selected.color }}>{selected.label}</strong> color on the calendar</div>
                )}
              </div>
            );
          })()}

          <div className="field">
            <label>
              Title <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="e.g. Quarterly strategy session"
              className={errors.title ? "invalid" : ""}
            />
            {errors.title && <div className="field-error">{errors.title}</div>}
          </div>

          <div className="field-row">
            <div className="field">
              <label>
                Starts <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="datetime-local"
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                className={errors.start ? "invalid" : ""}
              />
              {errors.start && <div className="field-error">{errors.start}</div>}
            </div>
            <div className="field">
              <label>Ends</label>
              <input
                type="datetime-local"
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                className={errors.end ? "invalid" : ""}
              />
              {errors.end && <div className="field-error">{errors.end}</div>}
            </div>
          </div>

          <div className="field">
            <label>Timezone</label>
            <select value={tz} onChange={(e) => setTz(e.target.value)}>
              {TZ_LIST.map((z, i) => (
                <option key={z} value={z}>
                  {z}
                  {i === 0 ? " (browser)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="toggle">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              <span className="track" />
              <span className="lbl">All-day event</span>
            </label>
          </div>

          <div className="field">
            <label>Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Address, room, or 'Online'"
            />
          </div>

          <div className="field">
            <label>Meeting URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://meet.example.com/..."
            />
            <div className="field-help">Zoom, Google Meet, or any join link</div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Organizer</label>
              <input
                type="text"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="Host name"
              />
            </div>
            <div className="field">
              <label>Organizer email</label>
              <input
                type="email"
                value={orgEmail}
                onChange={(e) => setOrgEmail(e.target.value)}
                placeholder="host@example.com"
              />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agenda, prep links, dial-in details..."
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Saving…" : existing ? "Save changes" : "Save event"}
          </button>
        </div>
      </div>
    </div>
  );
}
