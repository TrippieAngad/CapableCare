export interface GeminiMessage {
  role: "user" | "assistant";
  text: string;
}

import { buildVoiceApiUrl } from "./voice-api";

export interface ChatCitation {
  id: string;
  label: string;
  detail: string;
}

export interface ChatReply {
  reply: string;
  citations: ChatCitation[];
}

export async function generateGeminiReply(
  history: GeminiMessage[],
  accessToken: string,
): Promise<ChatReply> {
  if (!accessToken) {
    throw new Error("Missing Supabase access token");
  }

  const response = await fetch(buildVoiceApiUrl("/api/chat"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accessToken,
      messages: history,
    }),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error || "Chat request failed");
  }

  const text = typeof payload?.reply === "string" ? payload.reply.trim() : "";
  const citations = Array.isArray(payload?.citations)
    ? payload.citations
        .filter(
          (entry: unknown): entry is ChatCitation =>
            Boolean(
              entry &&
                typeof entry === "object" &&
                typeof (entry as ChatCitation).id === "string" &&
                typeof (entry as ChatCitation).label === "string" &&
                typeof (entry as ChatCitation).detail === "string",
            ),
        )
    : [];

  if (!text) {
    throw new Error("Chat service returned an empty response");
  }

  return {
    reply: text,
    citations,
  };
}
