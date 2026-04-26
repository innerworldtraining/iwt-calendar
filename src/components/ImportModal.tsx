"use client";
import { useRef, useState } from "react";
import type { CalendarKey } from "@/lib/types";

type Props = {
  defaultCalendar: CalendarKey;
  onClose: () => void;
  onImported: (result: ImportResult) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
};

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  total: number;
  message: string;
};

export function ImportModal({ defaultCalendar, onClose, onImported, showToast }: Props) {
  const [calendar, setCalendar] = useState<CalendarKey>(defaultCalendar);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return;
    const icsFiles = Array.from(incoming).filter((f) =>
      f.name.endsWith(".ics") || f.type === "text/calendar"
    );
    if (icsFiles.length === 0) {
      showToast("Please select .ics files", "error");
      return;
    }
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...icsFiles.filter((f) => !names.has(f.name))];
    });
  }

  function removeFile(name: string) {
    setFiles((f) => f.filter((x) => x.name !== name));
  }

  async function handleImport() {
    if (files.length === 0) {
      showToast("Please add at least one .ics file", "error");
      return;
    }
    setLoading(true);
    setResult(null);

    let totalImported = 0, totalUpdated = 0, totalSkipped = 0, totalEvents = 0;

    for (const file of files) {
      try {
        const icsContent = await file.text();
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendar, icsContent }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(`${file.name}: ${data.error || "Failed"}`, "error");
          continue;
        }
        totalImported += data.imported || 0;
        totalUpdated += data.updated || 0;
        totalSkipped += data.skipped || 0;
        totalEvents += data.total || 0;
      } catch {
        showToast(`Failed to read ${file.name}`, "error");
      }
    }

    const final: ImportResult = {
      imported: totalImported,
      updated: totalUpdated,
      skipped: totalSkipped,
      total: totalEvents,
      message: `${totalImported} added · ${totalUpdated} updated${totalSkipped > 0 ? ` · ${totalSkipped} skipped` : ""}`,
    };
    setResult(final);
    setLoading(false);
    onImported(final);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !loading && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <div className="modal-title">Import from Google Calendar</div>
            <div className="modal-sub">
              Upload .ics files exported from Google Calendar. Events will be added or updated automatically.
            </div>
          </div>
          <button className="modal-close" onClick={onClose} disabled={loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={14} height={14}>
              <line x1={18} y1={6} x2={6} y2={18} /><line x1={6} y1={6} x2={18} y2={18} />
            </svg>
          </button>
        </div>
        <div className="modal-body">

          {/* Calendar picker */}
          <div className="field">
            <label>Import into calendar</label>
            <div className="seg">
              <button type="button" className={`seg-opt${calendar === "elites" ? " active" : ""}`} onClick={() => setCalendar("elites")}>
                <span className="dot" style={{ background: "var(--elites)" }} />Elites
              </button>
              <button type="button" className={`seg-opt${calendar === "plats" ? " active" : ""}`} onClick={() => setCalendar("plats")}>
                <span className="dot" style={{ background: "var(--plats)" }} />Plats
              </button>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? "var(--primary)" : "var(--border-strong)"}`,
              borderRadius: "var(--r-lg)",
              padding: "28px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragging ? "var(--surface-2)" : "var(--bg)",
              transition: "all 0.2s",
              marginBottom: "14px",
            }}
          >
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>📂</div>
            <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-2)" }}>
              Drop .ics files here
            </div>
            <div style={{ fontSize: "12px", color: "var(--text-4)", marginTop: "4px" }}>
              or click to browse — multiple files supported
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".ics,text/calendar"
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
              {files.map((f) => (
                <div key={f.name} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 12px", background: "var(--surface-2)",
                  borderRadius: "var(--r-sm)", border: "1px solid var(--border)",
                }}>
                  <span style={{ fontSize: "16px" }}>📅</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-4)" }}>
                      {(f.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                    style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: "16px", lineHeight: 1 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{
              padding: "14px 16px",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}>
              <span style={{ fontSize: "22px" }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px" }}>Import complete!</div>
                <div style={{ fontSize: "13px", color: "var(--text-3)", marginTop: "2px" }}>
                  {result.message} · {result.total} events found in {files.length} file{files.length > 1 ? "s" : ""}
                </div>
              </div>
            </div>
          )}

          {/* How to export from Google Calendar */}
          <details style={{ marginTop: "14px" }}>
            <summary style={{ fontSize: "12px", color: "var(--text-4)", cursor: "pointer", userSelect: "none" }}>
              How to export from Google Calendar
            </summary>
            <div style={{ fontSize: "12px", color: "var(--text-3)", marginTop: "8px", lineHeight: 1.6, padding: "10px 12px", background: "var(--surface-2)", borderRadius: "var(--r-sm)" }}>
              1. Open Google Calendar → Settings (⚙️)<br />
              2. Click <strong>Import & Export</strong> in the left sidebar<br />
              3. Click <strong>Export</strong> — downloads a .zip with all your calendars<br />
              4. Unzip and upload the .ics files you want here
            </div>
          </details>
        </div>

        <div className="modal-foot">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={loading || files.length === 0}
            >
              {loading ? `Importing ${files.length} file${files.length > 1 ? "s" : ""}…` : `Import ${files.length > 0 ? `${files.length} file${files.length > 1 ? "s" : ""}` : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
