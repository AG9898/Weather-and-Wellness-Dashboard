import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageContainer from "@/lib/components/PageContainer";

export type MisokinesiaLaunchStatsState = "replica" | "empty" | "error";

interface MisokinesiaLaunchPageProps {
  loading?: boolean;
  error?: string | null;
  statsState?: MisokinesiaLaunchStatsState;
  onStart?: () => void;
}

const statsCopy: Record<MisokinesiaLaunchStatsState, string> = {
  replica: "Participant statistics and KPIs coming soon.",
  empty: "No participant statistics yet. Start a session to begin collecting responses.",
  error: "Participant statistics could not be loaded. Try refreshing the page.",
};

export default function MisokinesiaLaunchPage({
  loading = false,
  error = null,
  statsState = "replica",
  onStart,
}: MisokinesiaLaunchPageProps) {
  return (
    <PageContainer>
      <div
        className="relative mb-8 overflow-hidden rounded-2xl border border-border px-8 py-10 shadow-[var(--shadow-raised)]"
        style={{ background: "var(--card)" }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-16 blur-3xl"
          style={{ background: "var(--ring)" }}
        />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-lg space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Misokinesia Research
            </p>
            <h1 className="text-3xl font-bold leading-tight text-foreground">
              Misokinesia Task
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Launch a participant session for the video-clip misokinesia questionnaire.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Button
              size="lg"
              disabled={loading}
              onClick={onStart}
              className="rounded-xl px-6 font-semibold text-primary-foreground"
            >
              <Video className="mr-2 size-4" />
              {loading ? "Starting…" : "Start Misokinesia Session"}
            </Button>
            {error && (
              <p className="max-w-xs text-right text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl border border-border px-8 py-8 shadow-[var(--shadow-card)]"
        style={{ background: "var(--card)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Statistics
        </p>
        <p
          className={
            statsState === "error"
              ? "mt-2 text-sm text-destructive"
              : "mt-2 text-sm text-muted-foreground"
          }
        >
          {statsCopy[statsState]}
        </p>
      </div>
    </PageContainer>
  );
}
