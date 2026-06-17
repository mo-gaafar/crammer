"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { countWords, estimateTtsCost, formatUsd } from "@/lib/tts-cost";
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
  scriptStatus?: "pending" | "generating" | "ready" | "error";
  scriptError?: string;
  audioStatus?: "idle" | "queued" | "generating" | "complete" | "error";
  audioChunksDone?: number;
  audioChunksTotal?: number;
  audioError?: string;
}

interface StagedFile {
  key: string;
  name: string;
  text: string;
}

type AddMode = "upload" | "paste";

function phaseOf(artifact: TextAudioArtifact): {
  label: string;
  badgeClass: string;
} {
  if (artifact.scriptStatus === "pending") return { label: "Waiting to write script", badgeClass: "badge-slate" };
  if (artifact.scriptStatus === "generating") return { label: "Writing script...", badgeClass: "badge-yellow" };
  if (artifact.scriptStatus === "error") return { label: "Script failed", badgeClass: "badge-red" };
  if (artifact.audioStatus === "queued") return { label: "Queued for audio", badgeClass: "badge-yellow" };
  if (artifact.audioStatus === "generating") return { label: "Creating audio...", badgeClass: "badge-yellow" };
  if (artifact.audioStatus === "error") return { label: "Audio failed", badgeClass: "badge-red" };
  if (artifact.audioUrl) return { label: "Done", badgeClass: "badge-green" };
  return { label: "Script ready", badgeClass: "badge-indigo" };
}

export default function TextToAudioPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settings = useSettings();
  const { geminiModel, ttsProvider } = settings;

  const [addMode, setAddMode] = useState<AddMode>("upload");
  const [useTextAsScript, setUseTextAsScript] = useState(false);
  const [batchTtsProvider, setBatchTtsProvider] = useState<TtsProvider>(ttsProvider);

  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [addingToQueue, setAddingToQueue] = useState(false);

  const [pastedSourceName, setPastedSourceName] = useState("Pasted text");
  const [pastedText, setPastedText] = useState("");
  const [generatingTextAudio, setGeneratingTextAudio] = useState(false);
  const [savingDirectScript, setSavingDirectScript] = useState(false);

  const [artifacts, setArtifacts] = useState<TextAudioArtifact[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [queueingAllAudio, setQueueingAllAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function withBusy<T>(id: string, fn: () => Promise<T>): Promise<T> {
    setBusyIds((prev) => new Set(prev).add(id));
    return fn().finally(() => {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  function mergeArtifact(updated: TextAudioArtifact) {
    setArtifacts((prev) => {
      const exists = prev.some((item) => item.id === updated.id);
      return exists
        ? prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
        : [updated, ...prev];
    });
  }

  async function refreshArtifacts(): Promise<TextAudioArtifact[]> {
    const res = await fetch("/api/text-audio");
    const data = await res.json();
    const next: TextAudioArtifact[] = data.artifacts ?? [];
    setArtifacts(next);
    return next;
  }

  useEffect(() => {
    refreshArtifacts().catch(() => {});
  }, []);

  useEffect(() => {
    const hasActiveJobs = artifacts.some(
      (artifact) =>
        artifact.scriptStatus === "pending" ||
        artifact.scriptStatus === "generating" ||
        artifact.audioStatus === "queued" ||
        artifact.audioStatus === "generating"
    );
    if (!hasActiveJobs) return;

    const timer = window.setInterval(() => {
      refreshArtifacts().catch(() => {});
    }, 1500);

    return () => window.clearInterval(timer);
  }, [artifacts]);

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    try {
      const read = await Promise.all(
        files.map(async (file) => ({
          key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          text: await file.text(),
        }))
      );
      setStagedFiles((prev) => [...prev, ...read]);
      setError(null);
    } catch {
      setError("Could not read one or more documents. Try plain text or Markdown files.");
    } finally {
      e.target.value = "";
    }
  }

  function removeStagedFile(key: string) {
    setStagedFiles((prev) => prev.filter((file) => file.key !== key));
  }

  const stagedAggregateCost = useMemo(() => {
    return stagedFiles.reduce(
      (acc, file) => {
        const estimate = estimateTtsCost(file.text);
        return {
          words: acc.words + estimate.wordCount,
          minutes: acc.minutes + estimate.estimatedAudioMinutes,
          usd: acc.usd + estimate.providers[batchTtsProvider].estimatedUsd,
        };
      },
      { words: 0, minutes: 0, usd: 0 }
    );
  }, [stagedFiles, batchTtsProvider]);

  async function handleAddBatchToQueue() {
    if (stagedFiles.length === 0) return;
    setAddingToQueue(true);
    setError(null);

    try {
      const res = await fetch("/api/text-audio/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: stagedFiles.map((file) => ({ sourceName: file.name, text: file.text })),
          geminiModel,
          useTextAsScript,
          ttsProvider: batchTtsProvider,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add documents to the queue");

      const created: TextAudioArtifact[] = data.artifacts ?? [];
      setArtifacts((prev) => [...created, ...prev]);
      setStagedFiles([]);
      if (data.skipped?.length) {
        setError(`Skipped (too short): ${data.skipped.join(", ")}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingToQueue(false);
    }
  }

  async function saveTextAudioArtifact(useAsScript: boolean) {
    if (!pastedText.trim()) return;
    if (useAsScript) setSavingDirectScript(true);
    else setGeneratingTextAudio(true);
    setError(null);

    try {
      const res = await fetch("/api/text-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceName: pastedSourceName || "Pasted text",
          text: pastedText,
          geminiModel,
          useTextAsScript: useAsScript,
          ttsProvider,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not prepare script");

      mergeArtifact(data.artifact);
      setPastedText("");
      setPastedSourceName("Pasted text");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.toLowerCase().includes("fetch")
          ? "The request could not reach the local API. Make sure the dev server is still running, then try again."
          : message
      );
    } finally {
      setGeneratingTextAudio(false);
      setSavingDirectScript(false);
    }
  }

  async function handleRetryScript(artifact: TextAudioArtifact) {
    await withBusy(artifact.id, async () => {
      setError(null);
      try {
        const res = await fetch(`/api/text-audio/${artifact.id}/script`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geminiModel }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not retry script");
        if (data.artifact) mergeArtifact(data.artifact);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        await refreshArtifacts().catch(() => {});
      }
    });
  }

  async function handleCreateAudio(artifact: TextAudioArtifact) {
    await withBusy(artifact.id, async () => {
      setError(null);
      mergeArtifact({ ...artifact, audioStatus: "queued", audioChunksDone: 0, audioError: undefined });
      try {
        const res = await fetch(`/api/text-audio/${artifact.id}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not create audio");
        if (data.artifact) mergeArtifact(data.artifact);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Audio failed: ${message}`);
        mergeArtifact({ ...artifact, audioStatus: "error", audioError: message });
      } finally {
        await refreshArtifacts().catch(() => {});
      }
    });
  }

  async function handleRemove(artifact: TextAudioArtifact) {
    await withBusy(artifact.id, async () => {
      setError(null);
      try {
        const res = await fetch(`/api/text-audio/${artifact.id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Could not remove item");
        }
        setArtifacts((prev) => prev.filter((item) => item.id !== artifact.id));
        setExpandedId((prev) => (prev === artifact.id ? null : prev));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const readyForAudio = artifacts.filter(
    (artifact) =>
      artifact.scriptStatus !== "pending" &&
      artifact.scriptStatus !== "generating" &&
      artifact.scriptStatus !== "error" &&
      !artifact.audioUrl &&
      artifact.audioStatus !== "queued" &&
      artifact.audioStatus !== "generating"
  );

  async function handleQueueAllAudio() {
    if (readyForAudio.length === 0) return;
    setQueueingAllAudio(true);
    setError(null);
    try {
      for (const artifact of readyForAudio) {
        mergeArtifact({ ...artifact, audioStatus: "queued", audioChunksDone: 0, audioError: undefined });
        const res = await fetch(`/api/text-audio/${artifact.id}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Could not queue ${artifact.sourceName}`);
        if (data.artifact) mergeArtifact(data.artifact);
      }
    } catch (err) {
      setError(`Batch queue failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await refreshArtifacts().catch(() => {});
      setQueueingAllAudio(false);
    }
  }

  const summary = useMemo(() => {
    const counts = {
      writing: 0,
      readyScript: 0,
      queuedAudio: 0,
      generatingAudio: 0,
      done: 0,
      failed: 0,
    };
    for (const artifact of artifacts) {
      if (artifact.scriptStatus === "pending" || artifact.scriptStatus === "generating") counts.writing++;
      else if (artifact.scriptStatus === "error" || artifact.audioStatus === "error") counts.failed++;
      else if (artifact.audioUrl) counts.done++;
      else if (artifact.audioStatus === "generating") counts.generatingAudio++;
      else if (artifact.audioStatus === "queued") counts.queuedAudio++;
      else counts.readyScript++;
    }
    return counts;
  }, [artifacts]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-stone-900">Text → Audio</h1>
        <p className="text-stone-600 max-w-xl mx-auto">
          Upload a batch of documents or paste text, queue them up, and StudyForge turns each one
          into a study script and audio you can listen to.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="section-title text-sm">Add to Queue</h2>
          <div className="flex rounded-lg border border-stone-200 p-0.5 bg-stone-100">
            <button
              onClick={() => setAddMode("upload")}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                addMode === "upload" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"
              }`}
            >
              Upload documents
            </button>
            <button
              onClick={() => setAddMode("paste")}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                addMode === "paste" ? "bg-white shadow-sm text-stone-900" : "text-stone-500"
              }`}
            >
              Paste text
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {addMode === "upload" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={addingToQueue}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                Choose documents
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                className="hidden"
                onChange={onFilesSelected}
              />
              <span className="text-xs text-stone-500">
                Select multiple .txt or .md files at once — they'll stage here before you add them
                to the queue.
              </span>
            </div>

            {stagedFiles.length > 0 && (
              <div className="space-y-2">
                {stagedFiles.map((file) => {
                  const words = countWords(file.text);
                  return (
                    <div
                      key={file.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-stone-800 truncate">{file.name}</div>
                        <div className="text-xs text-stone-500">{words.toLocaleString()} words</div>
                      </div>
                      <button
                        onClick={() => removeStagedFile(file.key)}
                        disabled={addingToQueue}
                        className="text-stone-400 hover:text-red-600 text-sm shrink-0 px-1"
                        aria-label={`Remove ${file.name}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  checked={!useTextAsScript}
                  onChange={() => setUseTextAsScript(false)}
                  disabled={addingToQueue}
                />
                Rewrite into a study script
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  checked={useTextAsScript}
                  onChange={() => setUseTextAsScript(true)}
                  disabled={addingToQueue}
                />
                Use as-is (already a script)
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-stone-500">TTS provider:</span>
              {(["gemini", "deepgram"] as const).map((provider) => (
                <button
                  key={provider}
                  onClick={() => setBatchTtsProvider(provider)}
                  disabled={addingToQueue}
                  className={`text-xs px-3 py-1.5 rounded-lg border capitalize transition-colors ${
                    batchTtsProvider === provider
                      ? "border-espresso-500 text-espresso-700 bg-espresso-500/10"
                      : "border-stone-300 text-stone-600 hover:border-stone-500"
                  }`}
                >
                  {provider}
                </button>
              ))}
            </div>

            {stagedFiles.length > 0 && (
              <div className="rounded-lg border border-stone-200 bg-stone-100/50 px-3 py-2 text-xs text-stone-600 flex flex-wrap gap-3">
                <span>{stagedFiles.length} document{stagedFiles.length !== 1 ? "s" : ""}</span>
                <span>{stagedAggregateCost.words.toLocaleString()} words</span>
                <span>~{stagedAggregateCost.minutes.toFixed(1)} min audio</span>
                <span className="font-semibold text-stone-800">
                  ~{formatUsd(stagedAggregateCost.usd)} estimated
                </span>
              </div>
            )}

            <button
              onClick={handleAddBatchToQueue}
              disabled={stagedFiles.length === 0 || addingToQueue}
              className="btn-primary flex items-center gap-2"
            >
              {addingToQueue
                ? "Adding to queue..."
                : `Add ${stagedFiles.length || ""} to Queue`.trim()}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              value={pastedSourceName}
              onChange={(e) => setPastedSourceName(e.target.value)}
              disabled={generatingTextAudio || savingDirectScript}
              className="input text-sm"
              placeholder="Source name, used for the audio filename"
            />
            <textarea
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
                if (pastedSourceName === "Pasted text") {
                  const firstWords = e.target.value.trim().split(/\s+/).slice(0, 6).join(" ");
                  if (firstWords) setPastedSourceName(firstWords);
                }
              }}
              disabled={generatingTextAudio || savingDirectScript}
              className="input min-h-40 resize-y text-sm leading-relaxed"
              placeholder="Paste lecture notes, textbook excerpts, slides text, or any study material here..."
            />
            <div className="flex flex-wrap gap-3 items-center">
              <button
                onClick={() => saveTextAudioArtifact(false)}
                disabled={!pastedText.trim() || generatingTextAudio || savingDirectScript}
                className="btn-primary flex items-center gap-2"
              >
                {generatingTextAudio ? "Creating study script..." : "Generate Study Script"}
              </button>
              <button
                onClick={() => saveTextAudioArtifact(true)}
                disabled={!pastedText.trim() || generatingTextAudio || savingDirectScript}
                className="btn-secondary flex items-center gap-2"
              >
                {savingDirectScript ? "Preparing script..." : "Use Text as Script"}
              </button>
              <span className="text-xs text-stone-500">
                Use Text as Script skips Gemini rewriting and sends the pasted script to TTS.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="section-title text-sm">Queue</h2>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-stone-500">
              {summary.writing > 0 && <span>{summary.writing} writing script</span>}
              {summary.readyScript > 0 && <span>{summary.readyScript} script ready</span>}
              {summary.queuedAudio > 0 && <span>{summary.queuedAudio} queued for audio</span>}
              {summary.generatingAudio > 0 && <span>{summary.generatingAudio} generating audio</span>}
              {summary.done > 0 && <span>{summary.done} done</span>}
              {summary.failed > 0 && <span className="text-red-600">{summary.failed} failed</span>}
              {artifacts.length === 0 && <span>Nothing queued yet</span>}
            </div>
          </div>
          {readyForAudio.length > 0 && (
            <button
              onClick={handleQueueAllAudio}
              disabled={queueingAllAudio}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              {queueingAllAudio
                ? "Queueing audio..."
                : `Queue Audio for ${readyForAudio.length} Ready Script${readyForAudio.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>

        {artifacts.length === 0 ? (
          <div className="text-center py-10 text-stone-500 text-sm">
            Upload documents or paste text above to add items to the queue.
          </div>
        ) : (
          <div className="space-y-2">
            {artifacts.map((artifact) => {
              const phase = phaseOf(artifact);
              const isExpanded = expandedId === artifact.id;
              const isBusy = busyIds.has(artifact.id);
              const ttsCost = artifact.ttsCostEstimate ?? estimateTtsCost(artifact.script);
              const provider = artifact.ttsProvider ?? "gemini";
              const estimate = ttsCost.providers[provider];
              const audioGenerating = artifact.audioStatus === "queued" || artifact.audioStatus === "generating";

              return (
                <div key={artifact.id} className="rounded-xl border border-stone-200 bg-stone-50/60">
                  <button
                    onClick={() => setExpandedId((prev) => (prev === artifact.id ? null : artifact.id))}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900 truncate">{artifact.title}</div>
                      <div className="text-xs text-stone-500 truncate">{artifact.sourceName}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-stone-500">{formatUsd(estimate.estimatedUsd)}</span>
                      <span className={phase.badgeClass}>{phase.label}</span>
                    </div>
                  </button>

                  {audioGenerating && (
                    <div className="px-4 pb-3">
                      <div className="h-1.5 w-full rounded-full bg-stone-200">
                        <div
                          className="h-1.5 rounded-full bg-espresso-500 transition-all"
                          style={{
                            width: artifact.audioChunksTotal
                              ? `${((artifact.audioChunksDone ?? 0) / artifact.audioChunksTotal) * 100}%`
                              : "8%",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="border-t border-stone-200 px-4 py-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span>{ttsCost.wordCount.toLocaleString()} words</span>
                        <span>~{ttsCost.estimatedAudioMinutes.toFixed(1)} min audio</span>
                        <span className="capitalize">{provider} TTS</span>
                      </div>

                      {artifact.scriptStatus === "error" && artifact.scriptError && (
                        <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-xs text-red-200">
                          Script failed: {artifact.scriptError}
                        </div>
                      )}
                      {artifact.audioStatus === "error" && artifact.audioError && (
                        <div className="rounded-lg border border-red-800 bg-red-950/40 p-3 text-xs text-red-200">
                          Audio failed: {artifact.audioError}
                        </div>
                      )}

                      {artifact.script && (
                        <div className="bg-stone-200/60 rounded-lg p-3 text-xs text-stone-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto border border-stone-300">
                          {artifact.script}
                        </div>
                      )}

                      {artifact.audioUrl && <audio controls src={artifact.audioUrl} className="w-full" />}

                      <div className="flex flex-wrap gap-2">
                        {artifact.scriptStatus === "error" && (
                          <button
                            onClick={() => handleRetryScript(artifact)}
                            disabled={isBusy}
                            className="btn-secondary text-xs py-1.5 px-3"
                          >
                            Retry script
                          </button>
                        )}
                        {artifact.scriptStatus !== "pending" &&
                          artifact.scriptStatus !== "generating" &&
                          artifact.scriptStatus !== "error" &&
                          !artifact.audioUrl && (
                            <button
                              onClick={() => handleCreateAudio(artifact)}
                              disabled={isBusy || audioGenerating}
                              className="btn-secondary text-xs py-1.5 px-3"
                            >
                              {artifact.audioStatus === "error" ? "Retry audio" : "Create audio"}
                            </button>
                          )}
                        {artifact.audioUrl && artifact.audioFileName && (
                          <a
                            href={artifact.audioUrl}
                            download={artifact.audioFileName}
                            className="btn-secondary text-xs py-1.5 px-3"
                          >
                            Download WAV
                          </a>
                        )}
                        <button
                          onClick={() => handleRemove(artifact)}
                          disabled={isBusy}
                          className="btn-danger text-xs py-1.5 px-3"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
