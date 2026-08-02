"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface VoiceRecognitionOptions {
  lang: string;
  onResult: (transcript: string, isFinal: boolean) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useVoiceRecognition({
  lang,
  onResult,
  onEnd,
  onError,
}: VoiceRecognitionOptions) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const supported = typeof window !== "undefined" && !!getRecognitionConstructor();

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const Ctor = getRecognitionConstructor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) finalText += text;
        else interimText += text;
      }
      if (finalText) {
        const trimmed = finalText.trim();
        setTranscript(trimmed);
        onResultRef.current(trimmed, true);
      } else if (interimText) {
        const trimmed = interimText.trim();
        setTranscript(trimmed);
        onResultRef.current(trimmed, false);
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      onErrorRef.current?.(event.error);
    };

    recognition.onend = () => {
      setIsListening(false);
      onEndRef.current?.();
    };

    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
      recognitionRef.current = null;
      setIsListening(false);
    };
  }, [supported, lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.start();
    } catch {
      // Recognition already started; ignore.
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // Ignore.
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => setTranscript(""), []);

  return { isListening, transcript, supported, start, stop, reset };
}
