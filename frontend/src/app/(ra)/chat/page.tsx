"use client";

import RaChatPanel from "@/lib/components/RaChatPanel";

/**
 * Authenticated RA data chatbot page.
 *
 * Available to all RA and admin users via the floating dock. Provides a simple
 * chat-first surface over scoped lab data through the typed postRaChat() wrapper.
 * Never exposed to participant routes and has no export/download action.
 */
export default function ChatPage() {
  return <RaChatPanel />;
}
