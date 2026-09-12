import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ocrResultSchema } from "@/features/invoice/schemas/ocrSchema";
import { isSupabaseConfigured } from "@/lib/supabase";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_IMAGE_CHARS = 10_000_000;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const rateLimit = new Map<string, { count: number; resetAt: number }>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimited(req: NextRequest): boolean {
  const key = clientIp(req);
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt <= now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

async function isAuthenticatedRequest(req: NextRequest): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await sb.auth.getUser(token);
  return !!data.user;
}

function stripFences(text: string): string {
  return text
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

function buildOcrPrompt(): string {
  return [
    "Eres un asistente de OCR especializado en facturas, boletas y notas de venta.",
    "Analiza la imagen proporcionada y extrae la siguiente información:",
    "- proveedor (nombre del vendedor/empresa)",
    "- invoiceNumber (número de factura, boleta o comprobante)",
    "- date (fecha en formato YYYY-MM-DD, si no se ve clara usa null)",
    "- items (lista de productos/servicios: description, quantity, unitPrice)",
    "- total (monto total de la transacción)",
    "- currency (moneda, default USD)",
    "- confidence (high si todos los campos clave están claros, medium si algunos son inciertos, low si la imagen es borrosa)",
    "",
    "REGLAS IMPORTANTES:",
    "- NO inventes información que no sea visible en la imagen.",
    "- Si un campo no es legible, úsalo como null u omitido.",
    "- quantity debe ser un número positivo (default 1 si no se ve).",
    "- unitPrice debe ser el precio unitario sin impuestos.",
    "- total debe ser el monto final visible en la factura.",
    "- Si la imagen no parece una factura/boleta, retorna confidence: low y fields vacíos.",
    "- Responde SOLO con el JSON, sin texto adicional.",
    "",
    "Formato de respuesta:",
    '{"supplier":"...","invoiceNumber":"...","date":"YYYY-MM-DD","items":[{"description":"...","quantity":1,"unitPrice":0.00}],"total":0.00,"currency":"USD","confidence":"high|medium|low"}',
  ].join("\n");
}

function getDataParts(base64: string): { mimeType: string; data: string } {
  const match = base64.match(/^data:(.+?);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: "image/jpeg", data: base64 };
}

export async function POST(req: NextRequest) {
  let body: { imageBase64?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const imageBase64 = (body.imageBase64 || "").trim();

  if (!imageBase64) {
    return NextResponse.json(
      { reason: "image_required", message: "Se requiere una imagen" },
      { status: 400 },
    );
  }

  if (imageBase64.length > MAX_IMAGE_CHARS) {
    return NextResponse.json(
      { reason: "image_too_large", message: "La imagen excede el tamaño máximo" },
      { status: 413 },
    );
  }

  if (rateLimited(req)) {
    return NextResponse.json(
      { reason: "rate_limited", message: "Demasiadas solicitudes" },
      { status: 429 },
    );
  }

  if (!(await isAuthenticatedRequest(req))) {
    return NextResponse.json(
      { reason: "unauthorized", message: "No autenticado" },
      { status: 401 },
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { reason: "missing_api_key", message: "API key no configurada" },
      { status: 500 },
    );
  }

  const { mimeType, data } = getDataParts(imageBase64);
  const prompt = buildOcrPrompt();

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: prompt }],
          },
          contents: [
            {
              parts: [
                { inlineData: { mimeType, data } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 800,
          },
        }),
      },
    );

    if (!res.ok) {
      const errText = (await res.text()).slice(0, 500);
      console.error("Gemini OCR error", res.status, errText);
      return NextResponse.json(
        { reason: "ai_error", message: "Error al procesar la imagen" },
        { status: 502 },
      );
    }

    const data2 = await res.json();
    const raw = data2?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let json: unknown;
    try {
      json = JSON.parse(stripFences(raw));
    } catch {
      return NextResponse.json(
        { reason: "invalid_json", message: "Respuesta inválida del modelo" },
        { status: 502 },
      );
    }

    const parsed = ocrResultSchema.safeParse(json);
    if (!parsed.success) {
      console.error("OCR schema mismatch", parsed.error.flatten());
      return NextResponse.json(
        { reason: "schema_mismatch", message: "Datos extraídos inválidos" },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed.data);
  } catch (err) {
    console.error("OCR processing error", err);
    return NextResponse.json(
      { reason: "processing_error", message: "Error al procesar la solicitud" },
      { status: 500 },
    );
  }
}
