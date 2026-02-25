"use client";

import { useEffect, useState, useCallback } from "react";
import {
  apiGet,
  apiPost,
  type ParticipantResponse,
} from "@/lib/api";
import PageContainer from "@/lib/components/PageContainer";

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<ParticipantResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchParticipants = useCallback(async () => {
    try {
      const data = await apiGet<ParticipantResponse[]>("/participants", {
        auth: true,
      });
      setParticipants(data);
      setListError(null);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load participants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setSubmitting(true);
    setSuccessMsg(null);
    setFormError(null);

    try {
      const created = await apiPost<ParticipantResponse>(
        "/participants",
        { first_name: firstName.trim(), last_name: lastName.trim() },
        { auth: true }
      );
      setSuccessMsg(`Participant #${created.participant_number} added successfully.`);
      setFirstName("");
      setLastName("");
      await fetchParticipants();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create participant");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer>

      {/* ── Page header ───────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Participants</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage study participants. Each participant is assigned a unique number upon enrolment.
        </p>
      </div>

      {/* ── List error ────────────────────────────────────── */}
      {listError && (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {listError}
        </div>
      )}

      {/* ── Add participant form ──────────────────────────── */}
      <div
        className="rounded-2xl border border-border p-6 mb-6"
        style={{ background: "var(--card)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Add participant
        </p>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-36">
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-muted-foreground mb-1.5"
            >
              First name
            </label>
            <input
              id="firstName"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="block w-full rounded-lg border border-border bg-input/30 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
          </div>
          <div className="flex-1 min-w-36">
            <label
              htmlFor="lastName"
              className="block text-sm font-medium text-muted-foreground mb-1.5"
            >
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="block w-full rounded-lg border border-border bg-input/30 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !firstName.trim() || !lastName.trim()}
            className="rounded-lg px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            style={{ background: "var(--ubc-blue-700)" }}
          >
            {submitting ? "Adding…" : "Add participant"}
          </button>
        </form>

        {successMsg && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
            {successMsg}
          </div>
        )}
        {formError && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {formError}
          </div>
        )}
      </div>

      {/* ── Participants table ───────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {loading ? "Participants" : `Participants (${participants.length})`}
          </p>
        </div>

        <div
          className="rounded-2xl border border-border overflow-hidden"
          style={{ background: "var(--card)" }}
        >
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : participants.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No participants yet. Add one above.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border" style={{ background: "var(--muted)" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground w-16">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">
                    Added
                  </th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr
                    key={p.participant_uuid}
                    className="border-b border-border last:border-0"
                    style={{ background: "var(--card)" }}
                  >
                    <td className="px-4 py-3.5">
                      <span
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold tabular-nums"
                        style={{ background: "var(--ubc-blue-700)", color: "#fff" }}
                      >
                        #{p.participant_number}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-foreground font-medium">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground tabular-nums hidden sm:table-cell">
                      {new Date(p.created_at).toLocaleDateString()}
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
