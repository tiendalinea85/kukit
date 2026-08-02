"use client";
import type { VoiceIntent } from "./schemas";
import { offlineParse } from "./offlineParser";

export async function parseVoiceTranscript(
  transcript: string,
  locale: "es" | "en",
  categories: string[],
  online: boolean,
  types: string[] = []
): Promise<VoiceIntent> {
  if (!online) {
    const parsed = offlineParse(transcript, locale, categories);
    if (parsed) return parsed;
    return { intent: "unclear", reason: "offline" };
  }

  try {
    const res = await fetch("/api/voice/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, locale, categories, types }),
    });
    if (!res.ok) throw new Error(`voice parse failed: ${res.status}`);
    const data = await res.json();
    return data as VoiceIntent;
  } catch {
    return { intent: "unclear", reason: "parse_error" };
  }
}
