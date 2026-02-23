"use client";

import { useEffect, useState, useCallback } from "react";
import {
  apiGet,
  apiPost,
  type ParticipantResponse,
} from "@/lib/api";

export default function ParticipantsPage() {
  const [participants, setParticipants] = useState<ParticipantResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchParticipants = useCallback(async () => {
    try {
      const data = await apiGet<ParticipantResponse[]>("/participants", {
        auth: true,
      });
      setParticipants(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load participants");
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
    setError(null);

    try {
      const created = await apiPost<ParticipantResponse>(
        "/participants",
        { first_name: firstName.trim(), last_name: lastName.trim() },
        { auth: true }
      );
      setSuccessMsg(
        `Participant created — assigned number ${created.participant_number}`
      );
      setFirstName("");
      setLastName("");
      await fetchParticipants();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create participant");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Participants</h1>

      {/* Create form */}
      <form onSubmit={handleSubmit} className="mt-6 flex flex-wrap gap-3 items-end">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-zinc-700">
            First name
          </label>
          <input
            id="firstName"
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="mt-1 block w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-zinc-700">
            Last name
          </label>
          <input
            id="lastName"
            type="text"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="mt-1 block w-48 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !firstName.trim() || !lastName.trim()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Add participant"}
        </button>
      </form>

      {successMsg && (
        <p className="mt-3 text-sm text-green-700">{successMsg}</p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {/* Participant table */}
      <div className="mt-8">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading...</p>
        ) : participants.length === 0 ? (
          <p className="text-sm text-zinc-500">No participants yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left">
                <th className="py-2 pr-4 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">First name</th>
                <th className="py-2 pr-4 font-medium">Last name</th>
                <th className="py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.participant_uuid} className="border-b border-zinc-100">
                  <td className="py-2 pr-4 tabular-nums">{p.participant_number}</td>
                  <td className="py-2 pr-4">{p.first_name}</td>
                  <td className="py-2 pr-4">{p.last_name}</td>
                  <td className="py-2 text-zinc-500">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
