"use client";

import { useEffect, useState } from "react";
import { DEFAULT_GEMINI_MODEL } from "@/lib/gemini-models";

export type SttProvider = "deepgram" | "gemini";
export type TtsProvider = "gemini" | "deepgram";

interface Settings {
  sttProvider: SttProvider;
  ttsProvider: TtsProvider;
  geminiModel: string;
}

const STORAGE_KEYS = {
  sttProvider: "sttProvider",
  ttsProvider: "ttsProvider",
  geminiModel: "geminiModel",
} as const;

let current: Settings = {
  sttProvider: "deepgram",
  ttsProvider: "gemini",
  geminiModel: DEFAULT_GEMINI_MODEL,
};
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const savedStt = localStorage.getItem(STORAGE_KEYS.sttProvider) as SttProvider | null;
  const savedTts = localStorage.getItem(STORAGE_KEYS.ttsProvider) as TtsProvider | null;
  const savedModel = localStorage.getItem(STORAGE_KEYS.geminiModel);
  current = {
    sttProvider: savedStt ?? current.sttProvider,
    ttsProvider: savedTts ?? current.ttsProvider,
    geminiModel: savedModel ?? current.geminiModel,
  };
}

function emit() {
  listeners.forEach((listener) => listener());
}

function update(partial: Partial<Settings>) {
  current = { ...current, ...partial };
  if (partial.sttProvider) localStorage.setItem(STORAGE_KEYS.sttProvider, partial.sttProvider);
  if (partial.ttsProvider) localStorage.setItem(STORAGE_KEYS.ttsProvider, partial.ttsProvider);
  if (partial.geminiModel) localStorage.setItem(STORAGE_KEYS.geminiModel, partial.geminiModel);
  emit();
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(current);

  useEffect(() => {
    hydrate();
    setSettings(current);
    const listener = () => setSettings(current);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    ...settings,
    setSttProvider: (p: SttProvider) => update({ sttProvider: p }),
    setTtsProvider: (p: TtsProvider) => update({ ttsProvider: p }),
    setGeminiModel: (m: string) => update({ geminiModel: m }),
  };
}
