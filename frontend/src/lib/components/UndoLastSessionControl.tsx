"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  ApiError,
  deleteLastNativeSession,
  getLastNativeSession,
  type LastNativeSessionResponse,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type UndoState = "idle" | "loading" | "confirm" | "deleting" | "done" | "error";

function statusLabel(status: LastNativeSessionResponse["status"]): string {
  return status === "created" ? "Created" : status === "active" ? "Active" : "Complete";
}

function statusBadgeClass(status: LastNativeSessionResponse["status"]): string {
  if (status === "created")
    return "border border-yellow-500/40 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300";
  if (status === "active")
    return "border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  return "border border-border bg-muted/30 text-muted-foreground";
}

interface Props {
  onSuccess?: () => void;
}

export default function UndoLastSessionControl({ onSuccess }: Props) {
  const [undoState, setUndoState] = useState<UndoState>("idle");
  const [candidate, setCandidate] = useState<LastNativeSessionResponse | null>(null);
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function handleOpenClick() {
    setUndoState("loading");
    setErrorMsg(null);
    setSuccessMsg(null);
    setReason("");

    try {
      const session = await getLastNativeSession();
      setCandidate(session);
      setUndoState("confirm");
      setDialogOpen(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setErrorMsg("No native sessions found to undo.");
      } else {
        setErrorMsg("Failed to load session preview. Please try again.");
      }
      setUndoState("error");
    }
  }

  async function handleConfirmDelete() {
    if (!reason.trim() || undoState !== "confirm") return;
    setUndoState("deleting");

    try {
      const result = await deleteLastNativeSession(reason.trim());
      const who = `Participant #${result.deleted_participant_number}`;
      const extra = result.participant_deleted ? " (participant record also removed)" : "";
      setSuccessMsg(`Session for ${who} removed.${extra}`);
      setUndoState("done");
      setDialogOpen(false);
      onSuccess?.();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError
          ? err.message
          : "Delete failed. Please try again."
      );
      setUndoState("error");
      setDialogOpen(false);
    }
  }

  function handleDialogClose(open: boolean) {
    if (!open) {
      setDialogOpen(false);
      if (undoState === "confirm" || undoState === "deleting") {
        setUndoState("idle");
      }
    }
  }

  const isLoading = undoState === "loading";

  return (
    <>
      <div className="flex flex-col gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={isLoading}
          onClick={handleOpenClick}
          className="h-8 gap-1.5 rounded-lg px-3 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Loading…" : "Undo Last Session"}
        </Button>

        {/* Inline feedback (outside dialog) */}
        {undoState === "done" && successMsg && (
          <p className="pl-1 text-xs text-emerald-600 dark:text-emerald-400">{successMsg}</p>
        )}
        {undoState === "error" && errorMsg && (
          <p className="pl-1 text-xs text-destructive">{errorMsg}</p>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Undo Last Session</DialogTitle>
          </DialogHeader>

          {candidate && (
            <div className="space-y-4 py-1">
              {/* Candidate preview */}
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Participant</span>
                  <span className="font-semibold text-foreground">
                    #{candidate.participant_number}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusBadgeClass(candidate.status)}`}
                  >
                    {statusLabel(candidate.status)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="text-foreground">
                    {new Intl.DateTimeFormat("en-CA", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(candidate.created_at))}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                This will permanently delete the session and all associated survey and digit span data.
                The participant record will also be removed if it has no other sessions.
              </p>

              {/* Reason field */}
              <div className="space-y-1.5">
                <Label htmlFor="undo-reason" className="text-xs font-medium">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="undo-reason"
                  placeholder="e.g. Accidental test run"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={undoState === "deleting"}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDialogClose(false)}
              disabled={undoState === "deleting"}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!reason.trim() || undoState === "deleting"}
              onClick={handleConfirmDelete}
              className="rounded-lg font-semibold"
              style={{ background: "var(--destructive)", color: "var(--destructive-foreground)" }}
            >
              {undoState === "deleting" ? "Deleting…" : "Confirm Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
