"use client";
import type { EventRecord, LegendRecord } from "@/lib/types";
import {
  buildIcsForEvent,
  downloadIcs,
  fmtDisplay,
  googleCalLink,
  outlookLink,
  yahooLink,
} from "@/lib/calendar-utils";

const ICONS = {
  google: (
    <svg viewBox="0 0 24 24" fill="none" width={20} height={20}>
      <rect x={3} y={5} width={18} height={16} rx={2.5} stroke="#1a73e8" strokeWidth={1.6} />
      <path d="M3 10h18" stroke="#1a73e8" strokeWidth={1.4} />
      <circle cx={12} cy={15} r={2.5} fill="#ea4335" />
      <line x1={7} y1={3} x2={7} y2={7} stroke="#1a73e8" strokeWidth={1.4} strokeLinecap="round" />
      <line x1={17} y1={3} x2={17} y2={7} stroke="#1a73e8" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" fill="#0f172a" width={18} height={18}>
      <path d="M16.7 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.5 3 2.4 1.2-.1 1.6-.8 3.1-.8s1.9.8 3.1.7c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.7-1-2.7-4zM14.4 6c.6-.8 1.1-1.9.9-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z" />
    </svg>
  ),
  outlook: (
    <svg viewBox="0 0 24 24" fill="none" width={20} height={20}>
      <rect x={2} y={6} width={13} height={12} rx={1.5} fill="#0078d4" />
      <text x={8.5} y={14.5} textAnchor="middle" fill="white" fontFamily="Times" fontSize={9} fontWeight={700} fontStyle="italic">
        o
      </text>
      <rect x={15} y={9} width={6} height={6} fill="#28a8ea" />
    </svg>
  ),
  office: (
    <svg viewBox="0 0 24 24" fill="none" width={20} height={20}>
      <path d="M5 4 L19 4 L19 20 L5 20 Z" fill="#d83b01" />
      <path d="M5 4 L13 7 L13 17 L5 20 Z" fill="#ea4300" />
    </svg>
  ),
  yahoo: (
    <svg viewBox="0 0 24 24" width={20} height={20}>
      <text x={12} y={17} textAnchor="middle" fill="#7B0099" fontFamily="serif" fontWeight={800} fontSize={13} fontStyle="italic">
        Y!
      </text>
    </svg>
  ),
  ics: (
    <svg viewBox="0 0 24 24" fill="none" width={18} height={18}>
      <path d="M14 3 L20 9 L20 21 L4 21 L4 3 Z" stroke="#475569" strokeWidth={1.6} strokeLinejoin="round" fill="white" />
      <path d="M14 3 V9 H20" stroke="#475569" strokeWidth={1.6} />
      <text x={12} y={17} textAnchor="middle" fill="#475569" fontFamily="monospace" fontSize={6} fontWeight={700}>
        .ICS
      </text>
    </svg>
  ),
};

type Props = {
  ev: EventRecord;
  isAdmin: boolean;
  legend?: LegendRecord | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function EventDetailModal({ ev, isAdmin, legend, onClose, onEdit, onDelete }: Props) {
  const start = new Date(ev.startsAt);
  const end = ev.endsAt ? new Date(ev.endsAt) : null;
  const calLabel = ev.calendar === "elites" ? "Elites" : "Plats";

  const downloadIcsFile = () => {
    const ics =
      "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//IWT//Calendar//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n" +
      buildIcsForEvent(ev).join("\r\n") +
      "\r\nEND:VCALENDAR";
    const fn = (ev.title || "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".ics";
    downloadIcs(fn, ics);
  };

  const providers = [
    { name: "Google Calendar", icon: ICONS.google, href: googleCalLink(ev) },
    { name: "Apple Calendar", icon: ICONS.apple, onClick: downloadIcsFile },
    { name: "Outlook.com", icon: ICONS.outlook, href: outlookLink(ev, "live") },
    { name: "Office 365", icon: ICONS.office, href: outlookLink(ev, "office") },
    { name: "Yahoo", icon: ICONS.yahoo, href: yahooLink(ev) },
    { name: "Other (.ics)", icon: ICONS.ics, onClick: downloadIcsFile },
  ];

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "8px",
              }}
            >
              <span className={`role-badge ${ev.calendar}`}>
                <span className="dot" />
                {calLabel}
              </span>
              {legend && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 8px", borderRadius: 999,
                  background: `${legend.color}18`, color: legend.color,
                  fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.04em", border: `1px solid ${legend.color}40`,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: legend.color }} />
                  {legend.label}
                </span>
              )}
              {ev.recurrenceGroupId && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 8px", borderRadius: 999,
                  background: "var(--surface-2)", color: "var(--text-3)",
                  fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.04em", border: "1px solid var(--border)",
                }}>
                  🔁 Recurring
                </span>
              )}
              <span style={{ color: "var(--text-4)", fontWeight: 500 }}>
                {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(start)}
              </span>
            </div>
            <div
              style={{
                fontSize: "26px",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
                marginBottom: "16px",
              }}
            >
              {ev.title}
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
          <div
            style={{
              display: "grid",
              gap: "10px",
              padding: "16px",
              background: "var(--surface-2)",
              borderRadius: "var(--r)",
              marginBottom: "16px",
            }}
          >
            <DetailRow icon={<CalendarIcon />} label="When" value={fmtDisplay(start, end, ev.timezone, ev.allDay)} />
            <DetailRow icon={<ClockIcon />} label="Timezone" value={ev.timezone} />
            {ev.location && <DetailRow icon={<PinIcon />} label="Where" value={ev.location} />}
            {ev.url && (
              <DetailRow
                icon={<LinkIcon />}
                label="Link"
                value={
                  <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--info)", textDecoration: "none" }}>
                    {ev.url}
                  </a>
                }
              />
            )}
            {ev.organizer && (
              <DetailRow
                icon={<UserIcon />}
                label="Host"
                value={
                  <span>
                    {ev.organizer}
                    {ev.organizerEmail && (
                      <span style={{ color: "var(--text-4)" }}> · {ev.organizerEmail}</span>
                    )}
                  </span>
                }
              />
            )}
          </div>

          {ev.description && (
            <div
              style={{
                padding: "14px 16px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                fontSize: "13px",
                color: "var(--text-2)",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                marginBottom: "16px",
              }}
            >
              {ev.description}
            </div>
          )}

          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-3)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "8px",
            }}
          >
            Add to your calendar
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            {providers.map((p) =>
              p.href ? (
                <a
                  key={p.name}
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="add-cal-btn"
                  style={addCalBtnStyle}
                >
                  <span style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {p.icon}
                  </span>
                  <span style={{ color: "var(--text)" }}>{p.name}</span>
                </a>
              ) : (
                <button key={p.name} onClick={p.onClick} className="add-cal-btn" style={addCalBtnStyle}>
                  <span style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {p.icon}
                  </span>
                  <span style={{ color: "var(--text)" }}>{p.name}</span>
                </button>
              )
            )}
          </div>
        </div>
        <div className="modal-foot">
          {isAdmin && (
            <div style={{ marginRight: "auto" }}>
              <button className="btn-danger" onClick={onDelete}>
                Delete
              </button>
            </div>
          )}
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {isAdmin && (
            <button className="btn-primary" onClick={onEdit}>
              Edit event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const addCalBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 12px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-sm)",
  cursor: "pointer",
  textDecoration: "none",
  color: "var(--text)",
  fontSize: "13px",
  fontWeight: 500,
  transition: "all 0.15s",
};

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "24px 80px 1fr", gap: "10px", fontSize: "13px" }}>
      <div style={{ color: "var(--text-3)", marginTop: 1 }}>{icon}</div>
      <div style={{ fontWeight: 500, color: "var(--text-3)" }}>{label}</div>
      <div style={{ color: "var(--text)", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <rect x={3} y={4} width={18} height={18} rx={2} ry={2} />
      <line x1={16} y1={2} x2={16} y2={6} />
      <line x1={8} y1={2} x2={8} y2={6} />
      <line x1={3} y1={10} x2={21} y2={10} />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <circle cx={12} cy={12} r={10} />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx={12} cy={10} r={3} />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={16} height={16}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx={12} cy={7} r={4} />
    </svg>
  );
}
