import { normalizeText } from "@/utils/text";
import type { VoiceIntent } from "./schemas";

const NUMBER = String.raw`(\d{1,3}(?:[.,]\d{1,2})?)`;
const CURRENCY = String.raw`\s*(?:d[oó]lares?|dolares|usd|pesos|soles)?`;

const PATTERNS: RegExp[] = [
  new RegExp(
    String.raw`(?:gast[ée]|gaste|gastando)\s+(?:un|una|unos|unas|el|la|los|las)?\s*(?:total\s+de\s+|aprox\.?\s+)?${NUMBER}${CURRENCY}`,
    "i"
  ),
  new RegExp(
    String.raw`(?:agrega|agregar|registra|registrar|anota|a[ñn]ade|crea|crear)\s+(?:un|una)?\s*(?:nuev[oa]\s+)?gasto\s+(?:de|por)\s+${NUMBER}${CURRENCY}`,
    "i"
  ),
  new RegExp(
    String.raw`(?:nuev[oa]\s+)?gasto\s+(?:de|por)\s+${NUMBER}${CURRENCY}`,
    "i"
  ),
  new RegExp(
    String.raw`(?:compr[ée]|compre|pagu[ée]|pague)(?=[\s,.;:]|$)[\s\S]{0,40}?${NUMBER}${CURRENCY}`,
    "i"
  ),
  new RegExp(String.raw`\b${NUMBER}\s*(?:d[oó]lares?|dolares|usd|pesos|soles)\b`, "i"),
];

const FILLER_WORDS =
  "gast|gastando|agrega|agregar|registra|registrar|anota|a[ñn]ade|crea|crear|nuev[oa]|gasto|compra|compr|compre|pagu|pague|en|de|por|con|el|la|los|las|un|una|unos|unas|del|al|total|aproximadamente|que|para|comprado";

const NEW_EXPENSE_PATTERNS: RegExp[] = [
  new RegExp(
    String.raw`\b(?:registra(?:r)?|agregar?|a[ñn]adir?|a[ñn]ade|crea(?:r)?|anota(?:r)?|poner|pon|nuev[oa])\b[\s\S]{0,12}?\bgast(?:o|os|a|as)\b`,
    "i"
  ),
  new RegExp(
    String.raw`\b(?:add|new|create|register|log)\b[\s\S]{0,12}?\bexpense\b`,
    "i"
  ),
];

function parseAmount(raw: string): number | null {
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const value = parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractDescription(
  raw: string,
  amountText: string,
  category?: string
): string | undefined {
  let desc = raw;
  const idx = raw.indexOf(amountText);
  if (idx >= 0) {
    desc = `${raw.slice(0, idx)} ${raw.slice(idx + amountText.length)}`;
  }
  if (category) {
    desc = desc.replace(new RegExp(`\\b${escapeRegExp(category)}\\b`, "ig"), " ");
  }
  desc = desc
    .replace(new RegExp(`\\b(?:${FILLER_WORDS})\\b`, "gi"), " ")
    .replace(/\s+/g, " ")
    .trim();
  return desc || undefined;
}

export function offlineParse(
  transcript: string,
  locale: "es" | "en",
  categories: string[]
): VoiceIntent | null {
  const text = transcript.trim();
  if (!text) return null;

  let amount: number | null = null;
  let amountText: string | null = null;

  for (const pattern of PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const parsed = parseAmount(match[1]);
    if (!parsed) continue;
    amount = parsed;
    amountText = match[0];
    break;
  }

  if (!amount || amountText === null) {
    for (const pattern of NEW_EXPENSE_PATTERNS) {
      if (pattern.test(text)) {
        return { intent: "navigate", target: "/expenses/new" };
      }
    }
    return null;
  }

  const category = categories.find((c) =>
    normalizeText(text).includes(normalizeText(c))
  );

  const description = category
    ? undefined
    : extractDescription(text, amountText);

  return {
    intent: "add_expense",
    amount,
    currency: "USD",
    category: category || undefined,
    description,
    date: new Date().toISOString().split("T")[0],
  };
}
