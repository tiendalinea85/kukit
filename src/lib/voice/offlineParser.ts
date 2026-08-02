import { normalizeText } from "@/utils/text";
import type { VoiceIntent } from "./schemas";

const AMOUNT_PATTERN =
  /(?:gast[ée]|gast[ée] en|spent|spend)\s+([\d]+(?:[.,][\d]{1,2})?)\s*(?:d[oó]lares|dolares|dollar\w*|usd|soles)?\s+(?:en|de|on|in)?\s*(.*)/i;

function parseAmount(raw: string): number | null {
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const value = parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function offlineParse(
  transcript: string,
  locale: "es" | "en",
  categories: string[]
): VoiceIntent | null {
  const text = transcript.trim();
  if (!text) return null;

  const match = text.match(AMOUNT_PATTERN);
  if (!match) return null;

  const amount = parseAmount(match[1]);
  if (!amount) return null;

  const category = categories.find((c) =>
    normalizeText(text).includes(normalizeText(c))
  );

  return {
    intent: "add_expense",
    amount,
    currency: "USD",
    category: category || undefined,
    description: category ? undefined : match[3]?.trim() || undefined,
    date: new Date().toISOString().split("T")[0],
  };
}
