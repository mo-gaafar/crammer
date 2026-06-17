"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { estimateTtsCost, formatUsd } from "@/lib/tts-cost";
import { useSettings, type TtsProvider } from "@/lib/use-settings";
import type { TtsCostEstimate } from "@/types";

interface FileEntry {
  id: string;
  name: string;
  size: number;
  status: "uploaded" | "transcribing" | "transcribed" | "error";
  recordedAt: string;
  errorMessage?: string;
  transcript?: string;
}

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
    uploaded: "bg-slate-500",
    transcribing: "bg-yellow-400 animate-pulse",
    transcribed: "bg-green-400",
    error: "bg-red-400",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span className={`status-dot ${map[status]}`} />
      {status}
    </span>
  );
}

function SlideOver({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} />
      <div className="popover relative h-full w-full max-w-lg overflow-y-auto rounded-none border-l p-6 sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title text-base">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textFileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseMessage, setPhaseMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [transcribeProgress, setTranscribeProgress] = useState({ done: 0, total: 0 });
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());
  const [copiedTranscriptId, setCopiedTranscriptId] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [driveBrowsing, setDriveBrowsing] = useState(false);
  const [driveImporting, setDriveImporting] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveListing, setDriveListing] = useState<null | {
    files: { id: string; name: string; size: number; mimeType: string; alreadyImported: boolean; supported: boolean }[];
  }>(null);
  const [driveSelected, setDriveSelected] = useState<Set<string>>(new Set());
  const [textSourceName, setTextSourceName] = useState("Pasted text");
  const [pastedText, setPastedText] = useState("");
  const [textAudioArtifacts, setTextAudioArtifacts] = useState<TextAudioArtifact[]>([]);
  const [activeTextAudio, setActiveTextAudio] = useState<TextAudioArtifact | null>(null);
  const [generatingTextAudio, setGeneratingTextAudio] = useState(false);
  const [savingDirectScript, setSavingDirectScript] = useState(false);
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
  const [queueingAllAudio, setQueueingAllAudio] = useState(false);
  const [textAudioError, setTextAudioError] = useState<string | null>(null);
  const [drivePanelOpen, setDrivePanelOpen] = useState(false);
  const [textAudioPanelOpen, setTextAudioPanelOpen] = useState(false);

  function mergeTextAudioArtifact(updated: TextAudioArtifact) {
    setTextAudioArtifacts((prev) =>
      prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
    setActiveTextAudio((prev) =>
      prev?.id === updated.id ? { ...prev, ...updated } : prev
    );
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

  // Provider/model settings now live in the shared navbar popover
  const settings = useSettings();
  const { sttProvider, ttsProvider, geminiModel } = settings;

  // Hydrate file state from server on mount
  useEffect(() => {
    // Sync any server-side file state (survives tab close / server restart)
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        const serverFiles: FileEntry[] = (data.files ?? []).map(
          (f: { id: string; name: string; size: number; status: FileEntry["status"]; recordedAt: string; errorMessage?: string; transcript?: string }) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            status: f.status,
            recordedAt: f.recordedAt,
            errorMessage: f.errorMessage,
            transcript: f.transcript,
          })
        );
        if (serverFiles.length > 0) {
          setFiles(serverFiles);
          // Auto-expand transcripts that are already done
          const withTranscripts = new Set(
            serverFiles.filter((f) => f.transcript).map((f) => f.id)
          );
          if (withTranscripts.size > 0) setExpandedTranscripts(withTranscripts);
        }
      })
      .catch(() => {}); // Non-fatal — server may not have state

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

  function copyTranscript(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTranscriptId(id);
      setTimeout(() => setCopiedTranscriptId(null), 2000);
    });
  }

  function toggleTranscript(id: string) {
    setExpandedTranscripts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

      setPhase("idle");
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
    const providerLabel = sttProvider === "gemini" ? `Gemini (${geminiModel})` : "Deepgram";
    setPhaseMessage(`Transcribing ${toTranscribe.length} file(s) with ${providerLabel}…`);

    setFiles((prev) =>
      prev.map((f) =>
        f.status === "uploaded" ? { ...f, status: "transcribing" } : f
      )
    );

    let done = 0;
    for (const file of toTranscribe) {
      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileIds: [file.id],
            sttProvider,
            geminiModel,
          }),
        });
        const data = await res.json();

        const result = data.results?.find((r: { id: string; status: string; transcript?: string; error?: string }) => r.id === file.id);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: result?.status === "transcribed" ? "transcribed" : "error",
                  errorMessage: result?.error,
                  transcript: result?.transcript,
                }
              : f
          )
        );

        // Auto-expand transcript for the just-finished file
        if (result?.transcript) {
          setExpandedTranscripts((prev) => new Set(prev).add(file.id));
        }
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

    setPhase("idle");
    setPhaseMessage("Transcription complete. Ready to process into lectures.");
  }

  // ── Process into lectures ────────────────────────────────────────────────
  async function handleProcess() {
    setError(null);
    setPhase("processing");
    setPhaseMessage("Gemini is analyzing your notes and grouping them into lectures…");

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geminiModel }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Processing failed");

      setPhase("complete");
      setPhaseMessage(`Done! ${data.lectures} lecture(s) generated.`);

      setTimeout(() => router.push("/lectures"), 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setPhase("error");
    }
  }

  // ── Google Drive import ──────────────────────────────────────────────────
  async function handleDriveBrowse() {
    if (!driveUrl.trim()) return;
    setDriveError(null);
    setDriveListing(null);
    setDriveSelected(new Set());
    setDriveBrowsing(true);

    try {
      const res = await fetch(`/api/drive?folderUrl=${encodeURIComponent(driveUrl)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to list folder");
      if (!data.files?.length) {
        setDriveError("No audio files found in this folder (make sure it is shared publicly).");
      } else {
        setDriveListing(data);
        // Pre-select all importable files
        const selectable = data.files
          .filter((f: { supported: boolean; alreadyImported: boolean }) => f.supported && !f.alreadyImported)
          .map((f: { id: string }) => f.id);
        setDriveSelected(new Set(selectable));
      }
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : String(err));
    } finally {
      setDriveBrowsing(false);
    }
  }

  async function handleDriveImport() {
    if (!driveListing || driveSelected.size === 0) return;
    setDriveError(null);
    setDriveImporting(true);

    try {
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderUrl: driveUrl, fileIds: Array.from(driveSelected) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Drive import failed");

      const newEntries: FileEntry[] = (data.files ?? []).map(
        (f: FileEntry & { originalName?: string }) => ({
          id: f.id,
          name: f.originalName ?? f.name,
          size: f.size,
          status: f.status,
          recordedAt: f.recordedAt,
        })
      );
      setFiles((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...newEntries.filter((e) => !existingIds.has(e.id))];
      });

      const notices: string[] = [];
      if (data.skipped > 0) notices.push(`${data.skipped} already imported`);
      if (data.errors?.length) notices.push(`failed: ${data.errors.join("; ")}`);
      if (notices.length) setDriveError(`Imported ${data.imported} file(s). ${notices.join(", ")}.`);

      setDriveListing(null);
      setDriveSelected(new Set());
      setDriveUrl("");
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : String(err));
    } finally {
      setDriveImporting(false);
    }
  }

  function handleDriveCancel() {
    setDriveListing(null);
    setDriveSelected(new Set());
    setDriveError(null);
  }

  function toggleDriveFile(id: string) {
    setDriveSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllDriveFiles() {
    if (!driveListing) return;
    const selectable = driveListing.files
      .filter((f) => f.supported && !f.alreadyImported)
      .map((f) => f.id);
    if (driveSelected.size === selectable.length) {
      setDriveSelected(new Set());
    } else {
      setDriveSelected(new Set(selectable));
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
    setExpandedTranscripts(new Set());
    setDriveUrl("");
    setDriveError(null);
    setTextAudioArtifacts([]);
    setActiveTextAudio(null);
    setGeneratingAudioId(null);
    setTextAudioError(null);
  }

  // ── Computed state ───────────────────────────────────────────────────────
  const uploadedCount = files.filter((f) => f.status === "uploaded").length;
  const transcribedCount = files.filter((f) => f.status === "transcribed").length;
  const transcribingCount = files.filter((f) => f.status === "transcribing").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const allTranscribed = files.length > 0 && uploadedCount === 0 && transcribingCount === 0;
  const isWorking = phase === "uploading" || phase === "transcribing" || phase === "processing";
  const activeAudioIsGenerating =
    activeTextAudio?.audioStatus === "queued" || activeTextAudio?.audioStatus === "generating";
  const queueableTextAudioCount = textAudioArtifacts.filter(
    (artifact) =>
      !artifact.audioUrl &&
      artifact.audioStatus !== "queued" &&
      artifact.audioStatus !== "generating"
  ).length;

  const pipelineSteps = [
    { label: "Upload", count: files.length },
    { label: "Transcribed", count: transcribedCount },
    { label: "Ready to process", count: allTranscribed && transcribedCount > 0 ? 1 : 0 },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">
          <span className="text-indigo-400">Cram</span>mer
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          Drop your voice notes from any lectures. We&apos;ll transcribe them, group them into
          lectures with <span className="text-blue-400">Gemini</span>, and generate podcast
          scripts so you can study on the go.
        </p>
      </div>

      {/* Pipeline progress */}
      {files.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-500">
          {pipelineSteps.map((step, i) => (
            <span key={step.label} className="flex items-center gap-2">
              <span className={step.count > 0 ? "text-indigo-300" : "text-slate-500"}>
                {step.label} {step.count > 0 && `· ${step.count}`}
              </span>
              {i < pipelineSteps.length - 1 && <span className="text-slate-700">→</span>}
            </span>
          ))}
        </div>
      )}

      {/* Tool launchers */}
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={() => setTextAudioPanelOpen(true)} className="btn-secondary text-sm">
          Text → Audio
          {textAudioArtifacts.length > 0 && (
            <span className="ml-1.5 text-slate-400">({textAudioArtifacts.length})</span>
          )}
        </button>
        <button onClick={() => setDrivePanelOpen(true)} className="btn-secondary text-sm">
          Import from Drive
        </button>
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

      {/* Text to audio — slide-over panel */}
      {textAudioPanelOpen && (
      <SlideOver title="Text to Study Audio" onClose={() => setTextAudioPanelOpen(false)}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="section-title text-sm">Text to Study Audio</h2>
            <p className="text-xs text-slate-500 mt-1">
              Paste notes for a rewritten study script, or paste a finished script and send it
              straight to audio.
            </p>
          </div>
          <button
            onClick={() => textFileInputRef.current?.click()}
            disabled={generatingTextAudio || savingDirectScript || queueingAllAudio || generatingAudioId !== null || isWorking}
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
          disabled={generatingTextAudio || savingDirectScript || generatingAudioId !== null || isWorking}
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
          disabled={generatingTextAudio || savingDirectScript || generatingAudioId !== null || isWorking}
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
            disabled={!pastedText.trim() || generatingTextAudio || savingDirectScript || isWorking}
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
            disabled={!pastedText.trim() || generatingTextAudio || savingDirectScript || isWorking}
            className="btn-secondary flex items-center gap-2"
          >
            {savingDirectScript ? "Preparing script..." : "Use Text as Script"}
          </button>
          <span className="text-xs text-slate-500">
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
          <div className="bg-slate-900/50 rounded-xl p-4 space-y-3 border border-slate-800">
            {(() => {
              const ttsCost =
                activeTextAudio.ttsCostEstimate ?? estimateTtsCost(activeTextAudio.script);
              return (
                <>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-100 truncate">{activeTextAudio.title}</h3>
                <p className="text-xs text-slate-500 truncate">
                  {activeTextAudio.sourceName}
                  {activeTextAudio.audioFileName ? ` -> ${activeTextAudio.audioFileName}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
                        ? "border-indigo-700 bg-indigo-950/30"
                        : "border-slate-700 bg-slate-950/40"
                    }`}
                    title={estimate.billingBasis}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400 capitalize">{provider} TTS</span>
                      {isSelected && <span className="text-indigo-300">selected</span>}
                    </div>
                    <div className="text-slate-100 font-semibold">
                      {formatUsd(estimate.estimatedUsd)}
                    </div>
                    <div className="text-slate-500">{estimate.model}</div>
                  </div>
                );
              })}
            </div>
                </>
              );
            })()}
            {activeAudioIsGenerating && (
              <div className="rounded-lg border border-indigo-800 bg-indigo-950/40 p-3">
                <div className="mb-1 flex justify-between text-xs text-indigo-200">
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
                <div className="h-1.5 w-full rounded-full bg-slate-800">
                  <div
                    className="h-1.5 rounded-full bg-indigo-500 transition-all"
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
            <div className="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto border border-slate-700">
              {activeTextAudio.script}
            </div>
          </div>
        )}

        {textAudioArtifacts.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-slate-500 self-center">Generated:</span>
            {textAudioArtifacts.map((artifact) => (
              <button
                key={artifact.id}
                onClick={() => setActiveTextAudio(artifact)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  activeTextAudio?.id === artifact.id
                    ? "border-indigo-500 text-indigo-300 bg-indigo-500/10"
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
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
      </SlideOver>
      )}

      {/* Google Drive import — slide-over panel */}
      {drivePanelOpen && (
      <SlideOver title="Import from Google Drive" onClose={() => setDrivePanelOpen(false)}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Paste a public Google Drive folder link, browse its audio files, then choose what to import.
          Requires <code className="text-slate-400">GOOGLE_DRIVE_API_KEY</code> in your env.
        </p>

        {/* URL input row — hidden while listing is shown */}
        {!driveListing && (
          <div className="flex gap-2">
            <input
              type="url"
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDriveBrowse()}
              placeholder="https://drive.google.com/drive/folders/…"
              disabled={driveBrowsing || isWorking}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={handleDriveBrowse}
              disabled={!driveUrl.trim() || driveBrowsing || isWorking}
              className="btn-primary flex items-center gap-2 whitespace-nowrap"
            >
              {driveBrowsing ? (
                <><span className="animate-spin inline-block">⏳</span> Browsing…</>
              ) : (
                <><span>🔍</span> Browse</>
              )}
            </button>
          </div>
        )}

        {/* File picker */}
        {driveListing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={toggleAllDriveFiles}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                {driveSelected.size === driveListing.files.filter((f) => f.supported && !f.alreadyImported).length
                  ? "Deselect all"
                  : "Select all"}
              </button>
              <span className="text-xs text-slate-500">
                {driveSelected.size} of {driveListing.files.filter((f) => f.supported && !f.alreadyImported).length} selected
              </span>
            </div>

            <ul className="divide-y divide-slate-800 rounded-lg border border-slate-700 overflow-hidden max-h-64 overflow-y-auto">
              {driveListing.files.map((f) => {
                const disabled = !f.supported || f.alreadyImported;
                return (
                  <li
                    key={f.id}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm ${disabled ? "opacity-40" : "hover:bg-slate-800/60 cursor-pointer"}`}
                    onClick={() => !disabled && toggleDriveFile(f.id)}
                  >
                    <input
                      type="checkbox"
                      checked={driveSelected.has(f.id)}
                      disabled={disabled}
                      onChange={() => toggleDriveFile(f.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-indigo-500 h-4 w-4 shrink-0"
                    />
                    <span className="flex-1 truncate text-slate-200">{f.name}</span>
                    <span className="text-xs text-slate-500 shrink-0">{formatBytes(f.size)}</span>
                    {f.alreadyImported && <span className="text-xs text-slate-600 shrink-0">already imported</span>}
                    {!f.supported && <span className="text-xs text-slate-600 shrink-0">unsupported</span>}
                  </li>
                );
              })}
            </ul>

            <div className="flex gap-2">
              <button
                onClick={handleDriveCancel}
                disabled={driveImporting}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDriveImport}
                disabled={driveSelected.size === 0 || driveImporting}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {driveImporting ? (
                  <><span className="animate-spin inline-block">⏳</span> Importing…</>
                ) : (
                  <><span>⬇️</span> Import {driveSelected.size} file{driveSelected.size !== 1 ? "s" : ""}</>
                )}
              </button>
            </div>
          </div>
        )}

        {driveError && (
          <p className="text-xs text-amber-400">{driveError}</p>
        )}
      </div>
      </SlideOver>
      )}

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

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {files.map((f) => {
              const isExpanded = expandedTranscripts.has(f.id);
              return (
                <div
                  key={f.id}
                  className="bg-slate-900/50 rounded-lg px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg flex-shrink-0">🎵</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 font-medium truncate">{f.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {formatBytes(f.size)} &middot; Recorded: {formatDate(f.recordedAt)}
                      </p>
                      {f.errorMessage && (
                        <p className="text-red-400 text-xs mt-0.5">{f.errorMessage}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {f.transcript && (
                        <>
                          <button
                            onClick={() => copyTranscript(f.id, f.transcript!)}
                            className="text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-0.5 rounded border border-slate-700 hover:border-slate-500"
                            title="Copy transcript to clipboard"
                          >
                            {copiedTranscriptId === f.id ? "✓ copied" : "copy"}
                          </button>
                          <button
                            onClick={() => toggleTranscript(f.id)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            {isExpanded ? "hide" : "show"} transcript
                          </button>
                        </>
                      )}
                      <StatusBadge status={f.status} />
                    </div>
                  </div>

                  {/* Transcript preview */}
                  {f.status === "transcribing" && (
                    <p className="mt-2 text-xs text-slate-500 animate-pulse pl-8">
                      Transcribing…
                    </p>
                  )}
                  {f.transcript && isExpanded && (
                    <div className="mt-3 pl-8">
                      <div className="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto border border-slate-700">
                        {f.transcript}
                      </div>
                    </div>
                  )}
                  {f.transcript && !isExpanded && (
                    <p className="mt-2 pl-8 text-xs text-slate-500 line-clamp-2">
                      {f.transcript}
                    </p>
                  )}
                </div>
              );
            })}
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
                <span className="text-indigo-300 text-xs">
                  ({sttProvider === "deepgram" ? "Deepgram" : "Gemini"})
                </span>
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
              title: "Transcription",
              desc: "Each note is transcribed with Deepgram Nova-2 or Gemini STT. Speaker diarization and punctuation included.",
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
