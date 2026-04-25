"use client";
import { useEffect, useMemo, useState } from "react";
import type { CalendarKey, EventRecord, SessionPayload } from "@/lib/types";
import {
  buildIcs,
  buildIcsForEvent,
  dateKeyInZone,
  downloadIcs,
  fmtDisplay,
  fmtTimeShort,
  googleCalLink,
  outlookLink,
  utcToZonedInput,
  yahooLink,
  zonedInputToISO,
} from "@/lib/calendar-utils";
import { EventEditModal } from "./EventEditModal";
import { EventDetailModal } from "./EventDetailModal";
import { MembersModal } from "./MembersModal";
import { Toast } from "./Toast";

type Props = { session: SessionPayload };

const BROWSER_TZ =
  typeof window !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";

export function CalendarApp({ session }: Props) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [currentCalendar, setCurrentCalendar] = useState<CalendarKey>(() => {
    return (session.calendars[0] as CalendarKey) || "elites";
  });

  // modal state
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [creatingEvent, setCreatingEvent] = useState<{ date: Date | null; calendar: CalendarKey } | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // toast
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2200);
  }

  // load events
  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setEvents(data.events || []);
      } else {
        showToast(data.error || "Failed to load events", "error");
      }
    } catch (err) {
      showToast("Network error loading events", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  // Click outside dropdown
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".user-menu-wrap")) setDropdownOpen(false);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // What calendars to show in the grid
  const visibleCals = session.calendars;
  const filterCals: CalendarKey[] = session.isAdmin ? [currentCalendar] : visibleCals;

  // Group events by local date
  const eventsByDay = useMemo(() => {
    const map: Record<string, EventRecord[]> = {};
    for (const ev of events) {
      if (!filterCals.includes(ev.calendar)) continue;
      const start = new Date(ev.startsAt);
      if (isNaN(start.getTime())) continue;
      const key = dateKeyInZone(start, BROWSER_TZ);
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    );
    return map;
  }, [events, filterCals]);

  // Build month grid
  const days = useMemo(() => {
    const firstOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const dayOfWeek = firstOfMonth.getDay();
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(firstOfMonth.getDate() - dayOfWeek);
    const arr: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, [currentMonth]);

  const todayKey = dateKeyInZone(new Date(), BROWSER_TZ);
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long" }).format(currentMonth);
  const year = currentMonth.getFullYear();

  // Event create / edit / delete
  async function handleSaveEvent(payload: any, isEdit: boolean, eventId?: string) {
    try {
      const url = isEdit ? `/api/events/${eventId}` : "/api/events";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Save failed", "error");
        return false;
      }
      showToast(isEdit ? "Event updated" : "Event created");
      setEditingEvent(null);
      setCreatingEvent(null);
      // Switch calendar tab if admin created on the other tab
      if (session.isAdmin && data.event?.calendar && data.event.calendar !== currentCalendar) {
        setCurrentCalendar(data.event.calendar);
      }
      await loadEvents();
      return true;
    } catch (err) {
      showToast("Network error", "error");
      return false;
    }
  }

  async function handleDeleteEvent(ev: EventRecord) {
    if (!confirm(`Delete "${ev.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/events/${ev.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Delete failed", "error");
        return;
      }
      showToast("Event deleted");
      setSelectedEvent(null);
      await loadEvents();
    } catch (err) {
      showToast("Network error", "error");
    }
  }

  function exportSubscription() {
    const list = events.filter((e) => filterCals.includes(e.calendar));
    if (list.length === 0) {
      showToast("No events to export", "error");
      return;
    }
    const calLabel = filterCals[0] === "elites" ? "Elites" : "Plats";
    const ics = buildIcs(list, `IWT Calendar · ${calLabel}`);
    const fn = `iwt-calendar-${filterCals.join("-")}-${new Date().toISOString().slice(0, 10)}.ics`;
    downloadIcs(fn, ics);
    showToast(`Downloaded ${list.length} events`);
  }

  const initials = (() => {
    const parts = (session.name || session.email).split(/[\s@]+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  const showCalendarTabs = visibleCals.length > 1 || session.isAdmin;

  return (
    <div style={{ minHeight: "100vh", display: "grid", gridTemplateRows: "auto auto 1fr" }}>
      {/* TOP NAV */}
      <header
        style={{
          background: "white",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "60px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                background: "var(--primary)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
                fontSize: "14px",
                letterSpacing: "-0.04em",
              }}
            >
              I
            </div>
            <div style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "-0.01em" }}>
              IWT Calendar
            </div>
          </div>
          {showCalendarTabs && (
            <div
              style={{
                display: "flex",
                background: "var(--surface-2)",
                padding: "4px",
                borderRadius: "var(--r)",
                gap: "2px",
              }}
            >
              {visibleCals.map((cal) => (
                <button
                  key={cal}
                  onClick={() => setCurrentCalendar(cal)}
                  style={{
                    background: cal === currentCalendar ? "white" : "none",
                    border: "none",
                    padding: "6px 14px",
                    fontSize: "13px",
                    fontWeight: cal === currentCalendar ? 600 : 500,
                    color: cal === currentCalendar ? "var(--text)" : "var(--text-3)",
                    borderRadius: "7px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: cal === currentCalendar ? "var(--shadow-xs)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: cal === "elites" ? "var(--elites)" : "var(--plats)",
                    }}
                  />
                  {cal === "elites" ? "Elites" : "Plats"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {session.isAdmin && (
            <button
              onClick={() => setShowMembers(true)}
              title="Manage admins"
              style={iconBtn}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={16} height={16}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx={9} cy={7} r={4} />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </button>
          )}
          <div className="user-menu-wrap" style={{ position: "relative" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(!dropdownOpen);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "4px 12px 4px 4px",
                background: "white",
                border: "1px solid var(--border)",
                borderRadius: "999px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "var(--surface-3)",
                  color: "var(--text-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: "12px",
                }}
              >
                {initials}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{session.name}</div>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                style={{ width: "13px", height: "13px", color: "var(--text-4)", marginRight: "2px" }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  minWidth: "240px",
                  background: "white",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r)",
                  boxShadow: "var(--shadow-lg)",
                  padding: "6px",
                  zIndex: 50,
                }}
              >
                <div style={{ padding: "10px 12px 12px", borderBottom: "1px solid var(--border-soft)", marginBottom: "4px" }}>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>{session.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--text-4)", marginTop: "2px" }}>
                    {session.email}
                  </div>
                  <div style={{ marginTop: "6px", display: "flex", gap: "4px" }}>
                    {session.isAdmin && (
                      <span className="role-badge admin">
                        <span className="dot" />
                        admin
                      </span>
                    )}
                    {!session.isAdmin &&
                      session.calendars.map((c) => (
                        <span key={c} className={`role-badge ${c}`}>
                          <span className="dot" />
                          {c}
                        </span>
                      ))}
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "8px 12px",
                    width: "100%",
                    textAlign: "left",
                    fontSize: "13px",
                    color: "var(--danger)",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1={21} y1={12} x2={9} y2={12} />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* SUB NAV */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid var(--border)",
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button className="btn-secondary" onClick={() => setCurrentMonth(new Date())}>
            Today
          </button>
          <button
            style={navArrow}
            onClick={() =>
              setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
            }
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              padding: "0 12px",
              minWidth: "180px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>{monthName}</span>
            <span style={{ color: "var(--text-4)", fontWeight: 500 }}>{year}</span>
          </div>
          <button
            style={navArrow}
            onClick={() =>
              setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
            }
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button className="btn-secondary" onClick={exportSubscription}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1={12} y1={15} x2={12} y2={3} />
            </svg>
            Subscribe
          </button>
          {session.isAdmin && (
            <button
              className="btn-primary"
              onClick={() => setCreatingEvent({ date: null, calendar: currentCalendar })}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} width={14} height={14}>
                <line x1={12} y1={5} x2={12} y2={19} />
                <line x1={5} y1={12} x2={19} y2={12} />
              </svg>
              New event
            </button>
          )}
        </div>
      </div>

      {/* MAIN */}
      <main style={{ padding: "24px", maxWidth: "1400px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        {!session.isAdmin && (
          <div
            style={{
              background:
                session.calendars[0] === "elites"
                  ? "linear-gradient(135deg, var(--elites-soft), white)"
                  : "linear-gradient(135deg, var(--plats-soft), white)",
              border: `1px solid ${session.calendars[0] === "elites" ? "var(--elites-bg)" : "var(--plats-bg)"}`,
              borderRadius: "var(--r)",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              fontSize: "13px",
              color:
                session.calendars[0] === "elites" ? "var(--elites-text)" : "var(--plats-text)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={18} height={18} style={{ flexShrink: 0 }}>
              <circle cx={12} cy={12} r={10} />
              <line x1={12} y1={16} x2={12} y2={12} />
              <line x1={12} y1={8} x2={12.01} y2={8} />
            </svg>
            <div>
              <strong>
                {session.calendars.length > 1
                  ? "Member access."
                  : `${session.calendars[0] === "elites" ? "Elites" : "Plats"} member access.`}
              </strong>{" "}
              You're viewing your member calendar. Click any event to add it to your personal calendar.
            </div>
          </div>
        )}

        {/* CALENDAR CARD */}
        <div
          style={{
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Day headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <div
                key={d}
                style={{
                  padding: "12px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  borderRight: i < 6 ? "1px solid var(--border-soft)" : "none",
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gridAutoRows: "minmax(110px, 1fr)",
            }}
          >
            {days.map((day, i) => {
              const inMonth = day.getMonth() === currentMonth.getMonth();
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const key = dateKeyInZone(day, BROWSER_TZ);
              const isToday = key === todayKey;
              const dayEvents = eventsByDay[key] || [];
              const lastCol = i % 7 === 6;
              const lastRow = i >= 35;

              const bg = inMonth ? (isWeekend ? "#fcfcfd" : "white") : isWeekend ? "#f8f8fa" : "#fafafa";

              return (
                <div
                  key={i}
                  onClick={() => {
                    if (session.isAdmin) {
                      setCreatingEvent({ date: day, calendar: currentCalendar });
                    }
                  }}
                  style={{
                    borderRight: lastCol ? "none" : "1px solid var(--border-soft)",
                    borderBottom: lastRow ? "none" : "1px solid var(--border-soft)",
                    padding: "8px",
                    minHeight: "110px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "3px",
                    cursor: session.isAdmin ? "pointer" : "default",
                    background: bg,
                    transition: "background 0.1s",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: inMonth ? "var(--text-2)" : "var(--text-5)",
                      lineHeight: 1,
                      width: "24px",
                      height: "24px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      marginBottom: "2px",
                      ...(isToday
                        ? { background: "var(--primary)", color: "white" }
                        : {}),
                    }}
                  >
                    {day.getDate()}
                  </div>

                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(ev);
                      }}
                      title={ev.title}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "white",
                        cursor: "pointer",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        border: "none",
                        width: "100%",
                        textAlign: "left",
                        lineHeight: 1.3,
                        background: ev.calendar === "elites" ? "var(--elites)" : "var(--plats)",
                      }}
                    >
                      {!ev.allDay && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono, monospace)",
                            fontSize: "10px",
                            opacity: 0.85,
                            fontWeight: 500,
                          }}
                        >
                          {fmtTimeShort(new Date(ev.startsAt), BROWSER_TZ)}
                        </span>
                      )}
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ev.title}
                      </span>
                    </button>
                  ))}

                  {dayEvents.length > 3 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // open the first one as a sample, or create a day list — for now open first
                        setSelectedEvent(dayEvents[3]);
                      }}
                      style={{
                        background: "transparent",
                        color: "var(--text-3)",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        borderRadius: "4px",
                      }}
                    >
                      + {dayEvents.length - 3} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              background: "white",
              borderTop: "1px solid var(--border)",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "var(--text-3)",
              fontSize: "12px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", gap: "16px" }}>
              {visibleCals.includes("elites") && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "var(--elites)" }} />
                  Elites
                </div>
              )}
              {visibleCals.includes("plats") && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "var(--plats)" }} />
                  Plats
                </div>
              )}
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                background: "var(--surface-2)",
                borderRadius: "999px",
                fontFamily: "monospace",
                fontSize: "11px",
                color: "var(--text-2)",
              }}
            >
              {BROWSER_TZ}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "20px", color: "var(--text-4)", fontSize: "13px" }}>
            Loading events…
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedEvent && (
        <EventDetailModal
          ev={selectedEvent}
          isAdmin={session.isAdmin}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => {
            setEditingEvent(selectedEvent);
            setSelectedEvent(null);
          }}
          onDelete={() => handleDeleteEvent(selectedEvent)}
        />
      )}
      {(editingEvent || creatingEvent) && (
        <EventEditModal
          existing={editingEvent}
          defaultCalendar={editingEvent?.calendar || creatingEvent?.calendar || currentCalendar}
          defaultDate={creatingEvent?.date || null}
          browserTz={BROWSER_TZ}
          onClose={() => {
            setEditingEvent(null);
            setCreatingEvent(null);
          }}
          onSave={async (payload) => {
            return handleSaveEvent(payload, !!editingEvent, editingEvent?.id);
          }}
        />
      )}
      {showMembers && session.isAdmin && (
        <MembersModal
          currentEmail={session.email}
          onClose={() => setShowMembers(false)}
          showToast={showToast}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: "36px",
  height: "36px",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-sm)",
  color: "var(--text-2)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.15s",
};

const navArrow: React.CSSProperties = {
  width: "32px",
  height: "32px",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-sm)",
  color: "var(--text-2)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};
