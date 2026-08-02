"use client";
import { useCallback, useEffect, useState } from "react";

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string, lang: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.05;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return { speak, cancel, speaking };
}
