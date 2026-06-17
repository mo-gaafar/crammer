"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/lib/use-settings";
import SlideOver from "@/app/components/SlideOver";

interface FileEntry {
  id: string;
  name: string;
  size: number;
  status: "uploaded" | "transcribing" | "transcribed" | "error";
  recordedAt: string;
  errorMessage?: string;
  transcript?: string;
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
    uploaded: "bg-stone-500",
    transcribing: "bg-yellow-400 animate-pulse",
    transcribed: "bg-green-400",
    error: "bg-red-400",
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
      <span className={`status-dot ${map[status]}`} />
      {status}
    </span>
  );
}

export default function LecturePipelinePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [drivePanelOpen, setDrivePanelOpen] = useState(false);

  const settings = useSettings();
  const { sttProvider, geminiModel } = settings;

  // Hydrate file state from server on mount (survives tab close / server restart)
  useEffect(() => {
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
          const withTranscripts = new Set(
            serverFiles.filter((f) => f.transcript).map((f) => f.id)
          );
          if (withTranscripts.size > 0) setExpandedTranscripts(withTranscripts);
        }
      })
      .catch(() => {}); // Non-fatal — server may not have state
  }, []);

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
  }

  // ── Computed state ───────────────────────────────────────────────────────
  const uploadedCount = files.filter((f) => f.status === "uploaded").length;
  const transcribedCount = files.filter((f) => f.status === "transcribed").length;
  const transcribingCount = files.filter((f) => f.status === "transcribing").length;
  const errorCount = files.filter((f) => f.status === "error").length;
  const allTranscribed = files.length > 0 && uploadedCount === 0 && transcribingCount === 0;
  const isWorking = phase === "uploading" || phase === "transcribing" || phase === "processing";

  const pipelineSteps = [
    { label: "Upload", count: files.length },
    { label: "Transcribed", count: transcribedCount },
    { label: "Ready to process", count: allTranscribed && transcribedCount > 0 ? 1 : 0 },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-stone-900">Lecture Recordings → Script → Audio</h1>
        <p className="text-stone-600 max-w-xl mx-auto">
          Drop your voice notes from any lectures. We&apos;ll transcribe them, group them into
          lectures with <span className="text-blue-400">Gemini</span>, and generate podcast
          scripts so you can study on the go.
        </p>
      </div>

      {files.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-stone-500">
          {pipelineSteps.map((step, i) => (
            <span key={step.label} className="flex items-center gap-2">
              <span className={step.count > 0 ? "text-espresso-700" : "text-stone-500"}>
                {step.label} {step.count > 0 && `· ${step.count}`}
              </span>
              {i < pipelineSteps.length - 1 && <span className="text-stone-300">→</span>}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-3">
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
            ? "border-espresso-400 bg-espresso-500/10 scale-[1.01]"
            : "border-stone-300 hover:border-stone-500 hover:bg-stone-200/50"
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
        <p className="text-stone-700 font-medium text-lg">
          {isDragging ? "Drop your voice notes here" : "Drop audio files or click to select"}
        </p>
        <p className="text-stone-500 text-sm mt-2">
          Supports MP3, M4A, WAV, OGG, FLAC, WebM &middot; Multiple files at once
        </p>
        {files.length > 0 && (
          <p className="text-espresso-700 text-sm mt-3 font-medium">
            {files.length} file(s) ready &mdash; drop more to add
          </p>
        )}
      </div>

      {/* Google Drive import — slide-over panel */}
      {drivePanelOpen && (
        <SlideOver title="Import from Google Drive" onClose={() => setDrivePanelOpen(false)}>
          <div className="space-y-3">
            <p className="text-xs text-stone-500">
              Paste a public Google Drive folder link, browse its audio files, then choose what to import.
              Requires <code className="text-stone-600">GOOGLE_DRIVE_API_KEY</code> in your env.
            </p>

            {!driveListing && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDriveBrowse()}
                  placeholder="https://drive.google.com/drive/folders/…"
                  disabled={driveBrowsing || isWorking}
                  className="flex-1 bg-stone-200 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-espresso-500"
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

            {driveListing && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={toggleAllDriveFiles}
                    className="text-xs text-espresso-700 hover:text-espresso-800"
                  >
                    {driveSelected.size === driveListing.files.filter((f) => f.supported && !f.alreadyImported).length
                      ? "Deselect all"
                      : "Select all"}
                  </button>
                  <span className="text-xs text-stone-500">
                    {driveSelected.size} of {driveListing.files.filter((f) => f.supported && !f.alreadyImported).length} selected
                  </span>
                </div>

                <ul className="divide-y divide-stone-200 rounded-lg border border-stone-300 overflow-hidden max-h-64 overflow-y-auto">
                  {driveListing.files.map((f) => {
                    const disabled = !f.supported || f.alreadyImported;
                    return (
                      <li
                        key={f.id}
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm ${disabled ? "opacity-40" : "hover:bg-stone-200/60 cursor-pointer"}`}
                        onClick={() => !disabled && toggleDriveFile(f.id)}
                      >
                        <input
                          type="checkbox"
                          checked={driveSelected.has(f.id)}
                          disabled={disabled}
                          onChange={() => toggleDriveFile(f.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-espresso-500 h-4 w-4 shrink-0"
                        />
                        <span className="flex-1 truncate text-stone-800">{f.name}</span>
                        <span className="text-xs text-stone-500 shrink-0">{formatBytes(f.size)}</span>
                        {f.alreadyImported && <span className="text-xs text-stone-400 shrink-0">already imported</span>}
                        {!f.supported && <span className="text-xs text-stone-400 shrink-0">unsupported</span>}
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

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {phaseMessage && (
        <div className={`rounded-xl p-4 text-sm border ${
          phase === "complete"
            ? "bg-green-950/50 border-green-800 text-green-300"
            : "bg-espresso-50 border-espresso-200 text-espresso-700"
        }`}>
          {phase === "transcribing" && (
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span>Transcription progress</span>
                <span>{transcribeProgress.done}/{transcribeProgress.total}</span>
              </div>
              <div className="w-full bg-stone-200 rounded-full h-1.5">
                <div
                  className="bg-espresso-500 h-1.5 rounded-full transition-all"
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

      {files.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">
              Voice Notes
              <span className="ml-2 text-sm font-normal text-stone-500">
                ({files.length} file{files.length !== 1 ? "s" : ""})
              </span>
            </h2>
            <div className="flex gap-3 text-xs text-stone-500">
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
                  className="bg-stone-100/50 rounded-lg px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg flex-shrink-0">🎵</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-stone-800 font-medium truncate">{f.name}</p>
                      <p className="text-stone-500 text-xs mt-0.5">
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
                            className="text-xs text-stone-600 hover:text-stone-800 transition-colors px-2 py-0.5 rounded border border-stone-300 hover:border-stone-500"
                            title="Copy transcript to clipboard"
                          >
                            {copiedTranscriptId === f.id ? "✓ copied" : "copy"}
                          </button>
                          <button
                            onClick={() => toggleTranscript(f.id)}
                            className="text-xs text-espresso-700 hover:text-espresso-800 transition-colors"
                          >
                            {isExpanded ? "hide" : "show"} transcript
                          </button>
                        </>
                      )}
                      <StatusBadge status={f.status} />
                    </div>
                  </div>

                  {f.status === "transcribing" && (
                    <p className="mt-2 text-xs text-stone-500 animate-pulse pl-8">
                      Transcribing…
                    </p>
                  )}
                  {f.transcript && isExpanded && (
                    <div className="mt-3 pl-8">
                      <div className="bg-stone-200/60 rounded-lg p-3 text-xs text-stone-700 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto border border-stone-300">
                        {f.transcript}
                      </div>
                    </div>
                  )}
                  {f.transcript && !isExpanded && (
                    <p className="mt-2 pl-8 text-xs text-stone-500 line-clamp-2">
                      {f.transcript}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-stone-300">
            {uploadedCount > 0 && (
              <button
                onClick={handleTranscribe}
                disabled={isWorking}
                className="btn-primary flex items-center gap-2"
              >
                <span>⚡</span>
                Transcribe {uploadedCount} File{uploadedCount !== 1 ? "s" : ""}
                <span className="text-espresso-200 text-xs">
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
              <h3 className="font-semibold text-stone-800">{card.title}</h3>
              <p className="text-stone-600 text-sm leading-relaxed">{card.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
