"use client";

import React from "react";
import { useConversation } from "@elevenlabs/react";
import { AnimatePresence, motion } from "framer-motion";
import { LoaderCircle, Mic, MicOff, PhoneOff, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CanvasRevealEffect } from "@/components/ui/canvas-effect";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import type { ChatCitation } from "@/lib/gemini";
import { generateGeminiReply } from "@/lib/gemini";
import { getSession } from "@/lib/portal";
import { cn } from "@/lib/utils";
import { buildVoiceApiUrl } from "@/lib/voice-api";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  citations?: ChatCitation[];
};

type VoiceAgent = {
  id: string;
  name: string;
  isDefault?: boolean;
};

const VOICE_OVERRIDES_BY_AGENT_ID: Record<string, { tts: { voiceId: string } }> = {};

const seedMessages: ChatMessage[] = [
  {
    id: "intro-1",
    role: "assistant",
    text: "I can help compare eldercare buddies, explain visit schedules, and summarize care risks.",
  },
  {
    id: "intro-2",
    role: "assistant",
    text: "Ask about caretaker fit, transportation coordination, or what changed in recent care updates.",
  },
];

export function ECareAIChat() {
  const [hovered, setHovered] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [mode, setMode] = React.useState<"text" | "speech">("text");
  const [messages, setMessages] = React.useState(seedMessages);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [voiceMessages, setVoiceMessages] = React.useState<ChatMessage[]>([]);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);
  const [voiceAgents, setVoiceAgents] = React.useState<VoiceAgent[]>([]);
  const [selectedVoiceAgentId, setSelectedVoiceAgentId] = React.useState("");
  const [loadingVoiceAgents, setLoadingVoiceAgents] = React.useState(false);
  const [voiceAgentsLoaded, setVoiceAgentsLoaded] = React.useState(false);
  const chatBottomRef = React.useRef<HTMLDivElement | null>(null);
  const endVoiceSessionRef = React.useRef<(() => Promise<void>) | null>(null);

  const conversation = useConversation({
    onMessage: (message) => {
      setVoiceMessages((current) => {
        const nextMessage: ChatMessage = {
          id: `${message.role}-${message.event_id}`,
          role: message.role === "agent" ? "assistant" : "user",
          text: message.message,
        };

        const existingIndex = current.findIndex((entry) => entry.id === nextMessage.id);
        if (existingIndex === -1) {
          return [...current, nextMessage];
        }

        const next = [...current];
        next[existingIndex] = nextMessage;
        return next;
      });
    },
    onError: (error) => {
      setVoiceError(typeof error === "string" ? error : "Voice session failed");
    },
  });

  React.useEffect(() => {
    endVoiceSessionRef.current = conversation.endSession;
  }, [conversation.endSession]);

  React.useEffect(() => {
    return () => {
      if (endVoiceSessionRef.current) {
        void endVoiceSessionRef.current();
      }
    };
  }, []);

  React.useEffect(() => {
    if (mode !== "speech" && endVoiceSessionRef.current) {
      void endVoiceSessionRef.current();
    }
  }, [mode]);

  React.useEffect(() => {
    if (mode !== "speech" || loadingVoiceAgents || voiceAgentsLoaded) {
      return;
    }

    let cancelled = false;

    async function loadVoiceAgents() {
      setLoadingVoiceAgents(true);
      try {
        const response = await fetch(buildVoiceApiUrl("/api/elevenlabs/agents"));
        const payload = (await response.json()) as { agents?: VoiceAgent[]; error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load ElevenLabs agents");
        }

        const agents = Array.isArray(payload.agents) ? payload.agents : [];
        if (cancelled) {
          return;
        }

        setVoiceError(null);
        setVoiceAgents(agents);
        setVoiceAgentsLoaded(true);
        setSelectedVoiceAgentId((current) => {
          if (current && agents.some((agent) => agent.id === current)) {
            return current;
          }

          const defaultAgent = agents.find((agent) => agent.isDefault) || agents[0];
          return defaultAgent?.id || "";
        });
      } catch (error) {
        if (!cancelled) {
          setVoiceError(
            error instanceof Error ? error.message : "Unable to load voice agents",
          );
          setVoiceAgentsLoaded(false);
        }
      } finally {
        if (!cancelled) {
          setLoadingVoiceAgents(false);
        }
      }
    }

    void loadVoiceAgents();

    return () => {
      cancelled = true;
    };
  }, [loadingVoiceAgents, mode, voiceAgentsLoaded]);

  async function submitPrompt(event: React.FormEvent) {
    event.preventDefault();
    const nextDraft = draft.trim();
    if (!nextDraft || isSubmitting) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: nextDraft,
    };

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setDraft("");
    setChatError(null);
    setIsSubmitting(true);

    try {
      const session = await getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error("Sign in to ask questions about care records");
      }

      const result = await generateGeminiReply(
        nextHistory.map(({ role, text }) => ({ role, text })),
        accessToken,
      );
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: result.reply,
          citations: result.citations,
        },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach chat service";
      setChatError(message);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text:
            "I couldn't complete that request right now. Check the server chat configuration and try again.",
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function startVoiceSession() {
    setVoiceError(null);
    try {
      if (!selectedVoiceAgentId) {
        throw new Error("Choose a voice agent before starting the session");
      }

      const tokenResponse = await fetch(buildVoiceApiUrl("/api/elevenlabs/conversation-token"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: selectedVoiceAgentId,
        }),
      });
      const rawTokenPayload = await tokenResponse.text();
      const tokenPayload = rawTokenPayload ? JSON.parse(rawTokenPayload) : null;

      if (!tokenResponse.ok || !tokenPayload?.token) {
        throw new Error(
          tokenPayload?.error ||
            (rawTokenPayload
              ? "Unable to create ElevenLabs token"
              : "The ElevenLabs token service returned an empty response"),
        );
      }

      await conversation.startSession({
        conversationToken: tokenPayload.token,
        connectionType: "webrtc",
        overrides: VOICE_OVERRIDES_BY_AGENT_ID[selectedVoiceAgentId],
      });
    } catch (error) {
      setVoiceError(
        error instanceof Error
          ? error.message
          : "Unable to start voice session",
      );
    }
  }

  async function endVoiceSession() {
    try {
      await conversation.endSession();
    } catch (error) {
      setVoiceError(
        error instanceof Error ? error.message : "Unable to stop voice session",
      );
    }
  }

  function resetTextChat() {
    setMessages(seedMessages);
    setChatError(null);
  }

  function resetVoiceChat() {
    setVoiceMessages([]);
    setVoiceError(null);
  }

  const renderedMessages = mode === "speech" ? voiceMessages : messages;
  const speechStatusLabel =
    conversation.status === "connected"
      ? conversation.isSpeaking
        ? "Agent speaking"
        : "Listening"
      : conversation.status === "connecting"
        ? "Connecting"
        : "Ready";
  const selectedVoiceAgent =
    voiceAgents.find((agent) => agent.id === selectedVoiceAgentId) || null;

  React.useEffect(() => {
    if (mode !== "text") {
      return;
    }

    chatBottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, mode]);

  return (
    <section className="panel wide">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative mx-auto w-full overflow-hidden rounded-[28px] border border-[rgba(22,52,59,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.62))] p-4 shadow-[0_18px_50px_rgba(38,68,73,0.12)]"
      >
        <div className="relative flex w-full items-center justify-center p-2 md:p-4">
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 1 }}
                className="absolute inset-0 h-full w-full object-cover"
              >
                <CanvasRevealEffect
                  animationSpeed={5}
                  containerClassName="bg-transparent opacity-25"
                  colors={[
                    [47, 111, 114],
                    [199, 111, 63],
                  ]}
                  opacities={[1, 0.8, 1, 0.8, 0.5, 0.8, 1, 0.5, 1, 3]}
                  dotSize={2}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="z-20 w-full">
            <div className="mb-3 flex items-center justify-end px-2 md:px-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-primary/70">
                ECareAI
                <select
                  className="rounded-full border border-[rgba(22,52,59,0.12)] bg-white/85 px-3 py-2 text-sm text-[#16343b] shadow-sm"
                  onChange={(event) => setMode(event.target.value as "text" | "speech")}
                  value={mode}
                >
                  <option value="text">Text</option>
                  <option value="speech">Speech</option>
                </select>
              </label>
            </div>
            <ScrollArea className="h-[360px] w-full overflow-auto p-1">
              <div className="px-4 md:px-6">
                <div className="relative flex h-full w-full justify-center text-center">
                  <h1 className="flex select-none py-2 text-center text-2xl font-extrabold leading-none tracking-tight text-[#16343b] md:text-3xl lg:text-4xl">
                    Ask me anything!
                  </h1>
                </div>
                <p className="mx-auto mt-1 max-w-2xl text-center text-xs text-primary/60 md:text-sm">
                  {mode === "speech"
                    ? "Talk to the ElevenLabs voice agent for hands-free help with care coordination, buddy recommendations, or recent updates."
                    : "Send a text prompt to Gemini for care coordination help, buddy recommendations, or a quick explanation of recent updates."}
                </p>
              </div>

              <div id="chat" className="w-full px-2 pt-4 md:px-4">
                <div className={cn("space-y-3")}>
                  {renderedMessages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "overflow-hidden rounded-2xl p-3",
                        message.role === "assistant"
                          ? "bg-white/70 text-[#16343b]"
                          : "ml-auto max-w-[85%] bg-[#16343b] text-white",
                      )}
                    >
                      <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-primary/70">
                        {message.role}
                      </p>
                      <p className="text-sm leading-6">{message.text}</p>
                      {message.role === "assistant" && message.citations?.length ? (
                        <div className="mt-3 border-t border-[rgba(22,52,59,0.08)] pt-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/60">
                            Grounded on
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.citations.map((citation) => (
                              <div
                                key={citation.id}
                                className="rounded-2xl border border-[rgba(22,52,59,0.1)] bg-[rgba(248,245,238,0.9)] px-3 py-2 text-xs text-[#16343b]"
                              >
                                <p className="font-semibold">{citation.label}</p>
                                <p className="mt-1 text-primary/70">{citation.detail}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {renderedMessages.length === 0 ? (
                    <div className="rounded-2xl bg-white/60 p-3 text-sm text-primary/70">
                      Start a voice session to see live user and agent transcripts here.
                    </div>
                  ) : null}
                  {mode === "text" ? <div ref={chatBottomRef} /> : null}
                </div>
              </div>
            </ScrollArea>

            <div className="relative mt-3 w-full">
              {mode === "speech" ? (
                <div className="rounded-[24px] border border-[rgba(22,52,59,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,243,234,0.7))] p-4">
                  <div className="mb-3 text-center">
                    <p className="text-sm font-semibold text-[#16343b]">ElevenLabs voice agent</p>
                    <p className="text-xs text-primary/60">
                      Status: {speechStatusLabel}. Choose a voice agent, then start a live session.
                    </p>
                  </div>
                  <div className="mx-auto mb-4 max-w-[320px]">
                    <label className="block text-left text-xs font-semibold uppercase tracking-[0.18em] text-primary/60">
                      Voice model
                    </label>
                    <select
                      className="mt-2 w-full rounded-2xl border border-[rgba(22,52,59,0.12)] bg-white/85 px-4 py-3 text-sm text-[#16343b] shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                      value={selectedVoiceAgentId}
                      onChange={(event) => setSelectedVoiceAgentId(event.target.value)}
                      disabled={
                        loadingVoiceAgents ||
                        conversation.status === "connected" ||
                        conversation.status === "connecting"
                      }
                    >
                      {voiceAgents.length === 0 ? (
                        <option value="">
                          {loadingVoiceAgents
                            ? "Loading voice agents..."
                            : voiceAgentsLoaded
                              ? "No voice agents configured"
                              : "Voice agent service unavailable"}
                        </option>
                      ) : null}
                      {voiceAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                          {agent.isDefault ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                    {selectedVoiceAgent ? (
                      <p className="mt-2 text-xs text-primary/60">
                        Active agent: {selectedVoiceAgent.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="mx-auto h-[220px] w-full max-w-[320px]">
                    <VoicePoweredOrb className="h-full w-full" hue={190} enableVoiceControl={false} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <Button
                      type="button"
                      onClick={() => void startVoiceSession()}
                      disabled={
                        !selectedVoiceAgentId ||
                        conversation.status === "connected" ||
                        conversation.status === "connecting"
                      }
                    >
                      {conversation.status === "connecting" ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mic className="mr-2 h-4 w-4" />
                      )}
                      Start voice chat
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void endVoiceSession()}
                      disabled={conversation.status === "disconnected"}
                    >
                      <PhoneOff className="mr-2 h-4 w-4" />
                      End session
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetVoiceChat}>
                      <MicOff className="mr-2 h-4 w-4" />
                      Clear transcript
                    </Button>
                  </div>
                  {voiceError ? (
                    <p className="mt-3 text-center text-xs text-[rgb(168,71,71)]">{voiceError}</p>
                  ) : null}
                </div>
              ) : (
                <>
                  <form onSubmit={submitPrompt}>
                    <Input
                      className="pl-12 pr-12"
                      placeholder="Ask ECareAI about visits, risks, or buddy matches"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                    />
                  </form>

                  <Button
                    variant="default"
                    size="icon"
                    className="absolute left-1.5 top-1.5 h-7 rounded-sm"
                    type="button"
                    onClick={resetTextChat}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="sr-only">New Chat</span>
                  </Button>

                  <Button
                    type="submit"
                    variant="default"
                    size="icon"
                    className="absolute right-1.5 top-1.5 h-7 rounded-sm"
                    onClick={(event) => void submitPrompt(event)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="mx-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mx-1 h-4 w-4" />
                    )}
                  </Button>

                  {chatError ? (
                    <p className="mt-2 px-2 text-xs text-[rgb(168,71,71)]">{chatError}</p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
