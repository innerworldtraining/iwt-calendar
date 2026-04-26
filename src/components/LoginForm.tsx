"use client";
import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign in failed");
        setLoading(false);
        return;
      }
      // refresh to load the calendar app
      window.location.href = "/";
    } catch (err) {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #eef2f6 100%), radial-gradient(ellipse 800px 400px at 20% 0%, rgba(245, 158, 11, 0.08), transparent), radial-gradient(ellipse 800px 400px at 80% 100%, rgba(139, 92, 246, 0.08), transparent)",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: "40px",
          maxWidth: "440px",
          width: "100%",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
          <img
            src="/mtm-logo.png"
            alt="Mission To Movement"
            style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: "17px", letterSpacing: "-0.01em" }}>
              IWT Calendar
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-4)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, marginTop: "2px" }}>
              Inner World Training
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "4px" }}>
          Sign in
        </h1>
        <p style={{ color: "var(--text-3)", marginBottom: "22px", fontSize: "13px" }}>
          Enter the email address on file with your IWT account.
        </p>

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

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "10px" }}
            disabled={loading}
          >
            {loading ? "Checking access…" : "Continue"}
          </button>
        </form>

        <p
          style={{
            marginTop: "20px",
            fontSize: "11px",
            color: "var(--text-4)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Access is automatic for active Elites and Plats members.
          <br />
          Need help? Email our support at{" "}
          <a
            href="mailto:support@innerworldtraining.com"
            style={{ color: "var(--text-3)", textDecoration: "underline" }}
          >
            support@innerworldtraining.com
          </a>
        </p>
      </div>
    </div>
  );
}
