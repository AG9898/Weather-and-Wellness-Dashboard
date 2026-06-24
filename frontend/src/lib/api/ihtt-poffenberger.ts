import { apiGet } from "@/lib/api";

export interface PoffenbergerDashboardRunItem {
  participant_number: number;
  started_at: string;
  completed_at: string | null;
  is_complete: boolean;
  age_band: string | null;
  gender: string | null;
  handedness: string | null;
  // Decimal columns serialize as strings over JSON.
  ihtt_difference_ms: number | string | null;
}

export interface PoffenbergerDashboardResponse {
  total_runs: number;
  completed_runs: number;
  avg_ihtt_difference_ms: number | string | null;
  recent_runs: PoffenbergerDashboardRunItem[];
}

export async function getPoffenbergerDashboard(): Promise<PoffenbergerDashboardResponse> {
  return apiGet<PoffenbergerDashboardResponse>("/ihtt/poffenberger/dashboard", {
    auth: true,
  });
}
