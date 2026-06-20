"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowUp, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ApiError,
  streamRaChat,
  type RAChatMessage,
  type RAChatResponse,
  type RAChatToolResult,
} from "@/lib/api";

/** A tool call surfaced live in the conversation while it runs/resolves. */
export interface ChatToolActivity {
  toolName: string;
  status: "running" | "resolved";
}

/** One rendered turn in the on-screen conversation. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  /** Compact backend tool summaries shown under an assistant turn. */
  toolResults?: RAChatToolResult[];
  /** Transient running/resolved tool affordances shown during streaming. */
  toolActivity?: ChatToolActivity[];
  /** Set when the backend declined to answer (privacy / scope / unavailable). */
  blockedReason?: string | null;
}

/**
 * Fold a tool lifecycle event into the running activity list: mark a tool
 * `resolved` when it returns, otherwise append it as `running`.
 */
export function applyToolActivity(
  activity: ChatToolActivity[],
  toolName: string,
  status: "running" | "resolved"
): ChatToolActivity[] {
  if (status === "resolved") {
    let matched = false;
    const next = activity.map((entry) => {
      if (!matched && entry.toolName === toolName && entry.status === "running") {
        matched = true;
        return { ...entry, status: "resolved" as const };
      }
      return entry;
    });
    return matched ? next : [...next, { toolName, status: "resolved" as const }];
  }
  return [...activity, { toolName, status: "running" as const }];
}

/** UI status for the chat surface. */
export type ChatStatus = "empty" | "ready" | "loading" | "error";

const PRIVACY_UNAVAILABLE_HINT =
  "the assistant is temporarily unavailable while privacy safeguards are enforced";

/**
 * Inline citation/link detector. Pulls bare http(s) URLs out of assistant text
 * so report-style responses can surface clickable source links without an
 * external markdown dependency.
 */
export function extractSourceLinks(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
  const seen = new Set<string>();
  const links: string[] = [];
  for (const raw of matches) {
    const url = raw.replace(/[.,;:]+$/, "");
    if (!seen.has(url)) {
      seen.add(url);
      links.push(url);
    }
  }
  return links;
}

/**
 * Decide whether a blocked response is a privacy/unavailable state (which gets
 * a distinct treatment) versus an ordinary scope/permission refusal.
 */
export function isPrivacyUnavailable(blockedReason: string | null | undefined): boolean {
  if (!blockedReason) return false;
  const reason = blockedReason.toLowerCase();
  return (
    reason.includes("unavailable") ||
    reason.includes("privacy") ||
    reason.includes("zero data retention") ||
    reason.includes("zdr")
  );
}

/** Map an API error to a user-safe, non-leaking message. */
export function chatErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return "Your session is not authorized for the assistant. Please sign in again.";
    }
    if (err.status === 503) {
      return `The assistant is unavailable right now (${PRIVACY_UNAVAILABLE_HINT}). Please try again later.`;
    }
  }
  return "Something went wrong reaching the assistant. Please try again.";
}

/**
 * Render assistant text as readable report-style blocks. This is a deliberately
 * small, dependency-free formatter: it preserves paragraph and bullet structure
 * without introducing a markdown/HTML pipeline that could inject third-party
 * branding or unsafe markup.
 */
function AssistantText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim().length > 0);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n");
        const isBulleted = lines.every((line) => /^\s*[-*]\s+/.test(line));
        if (isBulleted) {
          return (
            <ul key={blockIndex} className="ml-4 list-disc space-y-1">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{line.replace(/^\s*[-*]\s+/, "")}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}

function SourceLinks({ text }: { text: string }) {
  const links = extractSourceLinks(text);
  if (links.length === 0) return null;
  return (
    <div className="mt-3 border-t border-border/50 pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Sources
      </p>
      <ul className="mt-1 space-y-1">
        {links.map((url) => (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-xs text-primary underline-offset-2 hover:underline"
            >
              {url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToolActivityList({ activity }: { activity: ChatToolActivity[] }) {
  const running = activity.filter((entry) => entry.status === "running");
  if (running.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5" aria-live="polite">
      {running.map((entry, index) => (
        <div
          key={`${entry.toolName}-${index}`}
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
          <span>
            Running <span className="font-medium text-foreground">{entry.toolName}</span>…
          </span>
        </div>
      ))}
    </div>
  );
}

function ToolSummaries({ results }: { results: RAChatToolResult[] }) {
  if (results.length === 0) return null;
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Retrieved data
      </p>
      {results.map((result, index) => (
        <div
          key={`${result.tool_name}-${index}`}
          className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
        >
          <span className="font-medium text-foreground">{result.tool_name}</span>: {result.summary}
        </div>
      ))}
    </div>
  );
}

/**
 * RA data chatbot conversation surface.
 *
 * A simple chat-first layout adapted to the project color system. All model
 * access goes through the typed postRaChat() wrapper; this component never calls
 * fetch or the model gateway directly and offers no file-download control.
 */
export default function RaChatPanel() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("empty");
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns, status]);

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || status === "loading") return;

    const history: RAChatMessage[] = turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

    // Push the user turn plus a placeholder assistant turn that fills in live as
    // tokens and tool events stream back. The assistant turn is the last entry.
    let assistantIndex = -1;
    setTurns((prev) => {
      assistantIndex = prev.length + 1;
      return [
        ...prev,
        { role: "user", content: trimmed },
        { role: "assistant", content: "", toolActivity: [] },
      ];
    });
    setInput("");
    setStatus("loading");
    setError(null);

    const patchAssistant = (patch: (turn: ChatTurn) => ChatTurn) => {
      setTurns((prev) =>
        prev.map((turn, index) => (index === assistantIndex ? patch(turn) : turn))
      );
    };

    try {
      const res: RAChatResponse = await streamRaChat(
        { message: trimmed, conversation_id: conversationId, history },
        {
          onToken: (text) =>
            patchAssistant((turn) => ({ ...turn, content: turn.content + text })),
          onToolRunning: (toolName) =>
            patchAssistant((turn) => ({
              ...turn,
              toolActivity: applyToolActivity(
                turn.toolActivity ?? [],
                toolName,
                "running"
              ),
            })),
          onToolResolved: (event) =>
            patchAssistant((turn) => ({
              ...turn,
              toolActivity: applyToolActivity(
                turn.toolActivity ?? [],
                event.tool_name,
                "resolved"
              ),
            })),
        }
      );
      setConversationId(res.conversation_id);
      // Reconcile with the authoritative final payload (message, tool summaries,
      // blocked reason) and clear transient running affordances.
      patchAssistant((turn) => ({
        ...turn,
        content: res.message,
        toolResults: res.tool_results,
        toolActivity: [],
        blockedReason: res.blocked_reason,
      }));
      setStatus("ready");
    } catch (err) {
      // Drop the empty assistant placeholder so only the error banner shows.
      setTurns((prev) => prev.filter((_, index) => index !== assistantIndex));
      setError(chatErrorMessage(err));
      setStatus("error");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  const showEmptyState = turns.length === 0 && status !== "loading";

  return (
    <div className="mx-auto mt-10 flex h-[calc(100dvh-12rem)] w-full max-w-3xl flex-col px-4 sm:mt-14 sm:px-6">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto py-6"
        aria-live="polite"
        aria-label="Conversation"
      >
        {showEmptyState ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-card/70 text-primary">
              <Sparkles className="size-5" />
            </span>
            <h1 className="mt-4 text-lg font-semibold text-foreground">
              Ask about your lab data
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Ask plain-language questions about participants, sessions, surveys,
              and weather-linked results. Responses summarize retrieved data and
              clearly separate model interpretation.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {turns.map((turn, index) => {
              if (turn.role === "user") {
                return (
                  <div key={index} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                      <p className="whitespace-pre-wrap">{turn.content}</p>
                    </div>
                  </div>
                );
              }

              const privacyUnavailable = isPrivacyUnavailable(turn.blockedReason);
              return (
                <div key={index} className="flex justify-start">
                  <div
                    className={cn(
                      "max-w-[92%] rounded-2xl rounded-bl-md border px-4 py-3",
                      privacyUnavailable
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-border/70 bg-card/70"
                    )}
                  >
                    {turn.blockedReason ? (
                      <div className="flex items-start gap-2 text-sm text-foreground">
                        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                        <span>{turn.content || turn.blockedReason}</span>
                      </div>
                    ) : (
                      <>
                        {turn.content ? <AssistantText text={turn.content} /> : null}
                        <ToolActivityList activity={turn.toolActivity ?? []} />
                        <ToolSummaries results={turn.toolResults ?? []} />
                        <SourceLinks text={turn.content} />
                        {!turn.content &&
                        !(turn.toolActivity ?? []).some(
                          (entry) => entry.status === "running"
                        ) ? (
                          <div
                            className="flex items-center gap-1.5"
                            aria-label="Assistant is thinking"
                          >
                            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-2 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="pb-4">
        <div className="flex items-end gap-2 rounded-2xl border border-border/80 bg-card/80 p-2 shadow-sm backdrop-blur-xl focus-within:border-ring/55">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask about your lab data…"
            aria-label="Message"
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || status === "loading"}
            aria-label="Send message"
            className="size-9 shrink-0 rounded-xl"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
        <p className="mt-2 px-1 text-center text-[11px] text-muted-foreground">
          Responses summarize retrieved lab data and may include model
          interpretation. Verify important findings in Supabase Studio.
        </p>
      </form>
    </div>
  );
}
