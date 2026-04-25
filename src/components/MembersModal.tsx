"use client";
import { useEffect, useState } from "react";
import type { AdminRecord } from "@/lib/types";

type Props = {
  currentEmail: string;
  onClose: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
};

function getInitials(name: string, email: string) {
  const source = (name || email).trim();
  const parts = source.split(/[\s@]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function MembersModal({ currentEmail, onClose, showToast }: Props) {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadAdmins() {
    setLoading(true);
    try {
      const res = await fetch("/api/admins");
      const data = await res.json();
      if (res.ok) setAdmins(data.admins || []);
      else showToast(data.error || "Failed to load admins", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(email: string) {
    if (!confirm(`Remove ${email} from admins?`)) return;
    const res = await fetch(`/api/admins/${encodeURIComponent(email)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || "Remove failed", "error");
      return;
    }
    showToast("Admin removed");
    loadAdmins();
  }

  return (
    <>
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-lg">
          <div className="modal-head">
            <div style={{ flex: 1 }}>
              <div className="modal-title">Admins</div>
              <div className="modal-sub">
                Admins can create, edit, and delete events on both calendars. Members are managed in
                ActiveCampaign — anyone with the <code>Client - Elites</code> or <code>Client - Plats</code> tag has access automatically.
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
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "14px",
              }}
            >
              <div style={{ fontSize: "13px", color: "var(--text-3)" }}>
                {loading ? "Loading…" : `${admins.length} admin${admins.length === 1 ? "" : "s"}`}
              </div>
              <button className="btn-secondary" onClick={() => setShowAdd(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}>
                  <line x1={12} y1={5} x2={12} y2={19} />
                  <line x1={5} y1={12} x2={19} y2={12} />
                </svg>
                Add admin
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {admins.map((a) => {
                const isMe = a.email === currentEmail;
                const canRemove = !a.isBootstrap && !isMe;
                return (
                  <div
                    key={a.email}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 12px",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-sm)",
                      background: "white",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "var(--surface-3)",
                        color: "var(--text-2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 600,
                        fontSize: "13px",
                        flexShrink: 0,
                      }}
                    >
                      {getInitials(a.name, a.email)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "13px" }}>
                        {a.email}
                        {isMe && (
                          <span style={{ color: "var(--text-4)", fontWeight: 500, marginLeft: 4 }}>(you)</span>
                        )}
                      </div>
                      {a.name && a.name !== "(Bootstrap admin)" && (
                        <div style={{ fontSize: "12px", color: "var(--text-4)" }}>{a.name}</div>
                      )}
                      {a.isBootstrap && (
                        <div style={{ fontSize: "11px", color: "var(--text-4)", marginTop: 2 }}>
                          Bootstrap admin · set in environment variable, cannot be removed in app
                        </div>
                      )}
                      {!a.isBootstrap && a.addedBy && (
                        <div style={{ fontSize: "11px", color: "var(--text-4)", marginTop: 2 }}>
                          Added by {a.addedBy}
                        </div>
                      )}
                    </div>
                    <span className="role-badge admin">
                      <span className="dot" />
                      admin
                    </span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => handleRemove(a.email)}
                        disabled={!canRemove}
                        title={
                          a.isBootstrap
                            ? "Bootstrap admin — change in environment variables"
                            : isMe
                            ? "You can't remove yourself"
                            : "Remove"
                        }
                        style={{
                          background: "transparent",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          color: canRemove ? "var(--text-3)" : "var(--text-5)",
                          width: "28px",
                          height: "28px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: canRemove ? "pointer" : "not-allowed",
                          opacity: canRemove ? 1 : 0.5,
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={13} height={13}>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {showAdd && (
        <AddAdminModal
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            loadAdmins();
            showToast("Admin added");
          }}
          showToast={showToast}
        />
      )}
    </>
  );
}

function AddAdminModal({
  onClose,
  onAdded,
  showToast,
}: {
  onClose: () => void;
  onAdded: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to add admin");
      setSubmitting(false);
      return;
    }
    onAdded();
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div style={{ flex: 1 }}>
            <div className="modal-title">Add admin</div>
            <div className="modal-sub">
              Promote any email address to admin. They'll get full access on next sign-in.
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
          {error && (
            <div
              style={{
                padding: "10px 12px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                borderRadius: "var(--r-sm)",
                fontSize: "13px",
                marginBottom: "14px",
              }}
            >
              {error}
            </div>
          )}
          <div className="field">
            <label>
              Email <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              placeholder="newadmin@example.com"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Display name (optional)</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name" />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Adding…" : "Add admin"}
          </button>
        </div>
      </div>
    </div>
  );
}
