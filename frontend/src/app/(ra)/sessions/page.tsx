"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  apiGet,
  apiPost,
  apiPatch,
  type ParticipantResponse,
  type SessionResponse,
} from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  created: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  complete: "bg-zinc-100 text-zinc-600",
};

export default function SessionsPage() {
  // Participant selector
  const [participants, setParticipants] = useState<ParticipantResponse[]>([]);
  const [selectedUuid, setSelectedUuid] = useState("");
  const [loadingParticipants, setLoadingParticipants] = useState(true);

  // Session state
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load participants on mount
  useEffect(() => {
    apiGet<ParticipantResponse[]>("/participants", { auth: true })
      .then((data) => {
        setParticipants(data);
        if (data.length > 0) setSelectedUuid(data[0].participant_uuid);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load participants")
      )
      .finally(() => setLoadingParticipants(false));
  }, []);

  // Poll session status
  const startPolling = useCallback((sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const updated = await apiGet<SessionResponse>(
          `/sessions/${sessionId}`
        );
        setSession(updated);
        if (updated.status === "complete" && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // Silently ignore poll errors
      }
    }, 3000);
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleCreate = async () => {
    if (!selectedUuid) return;
    setCreating(true);
    setError(null);
    setSession(null);

    try {
      const created = await apiPost<SessionResponse>(
        "/sessions",
        { participant_uuid: selectedUuid },
        { auth: true }
      );
      setSession(created);
      startPolling(created.session_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async () => {
    if (!session) return;
    setActivating(true);
    setError(null);

    try {
      const updated = await apiPatch<SessionResponse>(
        `/sessions/${session.session_id}/status`,
        { status: "active" },
        { auth: true }
      );
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate session");
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

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Sessions</h1>

      {/* Create session */}
      <div className="mt-6 flex flex-wrap gap-3 items-end">
        <div>
          <label
            htmlFor="participant"
            className="block text-sm font-medium text-zinc-700"
          >
            Participant
          </label>
          <select
            id="participant"
            value={selectedUuid}
            onChange={(e) => setSelectedUuid(e.target.value)}
            disabled={loadingParticipants || participants.length === 0}
            className="mt-1 block w-64 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            {loadingParticipants && <option>Loading...</option>}
            {!loadingParticipants && participants.length === 0 && (
              <option>No participants</option>
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
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create session"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Active session panel */}
      {session && (
        <div className="mt-8 rounded-lg border border-zinc-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium">Session</h2>
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[session.status] ?? "bg-zinc-100 text-zinc-600"}`}
            >
              {session.status}
            </span>
          </div>

          {/* Participant URL */}
          {sessionUrl && (
            <div>
              <p className="text-sm text-zinc-500 mb-1">Participant URL</p>
              <div className="flex items-center gap-2">
                <code className="block flex-1 truncate rounded bg-zinc-50 px-3 py-2 text-sm text-zinc-800 border border-zinc-200">
                  {sessionUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
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
              className="rounded-md bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-600 disabled:opacity-50"
            >
              {activating ? "Activating..." : "Activate session"}
            </button>
          )}

          {session.status === "complete" && (
            <p className="text-sm text-zinc-500">
              Session completed{" "}
              {session.completed_at
                ? `at ${new Date(session.completed_at).toLocaleString()}`
                : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
