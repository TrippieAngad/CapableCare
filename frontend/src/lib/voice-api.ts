const DEFAULT_VOICE_API_BASE_URL = "http://127.0.0.1:8787";

export const VOICE_API_BASE_URL = (
  import.meta.env.VITE_VOICE_API_BASE_URL || DEFAULT_VOICE_API_BASE_URL
).replace(/\/$/, "");

export function buildVoiceApiUrl(path: string) {
  if (!path.startsWith("/")) {
    throw new Error("Voice API path must start with /");
  }

  return `${VOICE_API_BASE_URL}${path}`;
}
