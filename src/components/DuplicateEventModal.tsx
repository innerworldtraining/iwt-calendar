"use client";
import { useState } from "react";
import type { EventRecord } from "@/lib/types";
import { utcToZonedInput, zonedInputToISO, fmtDisplay } from "@/lib/calendar-utils";

type Props = {
  ev: EventRecord;
  onClose: () => void;
  onConfirm: (newDate: string) => Promise<void>;
};

export function DuplicateEventModal({ ev, onClose, onConfirm }: Props) {
  const [newDate, setNewDate] = useState(() => {
    // Default to same time as original, next day
    const d = new Date(ev.startsAt);
    d.setUTCDate(d.getUTCDate() + 1);
    return utcToZonedInput(d, ev.timezone).slice(0, 10); // date only
  });
  const [loading, setLoading] = useState(false);

  const calLabel = ev.calendar === "elites" ? "Elites" : "Plats";
  const calColor = ev.calendar === "elites" ? "var(--elites)" : "var(--plats)";

  async function handleConfirm() {
    if (!newDate) return;
    setLoading(true);
    await onConfirm(newDate);
    setLoading(false);
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="modal" style={{ maxWidth: "460px" }}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "20px" }}>📋</span>
              <div className="modal-title">Duplicate event</div>
            </div>
            <div className="modal-sub">
              Choose a date to paste a copy of this event.
            </div>
          </div>
          <button className="modal-close" onClick={onClose} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
              <line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Original event summary */}
          <div style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r)",
            padding: "12px 14px",
            marginBottom: "18px",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
          }}>
            <div style={{
              width: "4px", borderRadius: "999px",
              background: calColor, flexShrink: 0, alignSelf: "stretch",
            }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "3px" }}>
                Copying from {calLabel}
              </div>
              <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ev.title}
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-3)" }}>
                {fmtDisplay(
                  new Date(ev.startsAt),
                  ev.endsAt ? new Date(ev.endsAt) : null,
                  ev.timezone,
                  ev.allDay
                )}
              </div>
            </div>
          </div>

          {/* Date picker */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Paste on date <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              autoFocus
              disabled={loading}
              style={{ fontSize: "15px" }}
            />
            <div className="field-help">
              The event time ({ev.allDay ? "all day" : new Date(ev.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}) and all other details will be copied exactly.
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirm}
            disabled={!newDate || loading}
          >
            {loading ? "Duplicating…" : "Duplicate event"}
          </button>
        </div>
      </div>
    </div>
  );
}
