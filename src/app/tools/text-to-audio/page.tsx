"use client";

import { useEffect, useRef, useState } from "react";
import { estimateTtsCost, formatUsd } from "@/lib/tts-cost";
import { useSettings, type TtsProvider } from "@/lib/use-settings";
import type { TtsCostEstimate } from "@/types";

interface TextAudioArtifact {
  id: string;
  sourceName: string;
  title: string;
  script: string;
  ttsProvider?: TtsProvider;
  ttsCostEstimate?: TtsCostEstimate;
  audioFileName?: string;
  audioUrl?: string | null;
  audioStatus?: "idle" | "queued" | "generating" | "complete" | "error";
  audioChunksDone?: number;
  audioChunksTotal?: number;
  audioError?: string;
}

export default function TextToAudioPage() {
  const textFileInputRef = useRef<HTMLInputElement>(null);
  const settings = useSettings();
  const { geminiModel, ttsProvider } = settings;

  const [textSourceName, setTextSourceName] = useState("Pasted text");
  const [pastedText, setPastedText] = useState("");
  const [textAudioArtifacts, setTextAudioArtifacts] = useState<TextAudioArtifact[]>([]);
  const [activeTextAudio, setActiveTextAudio] = useState<TextAudioArtifact | null>(null);
  const [generatingTextAudio, setGeneratingTextAudio] = useState(false);
  const [savingDirectScript, setSavingDirectScript] = useState(false);
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
  const [queueingAllAudio, setQueueingAllAudio] = useState(false);
  const [textAudioError, setTextAudioError] = useState<string | null>(null);

  function mergeTextAudioArtifact(updated: TextAudioArtifact) {
    setTextAudioArtifacts((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
    setActiveTextAudio((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  }

  async function refreshTextAudioArtifact(id: string): Promise<TextAudioArtifact | undefined> {
    const res = await fetch("/api/text-audio");
    const data = await res.json();
    const artifacts: TextAudioArtifact[] = data.artifacts ?? [];
    setTextAudioArtifacts(artifacts);
    const updated = artifacts.find((item) => item.id === id);
    if (updated) setActiveTextAudio((prev) => (prev?.id === id ? updated : prev));
    return updated;
  }

  useEffect(() => {
    fetch("/api/text-audio")
      .then((r) => r.json())
      .then((data) => {
        const artifacts: TextAudioArtifact[] = data.artifacts ?? [];
        setTextAudioArtifacts(artifacts);
        if (artifacts[0]) setActiveTextAudio(artifacts[0]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const hasActiveAudioJobs = textAudioArtifacts.some(
      (artifact) => artifact.audioStatus === "queued" || artifact.audioStatus === "generating"
    );
    if (!hasActiveAudioJobs) return;

    const timer = window.setInterval(() => {
      fetch("/api/text-audio")
        .then((r) => r.json())
        .then((data) => {
          const artifacts: TextAudioArtifact[] = data.artifacts ?? [];
          setTextAudioArtifacts(artifacts);
          setActiveTextAudio((prev) =>
            prev ? artifacts.find((artifact) => artifact.id === prev.id) ?? prev : artifacts[0] ?? null
          );
        })
        .catch(() => {});
    }, 1500);

    return () => window.clearInterval(timer);
  }, [textAudioArtifacts]);

  async function onTextFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setPastedText(text);
      setTextSourceName(file.name);
      setTextAudioError(null);
    } catch {
      setTextAudioError("Could not read that document. Try a plain text or Markdown file.");
    } finally {
      e.target.value = "";
    }
  }

  async function saveTextAudioArtifact(useTextAsScript: boolean) {
    if (!pastedText.trim()) return;
    if (useTextAsScript) {
      setSavingDirectScript(true);
    } else {
      setGeneratingTextAudio(true);
    }
    setTextAudioError(null);

    try {
      const res = await fetch("/api/text-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceName: textSourceName || "Pasted text",
          text: pastedText,
          geminiModel,
          useTextAsScript,
          ttsProvider,
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(data.error ?? "Could not prepare script");

      const artifact: TextAudioArtifact = data.artifact;
      setTextAudioArtifacts((prev) => [artifact, ...prev]);
      setActiveTextAudio(artifact);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTextAudioError(
        message.toLowerCase().includes("fetch")
          ? "The text-to-audio request could not reach the local API. Make sure the dev server is still running, then try again."
          : message
      );
    } finally {
      setGeneratingTextAudio(false);
      setSavingDirectScript(false);
    }
  }

  async function handleGenerateTextAudio() {
    await saveTextAudioArtifact(false);
  }

  async function handleUsePastedScript() {
    await saveTextAudioArtifact(true);
  }

  async function handleCreateAudio(artifact: TextAudioArtifact) {
    setGeneratingAudioId(artifact.id);
    setTextAudioError(null);
    mergeTextAudioArtifact({
      ...artifact,
      audioStatus: "queued",
      audioChunksDone: 0,
      audioError: undefined,
    });

    try {
      const res = await fetch(`/api/text-audio/${artifact.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create audio");

      const updated: TextAudioArtifact = data.artifact;
      mergeTextAudioArtifact(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTextAudioError(`Audio failed: ${message}`);
      mergeTextAudioArtifact({
        ...artifact,
        audioStatus: "error",
        audioError: message,
      });
    } finally {
      await refreshTextAudioArtifact(artifact.id).catch(() => {});
      setGeneratingAudioId(null);
    }
  }

  async function handleQueueAllAudio() {
    const toQueue = textAudioArtifacts.filter(
      (artifact) =>
        !artifact.audioUrl &&
        artifact.audioStatus !== "queued" &&
        artifact.audioStatus !== "generating"
    );
    if (toQueue.length === 0) return;

    setQueueingAllAudio(true);
    setTextAudioError(null);
    try {
      for (const artifact of toQueue) {
        mergeTextAudioArtifact({
          ...artifact,
          audioStatus: "queued",
          audioChunksDone: 0,
          audioError: undefined,
        });
        const res = await fetch(`/api/text-audio/${artifact.id}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Could not queue ${artifact.sourceName}`);
        if (data.artifact) mergeTextAudioArtifact(data.artifact);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTextAudioError(`Batch queue failed: ${message}`);
    } finally {
      await refreshTextAudioArtifact(activeTextAudio?.id ?? toQueue[0].id).catch(() => {});
      setQueueingAllAudio(false);
    }
  }

  const activeAudioIsGenerating =
    activeTextAudio?.audioStatus === "queued" || activeTextAudio?.audioStatus === "generating";
  const queueableTextAudioCount = textAudioArtifacts.filter(
    (artifact) =>
      !artifact.audioUrl &&
      artifact.audioStatus !== "queued" &&
      artifact.audioStatus !== "generating"
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-stone-900">Text → Audio</h1>
        <p className="text-stone-600 max-w-xl mx-auto">
          Paste notes for a rewritten study script, or paste a finished script and send it
          straight to audio.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h2 className="section-title text-sm">Source</h2>
          <button
            onClick={() => textFileInputRef.current?.click()}
            disabled={generatingTextAudio || savingDirectScript || queueingAllAudio || generatingAudioId !== null}
            className="btn-secondary text-xs py-1.5 px-3 shrink-0"
          >
            Load document
          </button>
          <input
            ref={textFileInputRef}
            type="file"
            accept=".txt,.md,.markdown,text/plain,text/markdown"
            className="hidden"
            onChange={onTextFileInput}
          />
        </div>

        <input
          value={textSourceName}
          onChange={(e) => setTextSourceName(e.target.value)}
          disabled={generatingTextAudio || savingDirectScript || generatingAudioId !== null}
          className="input text-sm"
          placeholder="Source name, used for the audio filename"
        />
        <textarea
          value={pastedText}
          onChange={(e) => {
            setPastedText(e.target.value);
            if (textSourceName === "Pasted text") {
              const firstWords = e.target.value.trim().split(/\s+/).slice(0, 6).join(" ");
              if (firstWords) setTextSourceName(firstWords);
            }
          }}
          disabled={generatingTextAudio || savingDirectScript || generatingAudioId !== null}
          className="input min-h-40 resize-y text-sm leading-relaxed"
          placeholder="Paste lecture notes, textbook excerpts, slides text, or any study material here..."
        />

        {textAudioError && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
            {textAudioError}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={handleGenerateTextAudio}
            disabled={!pastedText.trim() || generatingTextAudio || savingDirectScript}
            className="btn-primary flex items-center gap-2"
          >
            {generatingTextAudio ? (
              <>
                <span className="animate-spin">...</span>
                Creating study script...
              </>
            ) : (
              "Generate Study Script"
            )}
          </button>
          <button
            onClick={handleUsePastedScript}
            disabled={!pastedText.trim() || generatingTextAudio || savingDirectScript}
            className="btn-secondary flex items-center gap-2"
          >
            {savingDirectScript ? "Preparing script..." : "Use Text as Script"}
          </button>
          <span className="text-xs text-stone-500">
            Use Text as Script skips Gemini rewriting and sends the pasted script to TTS.
          </span>
          {textAudioArtifacts.length > 0 && (
            <button
              onClick={handleQueueAllAudio}
              disabled={queueableTextAudioCount === 0 || queueingAllAudio}
              className="btn-secondary flex items-center gap-2"
            >
              {queueingAllAudio
                ? "Queueing audio..."
                : `Queue ${queueableTextAudioCount} Audio Job${queueableTextAudioCount !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>

        {activeTextAudio && (
          <div className="bg-stone-100/50 rounded-xl p-4 space-y-3 border border-stone-200">
            {(() => {
              const ttsCost =
                activeTextAudio.ttsCostEstimate ?? estimateTtsCost(activeTextAudio.script);
              return (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-stone-900 truncate">{activeTextAudio.title}</h3>
                      <p className="text-xs text-stone-500 truncate">
                        {activeTextAudio.sourceName}
                        {activeTextAudio.audioFileName ? ` -> ${activeTextAudio.audioFileName}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span>{ttsCost.wordCount.toLocaleString()} words</span>
                        <span>{ttsCost.characterCount.toLocaleString()} chars</span>
                        <span>~{ttsCost.estimatedAudioMinutes.toFixed(1)} min audio</span>
                      </div>
                    </div>
                    {activeTextAudio.audioUrl && activeTextAudio.audioFileName && (
                      <a
                        href={activeTextAudio.audioUrl}
                        download={activeTextAudio.audioFileName}
                        className="btn-secondary text-xs py-1.5 px-3 shrink-0"
                      >
                        Download WAV
                      </a>
                    )}
                    {!activeTextAudio.audioUrl && (
                      <button
                        onClick={() => handleCreateAudio(activeTextAudio)}
                        disabled={activeAudioIsGenerating}
                        className="btn-secondary text-xs py-1.5 px-3 shrink-0"
                      >
                        {activeTextAudio.audioStatus === "queued"
                          ? "Queued for audio..."
                          : activeTextAudio.audioStatus === "generating"
                            ? "Creating audio chunks..."
                            : "Create audio"}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(["gemini", "deepgram"] as const).map((provider) => {
                      const estimate = ttsCost.providers[provider];
                      const isSelected = (activeTextAudio.ttsProvider ?? "gemini") === provider;
                      return (
                        <div
                          key={provider}
                          className={`rounded-lg border px-3 py-2 ${
                            isSelected
                              ? "border-espresso-700 bg-espresso-50"
                              : "border-stone-300 bg-stone-50/40"
                          }`}
                          title={estimate.billingBasis}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-stone-600 capitalize">{provider} TTS</span>
                            {isSelected && <span className="text-espresso-700">selected</span>}
                          </div>
                          <div className="text-stone-900 font-semibold">
                            {formatUsd(estimate.estimatedUsd)}
                          </div>
                          <div className="text-stone-500">{estimate.model}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
            {activeAudioIsGenerating && (
              <div className="rounded-lg border border-espresso-200 bg-espresso-50 p-3">
                <div className="mb-1 flex justify-between text-xs text-espresso-800">
                  <span>
                    {activeTextAudio.audioStatus === "queued"
                      ? "Waiting in TTS queue"
                      : "Creating audio chunks"}
                  </span>
                  <span>
                    {activeTextAudio.audioChunksDone ?? 0}
                    {activeTextAudio.audioChunksTotal ? `/${activeTextAudio.audioChunksTotal}` : ""}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-stone-200">
                  <div
                    className="h-1.5 rounded-full bg-espresso-500 transition-all"
                    style={{
                      width: activeTextAudio.audioChunksTotal
                        ? `${((activeTextAudio.audioChunksDone ?? 0) / activeTextAudio.audioChunksTotal) * 100}%`
                        : "8%",
                    }}
                  />
                </div>
              </div>
            )}
            {!activeAudioIsGenerating && activeTextAudio.audioStatus === "error" && activeTextAudio.audioError && (
              <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-xs text-red-200">
                Audio failed: {activeTextAudio.audioError}
              </div>
            )}
            {activeTextAudio.audioUrl ? (
              <audio controls src={activeTextAudio.audioUrl} className="w-full" />
            ) : (
              <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-xs text-amber-200">
                Audio is not available for this script yet.
              </div>
            )}
            <div className="bg-stone-200/60 rounded-lg p-3 text-xs text-stone-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto border border-stone-300">
              {activeTextAudio.script}
            </div>
          </div>
        )}

        {textAudioArtifacts.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-stone-500 self-center">Generated:</span>
            {textAudioArtifacts.map((artifact) => (
              <button
                key={artifact.id}
                onClick={() => setActiveTextAudio(artifact)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  activeTextAudio?.id === artifact.id
                    ? "border-espresso-500 text-espresso-700 bg-espresso-500/10"
                    : "border-stone-300 text-stone-600 hover:border-stone-500"
                }`}
              >
                {artifact.sourceName}
                {artifact.audioStatus === "queued" && " · queued"}
                {artifact.audioStatus === "generating" && " · running"}
                {artifact.audioStatus === "complete" && " · done"}
                {artifact.audioStatus === "error" && " · failed"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
