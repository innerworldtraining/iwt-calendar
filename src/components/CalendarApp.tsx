"use client";
import { useEffect, useMemo, useState } from "react";
import type { CalendarKey, EventRecord, LegendRecord, SessionPayload } from "@/lib/types";
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
import { LegendsModal } from "./LegendsModal";
import { ImportModal } from "./ImportModal";
import { ClearMonthModal } from "./ClearMonthModal";
import { ClearUpcomingModal } from "./ClearUpcomingModal";
import { Toast } from "./Toast";

type ThemeKey = "light" | "dark";
type ThemeMap = { elites: ThemeKey; plats: ThemeKey };

function loadThemes(): ThemeMap {
  if (typeof window === "undefined") return { elites: "light", plats: "light" };
  return {
    elites: (localStorage.getItem("iwt_theme_elites") as ThemeKey) || "light",
    plats: (localStorage.getItem("iwt_theme_plats") as ThemeKey) || "light",
  };
}

function applyTheme(cal: CalendarKey, theme: ThemeKey) {
  const el = document.documentElement;
  el.classList.remove("dark-elites", "dark-plats");
  if (theme === "dark") {
    el.classList.add(cal === "elites" ? "dark-elites" : "dark-plats");
  }
}

const BROWSER_TZ =
  typeof window !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";

type Props = { session: SessionPayload };

export function CalendarApp({ session }: Props) {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [legends, setLegends] = useState<LegendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [themes, setThemes] = useState<ThemeMap>({ elites: "light", plats: "light" });
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [currentCalendar, setCurrentCalendar] = useState<CalendarKey>(() => {
    return (session.calendars[0] as CalendarKey) || "elites";
  });

  // modal state
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [creatingEvent, setCreatingEvent] = useState<{ date: Date | null; calendar: CalendarKey } | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showLegends, setShowLegends] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showClearMonth, setShowClearMonth] = useState(false);
  const [showClearUpcoming, setShowClearUpcoming] = useState(false);
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
    loadLegends();
    // Load saved themes and apply current calendar's theme
    const saved = loadThemes();
    setThemes(saved);
    const initCal = (session.calendars[0] as CalendarKey) || "elites";
    applyTheme(initCal, saved[initCal]);
  }, []);

  function toggleTheme() {
    const next: ThemeKey = themes[currentCalendar] === "light" ? "dark" : "light";
    const updated = { ...themes, [currentCalendar]: next };
    setThemes(updated);
    localStorage.setItem(`iwt_theme_${currentCalendar}`, next);
    applyTheme(currentCalendar, next);
  }

  async function loadLegends() {
    try {
      const res = await fetch("/api/legends", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setLegends(data.legends || []);
    } catch { /* non-critical */ }
  }

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
          background: "var(--surface)",
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
            {/* MTM Logo */}
            <img
              src="/mtm-logo.png"
              alt="Mission To Movement"
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: "15px", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
                IWT Calendar
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-4)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
                Inner World Training
              </div>
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
                  onClick={() => {
                    setCurrentCalendar(cal);
                    applyTheme(cal, themes[cal]);
                  }}
                  style={{
                    background: cal === currentCalendar ? "var(--surface)" : "none",
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
          {/* Welcome Legend text */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 12px",
              background: currentCalendar === "elites"
                ? "linear-gradient(135deg, var(--elites-bg), transparent)"
                : "linear-gradient(135deg, var(--plats-bg), transparent)",
              borderRadius: "999px",
              border: `1px solid ${currentCalendar === "elites" ? "var(--elites-bg)" : "var(--plats-bg)"}`,
              fontSize: "12px",
              fontWeight: 600,
              color: currentCalendar === "elites" ? "var(--elites-text)" : "var(--plats-text)",
              letterSpacing: "0.01em",
              transition: "all 0.3s ease",
            }}
          >
            <span style={{ fontSize: "14px" }}>👋</span>
            Welcome, Legend{session.name ? ` ${session.name.split(" ")[0]}` : ""}!
          </div>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={themes[currentCalendar] === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              ...iconBtn,
              background: themes[currentCalendar] === "dark" ? "var(--surface-3)" : "transparent",
              color: themes[currentCalendar] === "dark"
                ? (currentCalendar === "elites" ? "var(--elites)" : "var(--plats)")
                : "var(--text-2)",
              transition: "all 0.2s",
            }}
          >
            {themes[currentCalendar] === "dark" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={16} height={16}>
                <circle cx={12} cy={12} r={5} />
                <line x1={12} y1={1} x2={12} y2={3} />
                <line x1={12} y1={21} x2={12} y2={23} />
                <line x1={4.22} y1={4.22} x2={5.64} y2={5.64} />
                <line x1={18.36} y1={18.36} x2={19.78} y2={19.78} />
                <line x1={1} y1={12} x2={3} y2={12} />
                <line x1={21} y1={12} x2={23} y2={12} />
                <line x1={4.22} y1={19.78} x2={5.64} y2={18.36} />
                <line x1={18.36} y1={5.64} x2={19.78} y2={4.22} />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={16} height={16}>
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
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
          {session.isAdmin && (
            <button
              onClick={() => setShowLegends(true)}
              title="Manage legends"
              style={iconBtn}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={16} height={16}>
                <circle cx={12} cy={12} r={3} fill="currentColor" />
                <circle cx={6} cy={8} r={2} fill="currentColor" opacity={0.6} />
                <circle cx={18} cy={8} r={2} fill="currentColor" opacity={0.6} />
                <circle cx={6} cy={16} r={2} fill="currentColor" opacity={0.4} />
                <circle cx={18} cy={16} r={2} fill="currentColor" opacity={0.4} />
              </svg>
            </button>
          )}
          {session.isAdmin && (
            <button
              onClick={() => setShowImport(true)}
              title="Import from Google Calendar (.ics)"
              style={iconBtn}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={16} height={16}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1={12} y1={3} x2={12} y2={15} />
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
                background: "var(--surface)",
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
                  background: "var(--surface)",
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
          background: "var(--surface)",
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
              onClick={() => setShowClearMonth(true)}
              style={{
                ...navArrow,
                width: "auto",
                padding: "7px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--danger)",
                borderColor: "var(--border)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
              title={`Clear all ${monthName} ${year} events`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}>
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Clear {monthName}
            </button>
          )}
          {session.isAdmin && (
            <button
              onClick={() => setShowClearUpcoming(true)}
              style={{
                ...navArrow,
                width: "auto",
                padding: "7px 12px",
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--danger)",
                borderColor: "#fecaca",
                background: "#fef2f2",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
              title="Delete all upcoming events"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}>
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1={10} y1={11} x2={10} y2={17}/>
                <line x1={14} y1={11} x2={14} y2={17}/>
              </svg>
              Delete All Upcoming
            </button>
          )}
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
                  ? "linear-gradient(135deg, var(--elites-soft), var(--surface))"
                  : "linear-gradient(135deg, var(--plats-soft), var(--surface))",
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
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {/* Horizontal scroll wrapper for small screens — guarantees alignment */}
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as any }}>
            <div style={{ minWidth: "420px" }}>
              {/* SINGLE UNIFIED GRID — headers + cells share one grid so they never drift */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>

                {/* Day headers */}
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                  <div
                    key={d}
                    style={{
                      padding: "10px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--text-3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid var(--border)",
                      borderRight: i < 6 ? "1px solid var(--border-soft)" : "none",
                      background: "var(--surface)",
                    }}
                  >
                    {d}
                  </div>
                ))}

                {/* Day cells */}
                {days.map((day, i) => {
                  const inMonth = day.getMonth() === currentMonth.getMonth();
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const key = dateKeyInZone(day, BROWSER_TZ);
                  const isToday = key === todayKey;
                  const dayEvents = eventsByDay[key] || [];
                  const lastCol = i % 7 === 6;
                  const lastRow = i >= 35;

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
                        padding: "6px",
                        minHeight: "90px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                        cursor: session.isAdmin ? "pointer" : "default",
                        background: inMonth
                          ? isWeekend ? "var(--surface-2)" : "var(--surface)"
                          : "var(--bg)",
                        transition: "background 0.1s",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: inMonth ? "var(--text-2)" : "var(--text-5)",
                          lineHeight: 1,
                          width: "22px",
                          height: "22px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          marginBottom: "2px",
                          flexShrink: 0,
                          ...(isToday
                            ? { background: "var(--primary)", color: "white" }
                            : {}),
                        }}
                      >
                        {day.getDate()}
                      </div>

                      {dayEvents.slice(0, 3).map((ev) => {
                        const legend = ev.legendId ? legends.find((l) => l.id === ev.legendId) : null;
                        const pillColor = legend
                          ? legend.color
                          : ev.calendar === "elites"
                          ? "var(--elites)"
                          : "var(--plats)";
                        return (
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
                              gap: "4px",
                              padding: "2px 6px",
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
                              lineHeight: 1.4,
                              background: pillColor,
                              flexShrink: 0,
                            }}
                          >
                            {!ev.allDay && (
                              <span className="pill-time-sm" style={{ fontFamily: "monospace", fontSize: "10px", opacity: 0.85, fontWeight: 500, flexShrink: 0 }}>
                                {fmtTimeShort(new Date(ev.startsAt), BROWSER_TZ)}
                              </span>
                            )}
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {ev.title}
                            </span>
                          </button>
                        );
                      })}

                      {dayEvents.length > 3 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(dayEvents[3]);
                          }}
                          style={{
                            background: "transparent",
                            color: "var(--text-3)",
                            fontSize: "10px",
                            fontWeight: 600,
                            padding: "1px 6px",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                            borderRadius: "4px",
                          }}
                        >
                          +{dayEvents.length - 3} more
                        </button>
                      )}
                    </div>
                  );
                })}

              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              background: "var(--surface)",
              borderTop: "1px solid var(--border)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              color: "var(--text-3)",
              fontSize: "12px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Legend key only — no calendar labels */}
              {(() => {
                const visibleLegends = legends.filter((l) => filterCals.includes(l.calendar));
                if (visibleLegends.length === 0) return null;
                return (
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    {visibleLegends.map((leg) => (
                      <div key={leg.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: leg.color }} />
                        {leg.label}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Right side: timezone + IWT branding */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
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

              {/* IWT branding */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <img
                  src="/mtm-logo.png"
                  alt="IWT"
                  style={{ width: "20px", height: "20px", borderRadius: "50%", opacity: 0.6 }}
                />
                <span style={{ fontSize: "11px", color: "var(--text-4)", fontWeight: 500 }}>
                  Inner World Training
                </span>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div
            style={{
              background: "var(--surface-2)",
              borderTop: "1px solid var(--border)",
              padding: "10px 16px",
              fontSize: "11px",
              color: "var(--text-4)",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            This calendar is exclusively for active Inner World Training program members.
            Unauthorized access or sharing of calendar content is strictly prohibited.
            © {new Date().getFullYear()} Inner World Training · All rights reserved.
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
          legend={selectedEvent.legendId ? legends.find((l) => l.id === selectedEvent.legendId) : null}
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
          legends={legends}
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
      {showLegends && session.isAdmin && (
        <LegendsModal
          onClose={() => { setShowLegends(false); loadLegends(); }}
          showToast={showToast}
        />
      )}
      {showImport && session.isAdmin && (
        <ImportModal
          defaultCalendar={currentCalendar}
          onClose={() => setShowImport(false)}
          onImported={async (result) => {
            showToast(result.message);
            await loadEvents();
          }}
          showToast={showToast}
        />
      )}
      {showClearMonth && session.isAdmin && (
        <ClearMonthModal
          calendar={currentCalendar}
          month={currentMonth.getMonth() + 1}
          year={currentMonth.getFullYear()}
          eventCount={
            Object.values(eventsByDay)
              .flat()
              .filter(
                (ev) =>
                  ev.calendar === currentCalendar &&
                  new Date(ev.startsAt).getMonth() === currentMonth.getMonth() &&
                  new Date(ev.startsAt).getFullYear() === currentMonth.getFullYear()
              ).length
          }
          onClose={() => setShowClearMonth(false)}
          onConfirm={async () => {
            const res = await fetch(
              `/api/events/clear-month?calendar=${currentCalendar}&year=${currentMonth.getFullYear()}&month=${currentMonth.getMonth() + 1}`,
              { method: "DELETE" }
            );
            const data = await res.json();
            if (!res.ok) {
              showToast(data.error || "Failed to clear", "error");
            } else {
              showToast(data.message);
              setShowClearMonth(false);
              await loadEvents();
            }
          }}
        />
      )}
      {showClearUpcoming && session.isAdmin && (
        <ClearUpcomingModal
          calendar={currentCalendar}
          upcomingCount={
            events.filter(
              (ev) =>
                ev.calendar === currentCalendar &&
                new Date(ev.startsAt) >= new Date(new Date().setUTCHours(0, 0, 0, 0))
            ).length
          }
          onClose={() => setShowClearUpcoming(false)}
          onConfirm={async () => {
            const res = await fetch(
              `/api/events/clear-upcoming?calendar=${currentCalendar}`,
              { method: "DELETE" }
            );
            const data = await res.json();
            if (!res.ok) {
              showToast(data.error || "Failed to delete", "error");
            } else {
              showToast(data.message);
              setShowClearUpcoming(false);
              await loadEvents();
            }
          }}
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
