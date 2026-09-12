"use client";
import { useState, useCallback } from "react";
import type { OcrResult } from "../schemas/ocrSchema";

interface UseOCRState {
  extracting: boolean;
  error: string | null;
  result: OcrResult | null;
}

export function useOCR() {
  const [state, setState] = useState<UseOCRState>({
    extracting: false,
    error: null,
    result: null,
  });

  const extractFromImage = useCallback(
    async (base64: string): Promise<OcrResult | null> => {
      setState({ extracting: true, error: null, result: null });
      try {
        const res = await fetch("/api/ai/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.reason || `Error ${res.status}`);
        }
        const data: OcrResult = await res.json();
        setState({ extracting: false, error: null, result: data });
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al extraer datos";
        setState({ extracting: false, error: msg, result: null });
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setState({ extracting: false, error: null, result: null });
  }, []);

  return { ...state, extractFromImage, reset };
}
