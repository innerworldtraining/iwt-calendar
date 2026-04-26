"use client";
import { useEffect, useState } from "react";
import type { CalendarKey, LegendRecord } from "@/lib/types";

const PALETTE = [
  { color: "#ef4444", name: "Red" },
  { color: "#f97316", name: "Orange" },
  { color: "#f59e0b", name: "Amber" },
  { color: "#eab308", name: "Yellow" },
  { color: "#84cc16", name: "Lime" },
  { color: "#22c55e", name: "Green" },
  { color: "#14b8a6", name: "Teal" },
  { color: "#3b82f6", name: "Blue" },
  { color: "#6366f1", name: "Indigo" },
  { color: "#a855f7", name: "Purple" },
  { color: "#ec4899", name: "Pink" },
  { color: "#6b7280", name: "Grey" },
];

type Props = {
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
};

export function LegendsModal({ onClose, showToast }: Props) {
  const [legends, setLegends] = useState<LegendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CalendarKey>("elites");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadLegends();
  }, []);

  async function loadLegends() {
    setLoading(true);
    try {
      const res = await fetch("/api/legends");
      const data = await res.json();
      if (res.ok) setLegends(data.legends || []);
      else showToast(data.error || "Failed to load legends", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete legend "${label}"? Events using this legend will become uncolored.`)) return;
    const res = await fetch(`/api/legends/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Delete failed", "error");
      return;
    }
    showToast("Legend deleted");
    loadLegends();
  }

  const filtered = legends.filter((l) => l.calendar === activeTab);

  return (
    <>
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-lg">
          <div className="modal-head">
            <div style={{ flex: 1 }}>
              <div className="modal-title">Event Legends</div>
              <div className="modal-sub">
                Create color labels to categorize events. Members see these as a key on the calendar.
              </div>
            </div>
            <button className="modal-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
                <line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            {/* Calendar tabs */}
            <div className="seg" style={{ marginBottom: 16 }}>
              <button
                type="button"
                className={`seg-opt${activeTab === "elites" ? " active" : ""}`}
                onClick={() => setActiveTab("elites")}
              >
                <span className="dot" style={{ background: "var(--elites)" }} />
                Elites
              </button>
              <button
                type="button"
                className={`seg-opt${activeTab === "plats" ? " active" : ""}`}
                onClick={() => setActiveTab("plats")}
              >
                <span className="dot" style={{ background: "var(--plats)" }} />
                Plats
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "var(--text-3)" }}>
                {loading ? "Loading…" : `${filtered.length} legend${filtered.length === 1 ? "" : "s"}`}
              </div>
              <button className="btn-secondary" onClick={() => setShowAdd(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}>
                  <line x1={12} y1={5} x2={12} y2={19} /><line x1={5} y1={12} x2={19} y2={12} />
                </svg>
                Add legend
              </button>
            </div>

            {filtered.length === 0 && !loading && (
              <div style={{
                padding: "32px 16px", textAlign: "center", color: "var(--text-4)",
                fontSize: 13, border: "1px dashed var(--border)", borderRadius: "var(--r)"
              }}>
                No legends yet for {activeTab === "elites" ? "Elites" : "Plats"}.<br />
                Add one to start color-coding your events.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filtered.map((leg) => (
                editingId === leg.id ? (
                  <LegendEditRow
                    key={leg.id}
                    legend={leg}
                    onSave={async (label, color) => {
                      const res = await fetch(`/api/legends/${leg.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ label, color }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        showToast(data.error || "Update failed", "error");
                        return;
                      }
                      showToast("Legend updated");
                      setEditingId(null);
                      loadLegends();
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    key={leg.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", border: "1px solid var(--border)",
                      borderRadius: "var(--r-sm)", background: "var(--surface)",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: leg.color, flexShrink: 0,
                      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)"
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{leg.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-4)", fontFamily: "monospace" }}>{leg.color}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setEditingId(leg.id)}
                        title="Edit"
                        style={iconBtnSm}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}>
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(leg.id, leg.label)}
                        title="Delete"
                        style={{ ...iconBtnSm, color: "var(--danger)" }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {showAdd && (
        <AddLegendModal
          defaultCalendar={activeTab}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            loadLegends();
            showToast("Legend added");
          }}
          showToast={showToast}
        />
      )}
    </>
  );
}

function LegendEditRow({
  legend,
  onSave,
  onCancel,
}: {
  legend: LegendRecord;
  onSave: (label: string, color: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(legend.label);
  const [color, setColor] = useState(legend.color);
  const [saving, setSaving] = useState(false);

  return (
    <div style={{
      padding: "12px", border: "1px solid var(--border-strong)",
      borderRadius: "var(--r-sm)", background: "var(--surface-2)",
    }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{
            flex: 1, background: "var(--surface)", border: "1px solid var(--border)",
            padding: "7px 10px", borderRadius: "var(--r-sm)", fontSize: 13,
          }}
          autoFocus
        />
      </div>
      <ColorPalette selected={color} onSelect={setColor} />
      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
        <button className="btn-secondary" onClick={onCancel} disabled={saving} style={{ padding: "6px 12px", fontSize: 12 }}>
          Cancel
        </button>
        <button
          className="btn-primary"
          disabled={saving || !label.trim()}
          style={{ padding: "6px 12px", fontSize: 12 }}
          onClick={async () => {
            setSaving(true);
            await onSave(label.trim(), color);
            setSaving(false);
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function AddLegendModal({
  defaultCalendar,
  onClose,
  onAdded,
  showToast,
}: {
  defaultCalendar: CalendarKey;
  onClose: () => void;
  onAdded: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [calendar, setCalendar] = useState<CalendarKey>(defaultCalendar);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!label.trim()) { setError("Label is required"); return; }
    setSubmitting(true);
    const res = await fetch("/api/legends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendar, label: label.trim(), color }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed"); setSubmitting(false); return; }
    onAdded();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="modal-title">Add legend</div>
            <div className="modal-sub">Give it a name and pick a color</div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
              <line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div style={{
              padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca",
              color: "#991b1b", borderRadius: "var(--r-sm)", fontSize: 13, marginBottom: 14,
            }}>{error}</div>
          )}
          <div className="field">
            <label>Calendar</label>
            <div className="seg">
              <button type="button" className={`seg-opt${calendar === "elites" ? " active" : ""}`} onClick={() => setCalendar("elites")}>
                <span className="dot" style={{ background: "var(--elites)" }} />Elites
              </button>
              <button type="button" className={`seg-opt${calendar === "plats" ? " active" : ""}`} onClick={() => setCalendar("plats")}>
                <span className="dot" style={{ background: "var(--plats)" }} />Plats
              </button>
            </div>
          </div>
          <div className="field">
            <label>Label <span style={{ color: "var(--danger)" }}>*</span></label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
              placeholder="e.g. Weekly Coaching Call"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Color</label>
            <ColorPalette selected={color} onSelect={setColor} />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting || !label.trim()}>
            {submitting ? "Adding…" : "Add legend"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorPalette({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {PALETTE.map((p) => (
        <button
          key={p.color}
          type="button"
          title={p.name}
          onClick={() => onSelect(p.color)}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: p.color, border: "none", cursor: "pointer",
            boxShadow: selected === p.color
              ? `0 0 0 3px white, 0 0 0 5px ${p.color}`
              : "inset 0 0 0 1px rgba(0,0,0,0.1)",
            transform: selected === p.color ? "scale(1.15)" : "scale(1)",
            transition: "all 0.15s",
          }}
        />
      ))}
    </div>
  );
}

export { ColorPalette, PALETTE };

const iconBtnSm: React.CSSProperties = {
  width: 28, height: 28, background: "transparent",
  border: "1px solid var(--border)", borderRadius: 6,
  color: "var(--text-3)", display: "inline-flex",
  alignItems: "center", justifyContent: "center", cursor: "pointer",
};
