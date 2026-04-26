"use client";
import { useState } from "react";
import type { CalendarKey } from "@/lib/types";

type Props = {
  calendar: CalendarKey;
  month: number; // 1-12
  year: number;
  eventCount: number;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function ClearMonthModal({ calendar, month, year, eventCount, onClose, onConfirm }: Props) {
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmed = typed.trim().toUpperCase() === "DELETE";
  const monthName = MONTH_NAMES[month - 1];
  const calLabel = calendar === "elites" ? "Elites" : "Plats";

  async function handleConfirm() {
    if (!confirmed) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div className="modal" style={{ maxWidth: "480px" }}>
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: "#fef2f2", border: "1px solid #fecaca",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} width={18} height={18}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1={12} y1={9} x2={12} y2={13}/>
                  <line x1={12} y1={17} x2={12.01} y2={17}/>
                </svg>
              </div>
              <div className="modal-title" style={{ color: "#dc2626" }}>
                Clear month events
              </div>
            </div>
            <div className="modal-sub">
              This action is <strong>permanent</strong> and cannot be undone.
            </div>
          </div>
          <button className="modal-close" onClick={onClose} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
              <line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Warning banner */}
          <div style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "var(--r)",
            padding: "14px 16px",
            marginBottom: "20px",
            fontSize: "13px",
            color: "#7f1d1d",
            lineHeight: 1.6,
          }}>
            ⚠️ <strong>Warning!</strong> This will permanently delete{" "}
            <strong>
              {eventCount > 0
                ? `all ${eventCount} event${eventCount === 1 ? "" : "s"}`
                : "all events"}
            </strong>{" "}
            from the <strong>{calLabel} calendar</strong> for{" "}
            <strong>{monthName} {year}</strong>.
            <br /><br />
            Events imported from Google Calendar, manually created events, and any events with legends will all be removed. There is no undo.
          </div>

          {/* Typing confirmation */}
          <div className="field" style={{ marginBottom: 0 }}>
            <label style={{ color: "var(--text-2)" }}>
              Type <span style={{
                fontFamily: "monospace",
                background: "var(--surface-2)",
                padding: "1px 6px",
                borderRadius: "4px",
                letterSpacing: "0.05em",
                fontWeight: 700,
                color: "#dc2626",
              }}>DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type DELETE here"
              autoFocus
              disabled={loading}
              style={{
                fontFamily: "monospace",
                fontSize: "15px",
                letterSpacing: "0.05em",
                borderColor: confirmed ? "#dc2626" : undefined,
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && confirmed) handleConfirm(); }}
            />
            {typed.length > 0 && !confirmed && (
              <div style={{ fontSize: "12px", color: "var(--text-4)", marginTop: "4px" }}>
                Keep typing — must be exactly DELETE in capitals
              </div>
            )}
            {confirmed && (
              <div style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px", fontWeight: 600 }}>
                ✓ Confirmed — you may now proceed
              </div>
            )}
          </div>
        </div>

        <div className="modal-foot" style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            disabled={!confirmed || loading}
            onClick={handleConfirm}
            style={{
              background: confirmed ? "#dc2626" : "var(--surface-3)",
              color: confirmed ? "white" : "var(--text-4)",
              border: "none",
              padding: "8px 16px",
              borderRadius: "var(--r-sm)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: confirmed ? "pointer" : "not-allowed",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Deleting…" : `Delete ${eventCount > 0 ? eventCount : ""} event${eventCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
