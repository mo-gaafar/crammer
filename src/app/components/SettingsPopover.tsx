"use client";

import { useEffect, useRef, useState } from "react";
import { GEMINI_MODELS } from "@/lib/gemini-models";
import { useSettings, type SttProvider, type TtsProvider } from "@/lib/use-settings";

export default function SettingsPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const settings = useSettings();

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const modelLabel =
    GEMINI_MODELS.find((m) => m.id === settings.geminiModel)?.label ?? settings.geminiModel;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-100/70 px-2.5 py-1.5 text-xs text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-800"
        title="Provider settings"
      >
        <span aria-hidden>⚙</span>
        <span className="hidden sm:inline truncate max-w-[14rem]">
          {settings.sttProvider === "deepgram" ? "Deepgram" : "Gemini"} STT &middot; {modelLabel}
        </span>
      </button>

      {open && (
        <div className="popover absolute right-0 top-full z-50 mt-2 w-72">
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">Transcription Provider</label>
              <div className="flex gap-2">
                {(["deepgram", "gemini"] as SttProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => settings.setSttProvider(p)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      settings.sttProvider === p
                        ? "border-espresso-500 bg-espresso-600 text-white"
                        : "border-stone-300 bg-stone-200 text-stone-600 hover:border-stone-500"
                    }`}
                  >
                    {p === "deepgram" ? "Deepgram Nova-2" : "Gemini STT"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">Audio Synthesis Provider</label>
              <div className="flex gap-2">
                {(["gemini", "deepgram"] as TtsProvider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => settings.setTtsProvider(p)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      settings.ttsProvider === p
                        ? "border-espresso-500 bg-espresso-600 text-white"
                        : "border-stone-300 bg-stone-200 text-stone-600 hover:border-stone-500"
                    }`}
                  >
                    {p === "deepgram" ? "Deepgram Aura" : "Gemini TTS"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-stone-600">
                Gemini Model <span className="text-stone-400">(inference &amp; STT)</span>
              </label>
              <select
                value={settings.geminiModel}
                onChange={(e) => settings.setGeminiModel(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-stone-200 px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-espresso-500"
              >
                {GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {settings.sttProvider === "gemini" && (
              <p className="text-xs text-amber-400/80">
                Gemini STT uses the Files API — audio is uploaded temporarily then deleted after
                transcription.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
