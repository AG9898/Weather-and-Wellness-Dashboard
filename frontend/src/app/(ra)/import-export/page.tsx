"use client";

import { useState, useCallback, useRef } from "react";
import type { DragEvent } from "react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/lib/components/PageContainer";
import { cn } from "@/lib/utils";
import {
  importPreview,
  importCommit,
  exportXlsx,
  exportZip,
  ApiError,
  type ImportPreviewResponse,
  type ImportCommitResponse,
} from "@/lib/api";

// ── Helpers ──

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function raErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session has expired. Please sign in again.";
    if (err.status >= 500) return "A server error occurred. Please try again.";
    return err.message || "An unexpected error occurred.";
  }
  return "Unable to connect to the server. Please check your connection.";
}

// ── Import state machine ──

type ImportPhase =
  | { tag: "idle" }
  | { tag: "previewing" }
  | { tag: "preview"; data: ImportPreviewResponse }
  | { tag: "committing"; data: ImportPreviewResponse }
  | { tag: "committed"; result: ImportCommitResponse };

// ── Sub-components ──

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 px-3 py-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="font-mono text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// ── Page ──

export default function ImportExportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<ImportPhase>({ tag: "idle" });
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setPhase({ tag: "previewing" });
    setImportError(null);
    try {
      const data = await importPreview(f);
      setPhase({ tag: "preview", data });
    } catch (err) {
      setPhase({ tag: "idle" });
      setImportError(raErrorMessage(err));
    }
  }, []);

  const handleFileDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleCommit = useCallback(async () => {
    if (!file || phase.tag !== "preview") return;
    const snapshot = phase.data;
    setPhase({ tag: "committing", data: snapshot });
    setImportError(null);
    try {
      const result = await importCommit(file);
      setPhase({ tag: "committed", result });
    } catch (err) {
      setPhase({ tag: "idle" });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setImportError(raErrorMessage(err));
    }
  }, [file, phase]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPhase({ tag: "idle" });
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleExportXlsx = useCallback(async () => {
    setXlsxLoading(true);
    setExportError(null);
    try {
      const { blob, filename } = await exportXlsx();
      triggerDownload(blob, filename);
    } catch (err) {
      setExportError(raErrorMessage(err));
    } finally {
      setXlsxLoading(false);
    }
  }, []);

  const handleExportZip = useCallback(async () => {
    setZipLoading(true);
    setExportError(null);
    try {
      const { blob, filename } = await exportZip();
      triggerDownload(blob, filename);
    } catch (err) {
      setExportError(raErrorMessage(err));
    } finally {
      setZipLoading(false);
    }
  }, []);

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-foreground mb-8">Import / Export</h1>

      {/* ── Import ── */}
      <section className="rounded-2xl border border-border bg-card p-6 mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Import
        </p>

        {phase.tag === "committed" ? (
          /* Success summary */
          <div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 mb-4">
              <p className="font-medium text-emerald-700 dark:text-emerald-300 mb-2">Import complete</p>
              <ul className="text-sm text-emerald-700/85 dark:text-emerald-200/85 space-y-1">
                <li>Rows processed: {phase.result.rows_total}</li>
                <li>Participants created: {phase.result.participants_created}</li>
                <li>Participants updated: {phase.result.participants_updated}</li>
                <li>Sessions created: {phase.result.sessions_created}</li>
                <li>Sessions updated: {phase.result.sessions_updated}</li>
              </ul>
            </div>
            <Button
              type="button"
              onClick={handleReset}
              variant="ghost"
              size="sm"
              className="h-auto px-1 text-sm text-muted-foreground"
            >
              Import another file
            </Button>
          </div>
        ) : (
          <>
            {/* Drop zone */}
            <div
              role="button"
              tabIndex={0}
              aria-label="File upload area. Drop a CSV or XLSX file here, or press Enter to browse."
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isDragOver
                  ? "border-ring bg-ring/5"
                  : "border-border hover:border-ring/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {file ? (
                <div>
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReset();
                    }}
                    variant="link"
                    size="xs"
                    className="mt-2 h-auto p-0 text-xs text-muted-foreground"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <>
                  <p className="font-medium text-foreground">Drop a CSV or XLSX file here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                </>
              )}
            </div>

            {/* Import error */}
            {importError && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{importError}</p>
              </div>
            )}

            {/* Previewing spinner */}
            {phase.tag === "previewing" && (
              <p className="mt-4 text-sm text-muted-foreground">Generating preview…</p>
            )}

            {/* Preview + commit panel */}
            {(phase.tag === "preview" || phase.tag === "committing") && (
              <div className="mt-4 space-y-4">
                {/* Count tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <CountTile
                    label="Participants to create"
                    value={phase.data.participants_create}
                  />
                  <CountTile
                    label="Participants to update"
                    value={phase.data.participants_update}
                  />
                  <CountTile
                    label="Sessions to create"
                    value={phase.data.sessions_create}
                  />
                  <CountTile
                    label="Sessions to update"
                    value={phase.data.sessions_update}
                  />
                </div>

                {/* Errors */}
                {phase.data.errors.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm font-medium text-destructive mb-2">
                      {phase.data.errors.length} error
                      {phase.data.errors.length !== 1 ? "s" : ""} — fix these before
                      importing
                    </p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                      {phase.data.errors.map((e, i) => (
                        <li key={i} className="text-xs text-destructive/80">
                          Row {e.row}
                          {e.field ? ` · ${e.field}` : ""}: {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {phase.data.warnings.length > 0 && (
                  <div className="rounded-lg border border-ring/35 bg-ring/10 p-4">
                    <p className="mb-2 text-sm font-medium text-foreground">
                      {phase.data.warnings.length} warning
                      {phase.data.warnings.length !== 1 ? "s" : ""}
                    </p>
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {phase.data.warnings.map((w, i) => (
                        <li key={i} className="text-xs text-muted-foreground">
                          Row {w.row}
                          {w.field ? ` · ${w.field}` : ""}: {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Confirm button */}
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={handleCommit}
                    disabled={
                      phase.tag === "committing" || phase.data.errors.length > 0
                    }
                    className="rounded-xl px-4 text-primary-foreground"
                    style={{
                      background: "linear-gradient(135deg, var(--ubc-blue-700), var(--ubc-blue-600))",
                    }}
                  >
                    {phase.tag === "committing" ? "Importing…" : "Confirm Import"}
                  </Button>
                  {phase.data.errors.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Resolve all errors before confirming.
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Export ── */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Export
        </p>

        {exportError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{exportError}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={handleExportXlsx}
            disabled={xlsxLoading}
            className="rounded-xl px-4 text-primary-foreground"
            style={{
              background: "linear-gradient(135deg, var(--ubc-blue-700), var(--ubc-blue-600))",
            }}
          >
            {xlsxLoading ? "Downloading…" : "Export XLSX"}
          </Button>
          <Button
            type="button"
            onClick={handleExportZip}
            disabled={zipLoading}
            className="rounded-xl px-4 text-primary-foreground"
            style={{
              background: "linear-gradient(135deg, var(--ubc-blue-700), var(--ubc-blue-600))",
            }}
          >
            {zipLoading ? "Downloading…" : "Export CSV (zip)"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          XLSX includes a README sheet and one sheet per table. CSV (zip) contains one
          file per table.
        </p>
      </section>
    </PageContainer>
  );
}
