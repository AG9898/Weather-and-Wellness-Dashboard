"use client";

import LabGuard from "@/lib/components/LabGuard";
import RaChatPanel from "@/lib/components/RaChatPanel";

/**
 * Authenticated RA data chatbot page.
 *
 * Scoped to Weather-Wellness RAs (and admins) via the floating dock and a lab
 * guard. Provides a simple chat-first surface over scoped lab data through the
 * typed postRaChat() wrapper. Never exposed to participant routes and has no
 * export/download action.
 */
export default function ChatPage() {
  return (
    <LabGuard lab="ww">
      <RaChatPanel />
    </LabGuard>
  );
}
