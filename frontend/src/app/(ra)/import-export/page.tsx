"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import PageContainer from "@/lib/components/PageContainer";
import { ApiError, exportPoffenbergerXlsx } from "@/lib/api";
import { useActiveLab } from "@/lib/labs";

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
    if (err.status === 403) return "You do not have access to this export.";
    if (err.status >= 500) return "A server error occurred. Please try again.";
    return err.message || "An unexpected error occurred.";
  }
  return "Unable to connect to the server. Please check your connection.";
}

export default function ImportExportPage() {
  const router = useRouter();
  const { activeLab } = useActiveLab();
  const [hasMounted, setHasMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [useSampleData, setUseSampleData] = useState(false);

  const canExportPoffenberger = activeLab === "ihtt";

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (hasMounted && !canExportPoffenberger) {
      router.replace("/unauthorized");
    }
  }, [canExportPoffenberger, hasMounted, router]);

  const handleExport = useCallback(async () => {
    setIsDownloading(true);
    setExportError(null);
    try {
      const { blob, filename } = await exportPoffenbergerXlsx({
        sampleData: useSampleData,
      });
      triggerDownload(blob, filename);
    } catch (err) {
      setExportError(raErrorMessage(err));
    } finally {
      setIsDownloading(false);
    }
  }, [useSampleData]);

  if (!hasMounted || !canExportPoffenberger) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          IHTT
        </p>
        <h1 className="text-2xl font-bold text-foreground">Import / Export</h1>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Poffenberger
          </p>
          <h2 className="text-lg font-semibold text-foreground">XLSX export</h2>
        </div>

        {exportError ? (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{exportError}</p>
          </div>
        ) : null}

        <div className="mb-4 flex items-start gap-3">
          <input
            id="sample-data"
            type="checkbox"
            checked={useSampleData}
            onChange={(event) => setUseSampleData(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <label htmlFor="sample-data" className="text-sm text-foreground">
            Use hardcoded sample data
          </label>
        </div>

        <Button
          type="button"
          onClick={handleExport}
          disabled={isDownloading}
          className="gap-2 rounded-xl px-4 text-primary-foreground"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {isDownloading ? "Downloading..." : "Export Poffenberger XLSX"}
        </Button>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Includes a README sheet, one run-level sheet with participant and session
          context, and one trial-level sheet linked by run, session, and participant IDs.
        </p>
      </section>
    </PageContainer>
  );
}
