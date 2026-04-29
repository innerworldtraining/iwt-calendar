"use client";
import { useEffect, useState } from "react";
import type { CalendarKey, EventRecord, LegendRecord, RecurrenceRule } from "@/lib/types";
import { utcToZonedInput, zonedInputToISO } from "@/lib/calendar-utils";

const TZ_LIST = (() => {
  const browserTz =
    typeof window !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";
  const common = [
    "America/New_York",
    "UTC",
    "America/Los_Angeles",
    "America/Denver",
    "America/Chicago",
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
  // Add browser tz if not already in list
  if (!list.includes(browserTz)) list.push(browserTz);
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
  const [tz, setTz] = useState(existing?.timezone || "America/New_York");
  const [allDay, setAllDay] = useState(existing?.allDay || false);
  const [location, setLocation] = useState(existing?.location || "");
  const [url, setUrl] = useState(existing?.url || "");
  const [organizer, setOrganizer] = useState(existing?.organizer || "");
  const [orgEmail, setOrgEmail] = useState(existing?.organizerEmail || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [legendId, setLegendId] = useState<string | null>(existing?.legendId || null);
  const [submitting, setSubmitting] = useState(false);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurType, setRecurType] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [recurEvery, setRecurEvery] = useState(1);
  const [recurEndAfter, setRecurEndAfter] = useState(10);
  const [recurWeekDays, setRecurWeekDays] = useState<number[]>([1]); // Mon default
  const [recurMonthlyMode, setRecurMonthlyMode] = useState<"day-of-month" | "day-of-week">("day-of-month");
  const [recurDayOfMonth, setRecurDayOfMonth] = useState(1);
  const [recurWeekOrdinal, setRecurWeekOrdinal] = useState<"first" | "second" | "third" | "fourth" | "last">("first");
  const [recurWeekDay, setRecurWeekDay] = useState(1); // Mon

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

    // Build recurrence rule if enabled (only for new events, not edits)
    let recurrenceRule: RecurrenceRule | null = null;
    if (isRecurring && !existing) {
      if (recurType === "daily") {
        recurrenceRule = { type: "daily", every: recurEvery, endAfter: recurEndAfter };
      } else if (recurType === "weekly") {
        const days = recurWeekDays.length > 0 ? recurWeekDays : [new Date(startISO!).getUTCDay()];
        recurrenceRule = { type: "weekly", every: recurEvery, days, endAfter: recurEndAfter };
      } else {
        recurrenceRule = {
          type: "monthly",
          every: recurEvery,
          endAfter: recurEndAfter,
          monthlyMode: recurMonthlyMode,
          dayOfMonth: recurMonthlyMode === "day-of-month" ? recurDayOfMonth : undefined,
          weekOrdinal: recurMonthlyMode === "day-of-week" ? recurWeekOrdinal : undefined,
          weekDay: recurMonthlyMode === "day-of-week" ? recurWeekDay : undefined,
        };
      }
    }

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
      recurrenceRule,
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
                      background: legendId === null ? "var(--surface-2)" : "var(--surface)",
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
                        background: legendId === leg.id ? `${leg.color}28` : "var(--surface)",
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
              {TZ_LIST.map((z) => (
                <option key={z} value={z}>
                  {z}{z === "America/New_York" ? " (default)" : ""}
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

          {/* Recurring toggle — only for new events */}
          {!existing && (
            <div className="field">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                />
                <span className="track" />
                <span className="lbl">Recurring event</span>
              </label>
            </div>
          )}

          {/* Recurrence rule builder */}
          {isRecurring && !existing && (
            <div style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r)",
              padding: "16px",
              marginBottom: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Recurring rule
              </div>

              {/* Frequency type */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Repeat every</label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={recurEvery}
                    onChange={(e) => setRecurEvery(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: "70px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", borderRadius: "var(--r-sm)", fontSize: "14px" }}
                  />
                  <div className="seg">
                    {(["daily", "weekly", "monthly"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`seg-opt${recurType === t ? " active" : ""}`}
                        onClick={() => setRecurType(t)}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Weekly — day selector */}
              {recurType === "weekly" && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>On these days</label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {[
                      { label: "Sun", value: 0 },
                      { label: "Mon", value: 1 },
                      { label: "Tue", value: 2 },
                      { label: "Wed", value: 3 },
                      { label: "Thu", value: 4 },
                      { label: "Fri", value: 5 },
                      { label: "Sat", value: 6 },
                    ].map((d) => {
                      const selected = recurWeekDays.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => {
                            setRecurWeekDays((prev) =>
                              selected
                                ? prev.filter((x) => x !== d.value)
                                : [...prev, d.value].sort()
                            );
                          }}
                          style={{
                            width: "42px",
                            height: "36px",
                            borderRadius: "var(--r-sm)",
                            border: selected ? "2px solid var(--primary)" : "1px solid var(--border)",
                            background: selected ? "var(--primary)" : "var(--surface)",
                            color: selected ? "white" : "var(--text)",
                            fontSize: "12px",
                            fontWeight: selected ? 700 : 500,
                            cursor: "pointer",
                            transition: "all 0.15s",
                          }}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                  {recurWeekDays.length === 0 && (
                    <div style={{ fontSize: "12px", color: "var(--danger)", marginTop: "4px" }}>
                      Select at least one day
                    </div>
                  )}
                </div>
              )}

              {/* Monthly — day-of-month vs day-of-week */}
              {recurType === "monthly" && (
                <div className="field" style={{ marginBottom: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                  <label>Monthly pattern</label>

                  {/* Option 1: Day of month */}
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="monthlyMode"
                      checked={recurMonthlyMode === "day-of-month"}
                      onChange={() => setRecurMonthlyMode("day-of-month")}
                      style={{ accentColor: "var(--primary)", width: "16px", height: "16px" }}
                    />
                    <span style={{ fontSize: "13px", color: "var(--text-2)" }}>On day</span>
                    <select
                      value={recurDayOfMonth}
                      onChange={(e) => setRecurDayOfMonth(parseInt(e.target.value))}
                      disabled={recurMonthlyMode !== "day-of-month"}
                      style={{
                        background: "var(--surface)", border: "1px solid var(--border)",
                        color: "var(--text)", padding: "6px 10px", borderRadius: "var(--r-sm)",
                        fontSize: "13px", opacity: recurMonthlyMode !== "day-of-month" ? 0.4 : 1,
                      }}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: "13px", color: "var(--text-3)" }}>of the month</span>
                  </label>

                  {/* Option 2: Day of week */}
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", flexWrap: "wrap" }}>
                    <input
                      type="radio"
                      name="monthlyMode"
                      checked={recurMonthlyMode === "day-of-week"}
                      onChange={() => setRecurMonthlyMode("day-of-week")}
                      style={{ accentColor: "var(--primary)", width: "16px", height: "16px" }}
                    />
                    <span style={{ fontSize: "13px", color: "var(--text-2)" }}>On the</span>
                    <select
                      value={recurWeekOrdinal}
                      onChange={(e) => setRecurWeekOrdinal(e.target.value as any)}
                      disabled={recurMonthlyMode !== "day-of-week"}
                      style={{
                        background: "var(--surface)", border: "1px solid var(--border)",
                        color: "var(--text)", padding: "6px 10px", borderRadius: "var(--r-sm)",
                        fontSize: "13px", opacity: recurMonthlyMode !== "day-of-week" ? 0.4 : 1,
                      }}
                    >
                      <option value="first">First</option>
                      <option value="second">Second</option>
                      <option value="third">Third</option>
                      <option value="fourth">Fourth</option>
                      <option value="last">Last</option>
                    </select>
                    <select
                      value={recurWeekDay}
                      onChange={(e) => setRecurWeekDay(parseInt(e.target.value))}
                      disabled={recurMonthlyMode !== "day-of-week"}
                      style={{
                        background: "var(--surface)", border: "1px solid var(--border)",
                        color: "var(--text)", padding: "6px 10px", borderRadius: "var(--r-sm)",
                        fontSize: "13px", opacity: recurMonthlyMode !== "day-of-week" ? 0.4 : 1,
                      }}
                    >
                      {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d, i) => (
                        <option key={i} value={i}>{d}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: "13px", color: "var(--text-3)" }}>of the month</span>
                  </label>
                </div>
              )}

              {/* End after */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label>End after</label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={recurEndAfter}
                    onChange={(e) => setRecurEndAfter(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: "70px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 10px", borderRadius: "var(--r-sm)", fontSize: "14px" }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--text-3)" }}>
                    occurrence{recurEndAfter === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div style={{
                padding: "10px 12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)",
                fontSize: "12px",
                color: "var(--text-3)",
                lineHeight: 1.5,
              }}>
                <strong style={{ color: "var(--text-2)" }}>Repeats:</strong>{" "}
                {recurType === "daily" && `Every ${recurEvery} day${recurEvery > 1 ? "s" : ""}, ${recurEndAfter} time${recurEndAfter > 1 ? "s" : ""}`}
                {recurType === "weekly" && `Every ${recurEvery} week${recurEvery > 1 ? "s" : ""} on ${
                  recurWeekDays.length === 0 ? "no days selected" :
                  recurWeekDays.map(d => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(", ")
                }, ${recurEndAfter} occurrence${recurEndAfter > 1 ? "s" : ""}`}
                {recurType === "monthly" && recurMonthlyMode === "day-of-month" && `Monthly on the ${recurDayOfMonth}${["st","nd","rd"][recurDayOfMonth-1]||"th"} of the month, ${recurEndAfter} time${recurEndAfter > 1 ? "s" : ""}`}
                {recurType === "monthly" && recurMonthlyMode === "day-of-week" && `Monthly on the ${recurWeekOrdinal} ${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][recurWeekDay]}, ${recurEndAfter} time${recurEndAfter > 1 ? "s" : ""}`}
              </div>
            </div>
          )}

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
