import { NextRequest, NextResponse } from "next/server";
import { voiceIntentSchema } from "@/lib/voice/schemas";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const FALLBACK_CATEGORIES = [
  "Alimentación",
  "Transporte",
  "Servicios",
  "Salud",
  "Educación",
  "Ropa",
  "Entretenimiento",
  "Vivienda",
  "Otros",
];

const FALLBACK_TYPES = ["Fijo", "Variable", "Suscripción", "Emergencia", "Ahorro"];

const LOCALE_NAMES: Record<"es" | "en", string> = {
  es: "Español",
  en: "English",
};

function stripFences(text: string): string {
  return text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

function buildSystemPrompt(ctx: {
  today: string;
  locale: "es" | "en";
  categories: string[];
  types: string[];
}): string {
  const { today, locale, categories, types } = ctx;
  const localeName = LOCALE_NAMES[locale];
  const dateWords =
    locale === "es"
      ? '"hoy", "ayer", "esta semana", "este mes", "el mes pasado", "este año"'
      : '"today", "yesterday", "this week", "this month", "last month", "this year"';

  return [
    "You are a voice command parser for an expense tracking app.",
    `Today's date is ${today}.`,
    `Supported categories: ${categories.join(", ")}.`,
    `Supported types: ${types.join(", ")}.`,
    "Currency: USD.",
    `The user's command is spoken in ${localeName}. Interpret numbers, currency, dates and category names accordingly.`,
    `Resolve relative date expressions (${dateWords}) against today's date (${today}) and output dates as YYYY-MM-DD.`,
    "",
    "Respond with a single JSON object ONLY, without markdown fences and without any additional text. The object must match exactly one of these shapes:",
    "",
    "1. Add an expense:",
    '{"intent":"add_expense","amount":<positive number, the total>,"currency":"USD","category":"<one of the supported categories if mentioned, otherwise omit>","type":"<one of the supported types if mentioned, otherwise omit>","description":"<full description the user gives, e.g. gasolina para moto, or omit>","date":"<YYYY-MM-DD>","details":[{"productName":"<product>","quantity":<number>,"unitPrice":<number>}, ...] or omit}',
    '   - If the user mentions several products with quantities and unit prices (e.g. "2 esfire a 5 y 1 captan a 10"), fill the "details" array and set "amount" to the total.',
    "",
    "2. Query a report:",
    '{"intent":"query_report","metric":"total|average|count|breakdown","category":"<optional category>","period":"today|this_week|this_month|this_year|custom","dateFrom":"<YYYY-MM-DD or omit>","dateTo":"<YYYY-MM-DD or omit>"}',
    "",
    "3. Delete an expense:",
    '{"intent":"delete_expense","reference":"<name, code or description fragment mentioned by the user>"}',
    "",
    "4. Navigate to a section:",
    '{"intent":"navigate","target":"<home|expenses|reports|settings|categories|types|trash or a similar section>"}',
    "",
    '5. If the command is unclear, ambiguous or unrelated:',
    '{"intent":"unclear","reason":"<short reason in the user\'s language>"}',
    "",
    "Rules:",
    "- Convert amounts spoken in words or numbers into a number.",
    '- The "category" field, when present, MUST be one of the supported categories listed above.',
    '- The "type" field, when present, MUST be one of the supported types listed above.',
    '- For a single simple expense, omit "details".',
    '- Keep "currency" as "USD".',
    "- Output ONLY the JSON object.",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  let body: {
    transcript?: string;
    locale?: string;
    categories?: string[];
    types?: string[];
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const transcript = (body.transcript || "").trim();
  const locale = body.locale === "en" ? "en" : "es";
  const categories =
    Array.isArray(body.categories) && body.categories.length
      ? body.categories.slice(0, 30).map((c) => String(c))
      : FALLBACK_CATEGORIES;
  const types =
    Array.isArray(body.types) && body.types.length
      ? body.types.slice(0, 30).map((t) => String(t))
      : FALLBACK_TYPES;

  if (!transcript) {
    return NextResponse.json({ intent: "unclear", reason: "empty_transcript" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ intent: "unclear", reason: "missing_api_key" });
  }

  const today = new Date().toISOString().split("T")[0];
  const system = buildSystemPrompt({ today, locale, categories, types });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }],
          },
          contents: [{ parts: [{ text: transcript }] }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 400,
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("Gemini error", res.status, await res.text());
      return NextResponse.json({ intent: "unclear", reason: "parse_error" });
    }

    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let json: unknown;
    try {
      json = JSON.parse(stripFences(raw));
    } catch {
      return NextResponse.json({ intent: "unclear", reason: "invalid_json" });
    }

    const parsed = voiceIntentSchema.safeParse(json);
    if (!parsed.success) {
      console.error("Voice schema mismatch", parsed.error.flatten());
      return NextResponse.json({ intent: "unclear", reason: "schema_mismatch" });
    }

    return NextResponse.json(parsed.data);
  } catch (err) {
    console.error("Voice parse error", err);
    return NextResponse.json({ intent: "unclear", reason: "parse_error" });
  }
}
