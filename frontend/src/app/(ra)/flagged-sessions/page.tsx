"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, RotateCcw, ShieldAlert, Slash, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageContainer from "@/lib/components/PageContainer";
import { useRAUser } from "@/lib/contexts/RAUserContext";
import {
  ApiError,
  deleteAdminSession,
  getAdminFlaggedSessions,
  restoreAdminSession,
  voidAdminSession,
  type AdminFlaggedSessionResponse,
  type AdminSessionClassification,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/** Sort weight — surfaces stale/abandoned sessions first. */
const CLASSIFICATION_ORDER: Record<AdminSessionClassification, number> = {
  empty_stale: 0,
  empty_active: 1,
  partial: 2,
  voided: 3,
  complete: 4,
};

const CLASSIFICATION_LABEL: Record<AdminSessionClassification, string> = {
  empty_stale: "Empty · stale",
  empty_active: "Empty · active",
  partial: "Partial",
  voided: "Voided",
  complete: "Complete",
};

const STUDY_LABEL: Record<string, string> = {
  weather: "Weather",
  misokinesia: "Misokinesia",
  poffenberger: "Poffenberger",
};

const DELETE_CONFIRM_PHRASE = "DELETE";

function flaggedErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session has expired. Please sign in again.";
    if (err.status === 403) return "Only admins can manage flagged sessions.";
    if (err.status === 404) return "That session no longer exists. Refreshing the list.";
    if (err.status === 422) return "A reason is required to void a session.";
    if (err.status >= 500) return "A server error occurred. Please try again.";
    return err.message || "The request could not be completed.";
  }
  return "Unable to connect to the server. Please check your connection.";
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function shortId(value: string): string {
  return value.length > 8 ? `${value.slice(0, 8)}…` : value;
}

function classificationBadgeClass(classification: AdminSessionClassification): string {
  switch (classification) {
    case "empty_stale":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "empty_active":
      return "border-ring/35 bg-ring/10 text-foreground";
    case "partial":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "voided":
      return "border-border bg-muted text-muted-foreground";
    case "complete":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    default:
      return "border-border bg-background text-muted-foreground";
  }
}

type PendingAction =
  | { kind: "void"; row: AdminFlaggedSessionResponse }
  | { kind: "delete"; row: AdminFlaggedSessionResponse }
  | null;

export default function AdminFlaggedSessionsPage() {
  const router = useRouter();
  const { role } = useRAUser();
  const [rows, setRows] = useState<AdminFlaggedSessionResponse[]>([]);
  const [includeValid, setIncludeValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction>(null);
  const [voidReason, setVoidReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const order = CLASSIFICATION_ORDER[a.classification] - CLASSIFICATION_ORDER[b.classification];
        if (order !== 0) return order;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }),
    [rows]
  );

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getAdminFlaggedSessions(includeValid));
    } catch (err) {
      setError(flaggedErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [includeValid]);

  useEffect(() => {
    if (role !== "admin") {
      router.replace("/unauthorized");
      return;
    }
    void loadRows();
  }, [loadRows, role, router]);

  function openVoidDialog(row: AdminFlaggedSessionResponse) {
    setPending({ kind: "void", row });
    setVoidReason("");
    setError(null);
  }

  function openDeleteDialog(row: AdminFlaggedSessionResponse) {
    setPending({ kind: "delete", row });
    setDeleteConfirm("");
    setError(null);
  }

  function closeDialog() {
    setPending(null);
    setVoidReason("");
    setDeleteConfirm("");
  }

  async function refreshAfterAction(message: string) {
    setNotice(message);
    setRows(await getAdminFlaggedSessions(includeValid));
  }

  async function handleVoid() {
    if (pending?.kind !== "void") return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await voidAdminSession(pending.row.session_id, voidReason.trim());
      await refreshAfterAction("Session voided.");
      closeDialog();
    } catch (err) {
      setError(flaggedErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (pending?.kind !== "delete") return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deleteAdminSession(pending.row.session_id);
      await refreshAfterAction("Session and its dependent rows were permanently deleted.");
      closeDialog();
    } catch (err) {
      setError(flaggedErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(row: AdminFlaggedSessionResponse) {
    if (!window.confirm("Restore this session and clear its voided state?")) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await restoreAdminSession(row.session_id);
      await refreshAfterAction("Session restored.");
    } catch (err) {
      setError(flaggedErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (role !== "admin") {
    return (
      <PageContainer>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Checking access…</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Flagged Sessions</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Cross-lab review of abandoned or questionable sessions across all studies. Void
            preserves study data; hard-delete permanently removes the session and its rows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIncludeValid((current) => !current)}
            disabled={loading || saving}
            className="rounded-xl"
          >
            {includeValid ? "Hide complete runs" : "Show complete runs"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={loadRows}
            disabled={loading || saving}
            className="rounded-xl"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {notice ? (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sessions
          </p>
          <Badge variant="outline" className="bg-background">
            {sortedRows.length} shown
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 pr-4 font-semibold">Study</th>
                <th className="px-4 py-3 font-semibold">Lab</th>
                <th className="px-4 py-3 font-semibold">Participant</th>
                <th className="px-4 py-3 font-semibold">Session</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold">Activated</th>
                <th className="px-4 py-3 font-semibold">Completed</th>
                <th className="px-4 py-3 font-semibold">Classification</th>
                <th className="py-3 pl-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-muted-foreground">
                    Loading flagged sessions…
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-muted-foreground">
                    No flagged sessions.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const voided = row.classification === "voided";
                  return (
                    <tr key={row.session_id} className="align-middle">
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {STUDY_LABEL[row.study] ?? row.study}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.lab}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                          {row.participant_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground" title={row.session_id}>
                        {shortId(row.session_id)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(row.activated_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(row.completed_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Badge
                            variant="outline"
                            className={cn(classificationBadgeClass(row.classification))}
                          >
                            {CLASSIFICATION_LABEL[row.classification]}
                          </Badge>
                          {row.demographics_missing ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
                              <ShieldAlert className="size-3" />
                              Demographics missing
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pl-4">
                        <div className="flex justify-end gap-1">
                          {voided ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRestore(row)}
                              disabled={saving}
                              aria-label="Restore session"
                              title="Restore session"
                              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openVoidDialog(row)}
                              disabled={saving}
                              aria-label="Void session"
                              title="Void session"
                              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <Slash className="size-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(row)}
                            disabled={saving}
                            aria-label="Hard-delete session"
                            title="Hard-delete session"
                            className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={pending?.kind === "void"} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void session</DialogTitle>
            <DialogDescription>
              Soft-excludes this session from reporting while preserving its study data. A short
              reason is required. This can be undone with Restore.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="void-reason">Reason</Label>
            <Input
              id="void-reason"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="e.g. Abandoned before completion"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleVoid}
              disabled={saving || voidReason.trim().length === 0}
              className="text-primary-foreground"
            >
              {saving ? "Voiding…" : "Void session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pending?.kind === "delete"} onOpenChange={(open) => (open ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hard-delete session</DialogTitle>
            <DialogDescription>
              This permanently removes the session and every study result row that depends on it.
              This action cannot be undone. Type <span className="font-semibold">{DELETE_CONFIRM_PHRASE}</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Irreversible. All trials, runs, surveys, and demographics for this session will be
              destroyed. Consider Void instead if you may need the data later.
            </span>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="delete-confirm">Confirmation</Label>
            <Input
              id="delete-confirm"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder={DELETE_CONFIRM_PHRASE}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={saving || deleteConfirm.trim() !== DELETE_CONFIRM_PHRASE}
            >
              {saving ? "Deleting…" : "Permanently delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
