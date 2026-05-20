import { apiGet } from "@/lib/api";

export interface MisoDashboardSessionItem {
  misokinesia_participant_number: number;
  started_at: string;
  completed_at: string | null;
  age_band: string | null;
  gender: string | null;
  country: string | null;
  avg_clip_score: number | null;
}

export interface MisoDashboardResponse {
  active_stimuli_count: number;
  recent_sessions: MisoDashboardSessionItem[];
}

export interface MisoVideoScoreItem {
  video_label: string;
  avg_score: number;
  response_count: number;
}

export interface MisoVideoScoresResponse {
  top_5: MisoVideoScoreItem[];
  bottom_5: MisoVideoScoreItem[];
}

export async function getMisoDashboard(): Promise<MisoDashboardResponse> {
  return apiGet<MisoDashboardResponse>("/misokinesia/dashboard", { auth: true });
}

export async function getMisoVideoScores(): Promise<MisoVideoScoresResponse> {
  return apiGet<MisoVideoScoresResponse>("/misokinesia/video-scores", { auth: true });
}
