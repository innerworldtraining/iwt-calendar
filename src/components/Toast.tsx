"use client";

type Props = {
  toast: { msg: string; type: "success" | "error" } | null;
};

export function Toast({ toast }: Props) {
  return (
    <div className={`toast ${toast ? "show" : ""} ${toast?.type === "error" ? "error" : ""}`}>
      <span className="check">{toast?.type === "error" ? "!" : "✓"}</span>
      {toast?.msg || ""}
    </div>
  );
}
