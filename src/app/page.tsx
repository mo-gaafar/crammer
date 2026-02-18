"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface FileEntry {
  id: string;
  name: string;
  size: number;
  status: "uploaded" | "transcribing" | "transcribed" | "error";
  recordedAt: string;
  errorMessage?: string;
}

type Phase = "idle" | "uploading" | "transcribing" | "processing" | "complete" | "error";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: FileEntry["status"] }) {
  const map: Record<FileEntry["status"], string> = {
    uploaded: "badge-slate",
    transcribing: "badge-yellow animate-pulse",
    transcribed: "badge-green",
    error: "badge-red",
  };
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseMessage, setPhaseMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [transcribeProgress, setTranscribeProgress] = useState({ done: 0, total: 0 });

  // ── Drag & Drop handlers ─────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    uploadFiles(dropped);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    uploadFiles(selected);
    e.target.value = "";
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload ───────────────────────────────────────────────────────────────
  async function uploadFiles(selected: File[]) {
    if (selected.length === 0) return;
    setError(null);
    setPhase("uploading");
    setPhaseMessage(`Uploading ${selected.length} file(s)…`);

    const formData = new FormData();
    selected.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const newEntries: FileEntry[] = (data.files ?? []).map((f: FileEntry & { originalName?: string }) => ({
        id: f.id,
        name: f.originalName ?? f.name,
        size: f.size,
        status: f.status,
        recordedAt: f.recordedAt,
      }));

      setFiles((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...newEntries.filter((e) => !existingIds.has(e.id))];
      });

      if (data.errors?.length) {
        setError(`Some files were skipped: ${data.errors.join("; ")}`);
      }

      setPhase(newEntries.length > 0 ? "uploading" : "idle");
      setPhaseMessage("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("error");
    }
  }

  // ── Transcribe ───────────────────────────────────────────────────────────
  async function handleTranscribe() {
    const toTranscribe = files.filter((f) => f.status === "uploaded");
    if (toTranscribe.length === 0) return;

    setError(null);
    setPhase("transcribing");
    setTranscribeProgress({ done: 0, total: toTranscribe.length });
    setPhaseMessage(`Transcribing ${toTranscribe.length} file(s) with Deepgram…`);

    // Mark all as transcribing optimistically
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "uploaded" ? { ...f, status: "transcribing" } : f
      )
    );

    // Transcribe one at a time so we can show per-file progress
    let done = 0;
    for (const file of toTranscribe) {
      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds: [file.id] }),
        });
        const data = await res.json();

        const result = data.results?.find((r: { id: string; status: string; error?: string }) => r.id === file.id);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: result?.status === "transcribed" ? "transcribed" : "error",
                  errorMessage: result?.error,
                }
              : f
          )
        );
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id ? { ...f, status: "error", errorMessage: "Network error" } : f
          )
        );
      }

      done++;
      setTranscribeProgress({ done, total: toTranscribe.length });
      setPhaseMessage(`Transcribing… ${done}/${toTranscribe.length} complete`);
    }

    setPhase("processing");
    setPhaseMessage("Transcription complete. Ready to process into lectures.");
  }

  // ── Process into lectures ────────────────────────────────────────────────
  async function handleProcess() {
    setError(null);
    setPhase("processing");
    setPhaseMessage("Gemini is analyzing your notes and grouping them into lectures…");

    try {
      const res = await fetch("/api/process", { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Processing failed");

      setPhase("complete");
      setPhaseMessage(`Done! ${data.lectures} lecture(s) generated.`);

      // Navigate to lectures page after short delay
      setTimeout(() => router.push("/lectures"), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("error");
    }
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  async function handleReset() {
    await fetch("/api/upload", { method: "DELETE" });
    setFiles([]);
    setPhase("idle");
    setPhaseMessage("");
    setError(null);
    setTranscribeProgress({ done: 0, total: 0 });
  }

  // ── Computed state ───────────────────────────────────────────────────────
  const uploadedCount = files.filter((f) => f.status === "uploaded").length;
  const transcribedCount = files.filter((f) => f.status === "transcribed").length;
  const transcribingCount = files.filter((f) => f.status === "transcribing").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const allTranscribed = files.length > 0 && uploadedCount === 0 && transcribingCount === 0;
  const isWorking = phase === "uploading" || phase === "transcribing" || phase === "processing";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">
          <span className="text-indigo-400">Cram</span>mer
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          Drop your voice notes from any lectures. We&apos;ll transcribe them with{" "}
          <span className="text-emerald-400">Deepgram</span>, group them into lectures with{" "}
          <span className="text-blue-400">Gemini</span>, and generate podcast scripts so
          you can study on the go.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 justify-center text-xs font-medium">
        {[
          { label: "1. Upload", active: phase === "idle" || phase === "uploading" },
          { label: "2. Transcribe", active: phase === "transcribing" },
          { label: "3. Process", active: phase === "processing" },
          { label: "4. Study", active: phase === "complete" },
        ].map((step, i) => (
          <span
            key={i}
            className={`px-3 py-1 rounded-full transition-colors ${
              step.active
                ? "bg-indigo-600 text-white"
                : "bg-slate-800 text-slate-500"
            }`}
          >
            {step.label}
          </span>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
          transition-all select-none
          ${isDragging
            ? "border-indigo-400 bg-indigo-500/10 scale-[1.01]"
            : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/50"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/mp4,video/webm"
          multiple
          className="hidden"
          onChange={onFileInput}
        />
        <div className="text-5xl mb-4">🎙️</div>
        <p className="text-slate-300 font-medium text-lg">
          {isDragging ? "Drop your voice notes here" : "Drop audio files or click to select"}
        </p>
        <p className="text-slate-500 text-sm mt-2">
          Supports MP3, M4A, WAV, OGG, FLAC, WebM &middot; Multiple files at once
        </p>
        {files.length > 0 && (
          <p className="text-indigo-400 text-sm mt-3 font-medium">
            {files.length} file(s) ready &mdash; drop more to add
          </p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Phase message */}
      {phaseMessage && (
        <div className={`rounded-xl p-4 text-sm border ${
          phase === "complete"
            ? "bg-green-950/50 border-green-800 text-green-300"
            : "bg-indigo-950/50 border-indigo-800 text-indigo-300"
        }`}>
          {phase === "transcribing" && (
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span>Transcription progress</span>
                <span>{transcribeProgress.done}/{transcribeProgress.total}</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5">
                <div
                  className="bg-indigo-500 h-1.5 rounded-full transition-all"
                  style={{
                    width: transcribeProgress.total > 0
                      ? `${(transcribeProgress.done / transcribeProgress.total) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
          )}
          {phaseMessage}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">
              Voice Notes
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({files.length} file{files.length !== 1 ? "s" : ""})
              </span>
            </h2>
            <div className="flex gap-3 text-xs text-slate-500">
              {transcribedCount > 0 && (
                <span className="text-green-400">{transcribedCount} transcribed</span>
              )}
              {errorCount > 0 && (
                <span className="text-red-400">{errorCount} failed</span>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 bg-slate-900/50 rounded-lg px-4 py-3 text-sm"
              >
                <span className="text-lg">🎵</span>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 font-medium truncate">{f.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {formatBytes(f.size)} &middot; Recorded: {formatDate(f.recordedAt)}
                  </p>
                  {f.errorMessage && (
                    <p className="text-red-400 text-xs mt-0.5">{f.errorMessage}</p>
                  )}
                </div>
                <StatusBadge status={f.status} />
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-700">
            {uploadedCount > 0 && (
              <button
                onClick={handleTranscribe}
                disabled={isWorking}
                className="btn-primary flex items-center gap-2"
              >
                <span>⚡</span>
                Transcribe {uploadedCount} File{uploadedCount !== 1 ? "s" : ""}
              </button>
            )}

            {allTranscribed && transcribedCount > 0 && (
              <button
                onClick={handleProcess}
                disabled={isWorking}
                className="btn-primary flex items-center gap-2"
              >
                <span>🧠</span>
                Infer Lectures with Gemini
              </button>
            )}

            <button onClick={handleReset} disabled={isWorking} className="btn-danger ml-auto">
              Reset All
            </button>
          </div>
        </div>
      )}

      {/* How it works */}
      {files.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            {
              icon: "🎙️",
              title: "Upload Voice Notes",
              desc: "Drag & drop multiple audio recordings from any of your lectures. Filenames with dates help with ordering.",
            },
            {
              icon: "⚡",
              title: "Deepgram Transcription",
              desc: "Each note is transcribed with Deepgram Nova-2 — speaker diarization, punctuation, and paragraph detection included.",
            },
            {
              icon: "🧠",
              title: "AI Lecture Grouping",
              desc: "Gemini analyzes the transcripts, infers which recordings belong to which lecture, and generates podcast scripts.",
            },
          ].map((card, i) => (
            <div key={i} className="card text-center space-y-3">
              <div className="text-4xl">{card.icon}</div>
              <h3 className="font-semibold text-slate-200">{card.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
