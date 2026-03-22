export interface GeminiMessage {
  role: "user" | "assistant";
  text: string;
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";

export async function generateGeminiReply(history: GeminiMessage[]) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_GEMINI_API_KEY");
  }

  const response = await fetch(
    `${GEMINI_API_URL}/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are ECareAI, a concise care-coordination assistant. " +
                "Help with eldercare planning, visit logistics, family updates, caretaker fit, and risk summaries. " +
                "Do not claim access to records unless the user provided them in the conversation.",
            },
          ],
        },
        contents: history.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.text }],
        })),
      }),
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message || "Gemini request failed";
    throw new Error(message);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}
