"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  apiGet,
  apiPost,
  apiPatch,
  type ParticipantResponse,
  type SessionResponse,
  type SessionListItemResponse,
  type SessionListResponse,
} from "@/lib/api";
import PageContainer from "@/lib/components/PageContainer";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_STYLES: Record<string, string> = {
  created: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  complete: "border-white/10 bg-white/5 text-muted-foreground",
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SessionsPage() {
  // Participant selector
  const [participants, setParticipants] = useState<ParticipantResponse[]>([]);
  const [selectedUuid, setSelectedUuid] = useState("");
  const [loadingParticipants, setLoadingParticipants] = useState(true);

  // Current session (just created in this view)
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sessions history list
  const [sessionList, setSessionList] = useState<SessionListItemResponse[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSessionList = useCallback(async () => {
    try {
      const data = await apiGet<SessionListResponse>("/sessions?page_size=20", {
        auth: true,
      });
      setSessionList(data.items);
      setListError(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Load participants and session list on mount
  useEffect(() => {
    apiGet<ParticipantResponse[]>("/participants", { auth: true })
      .then((data) => {
        setParticipants(data);
        if (data.length > 0) setSelectedUuid(data[0].participant_uuid);
      })
      .catch((err) =>
        setCreateError(err instanceof Error ? err.message : "Failed to load participants")
      )
      .finally(() => setLoadingParticipants(false));

    fetchSessionList();
  }, [fetchSessionList]);

  // Poll session status
  const startPolling = useCallback(
    (sessionId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const updated = await apiGet<SessionResponse>(`/sessions/${sessionId}`);
          setSession(updated);
          if (updated.status === "complete" && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
            fetchSessionList();
          }
        } catch {
          // Silently ignore poll errors
        }
      }, 3000);
    },
    [fetchSessionList]
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCreate = async () => {
    if (!selectedUuid) return;
    setCreating(true);
    setCreateError(null);
    setSession(null);

    try {
      const created = await apiPost<SessionResponse>(
        "/sessions",
        { participant_uuid: selectedUuid },
        { auth: true }
      );
      setSession(created);
      startPolling(created.session_id);
      await fetchSessionList();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async () => {
    if (!session) return;
    setActivating(true);
    setCreateError(null);

    try {
      const updated = await apiPatch<SessionResponse>(
        `/sessions/${session.session_id}/status`,
        { status: "active" },
        { auth: true }
      );
      setSession(updated);
      await fetchSessionList();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to activate session");
    } finally {
      setActivating(false);
    }
  };

  const sessionUrl = session
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/session/${session.session_id}`
    : null;

  const handleCopy = async () => {
    if (!sessionUrl) return;
    await navigator.clipboard.writeText(sessionUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedParticipant = participants.find(
    (p) => p.participant_uuid === selectedUuid
  );

  return (
    <PageContainer>

      {/* ── Page header ───────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and manage study sessions. Copy the participant URL to launch the task flow.
        </p>
      </div>

      {/* ── Create session card ───────────────────────────── */}
      <div
        className="rounded-2xl border border-border p-6 mb-4"
        style={{ background: "var(--card)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Create session
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label
              htmlFor="participant"
              className="block text-sm font-medium text-muted-foreground mb-1.5"
            >
              Participant
            </label>
            <select
              id="participant"
              value={selectedUuid}
              onChange={(e) => setSelectedUuid(e.target.value)}
              disabled={loadingParticipants || participants.length === 0}
              className="block w-full rounded-lg border border-border bg-input/30 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-50"
            >
              {loadingParticipants && <option>Loading…</option>}
              {!loadingParticipants && participants.length === 0 && (
                <option>No participants — add one first</option>
              )}
              {participants.map((p) => (
                <option key={p.participant_uuid} value={p.participant_uuid}>
                  #{p.participant_number} — {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !selectedUuid || participants.length === 0}
            className="rounded-lg px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ background: "var(--ubc-blue-700)" }}
          >
            {creating ? "Creating…" : "Create session"}
          </button>
        </div>

        {createError && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {createError}
          </div>
        )}
      </div>

      {/* ── Active session panel ──────────────────────────── */}
      {session && (
        <div
          className="rounded-2xl border border-border p-6 space-y-5 mb-4"
          style={{ background: "var(--card)" }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Session
              </p>
              <p className="text-sm text-muted-foreground font-mono truncate">
                {session.session_id}
              </p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[session.status] ?? STATUS_STYLES.complete}`}
            >
              {session.status}
            </span>
          </div>

          {/* Participant info */}
          {selectedParticipant && (
            <p className="text-sm text-muted-foreground">
              Participant:{" "}
              <span className="text-foreground font-medium">
                #{selectedParticipant.participant_number} — {selectedParticipant.first_name}{" "}
                {selectedParticipant.last_name}
              </span>
            </p>
          )}

          {/* Participant URL */}
          {sessionUrl && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Participant URL
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground font-mono">
                  {sessionUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {/* Activate button */}
          {session.status === "created" && (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="rounded-lg px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ background: "var(--ubc-blue-600)" }}
            >
              {activating ? "Activating…" : "Activate session"}
            </button>
          )}

          {session.status === "complete" && (
            <p className="text-sm text-muted-foreground">
              Session completed{" "}
              {session.completed_at
                ? `at ${new Date(session.completed_at).toLocaleString()}`
                : ""}
            </p>
          )}
        </div>
      )}

      {/* ── Sessions history ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {loadingList ? "Sessions" : `All Sessions (${sessionList.length})`}
          </p>
        </div>

        {listError && (
          <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {listError}
          </div>
        )}

        <div
          className="rounded-2xl border border-border overflow-hidden"
          style={{ background: "var(--card)" }}
        >
          {loadingList ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : sessionList.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No sessions yet. Create one above.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border" style={{ background: "var(--muted)" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground w-16">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">
                    Session ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessionList.map((s) => (
                  <tr
                    key={s.session_id}
                    className="border-b border-border last:border-0"
                    style={{ background: "var(--card)" }}
                  >
                    <td className="px-4 py-3.5">
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold tabular-nums"
                        style={{ background: "var(--ubc-blue-700)", color: "#fff" }}
                      >
                        #{s.participant_number}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {s.session_id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[s.status] ?? STATUS_STYLES.complete}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-xs text-muted-foreground tabular-nums">
                      {timeAgo(s.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </PageContainer>
  );
}
