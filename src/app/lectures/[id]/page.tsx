"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AudioFile, Lecture, PodcastFormat, PodcastScript, Transcription } from "@/types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FORMAT_OPTIONS: { value: PodcastFormat; label: string; icon: string; desc: string }[] = [
  {
    value: "qa",
    label: "Q&A Style",
    icon: "❓",
    desc: "A student and an expert work through concepts via questions and answers",
  },
  {
    value: "narrative",
    label: "Solo Narrative",
    icon: "🎤",
    desc: "An engaging monologue that walks through the concepts in a story-like flow",
  },
  {
    value: "discussion",
    label: "Two-Host Discussion",
    icon: "🗣️",
    desc: "Two hosts (Alex & Riley) discuss the material from different angles",
  },
];

type Tab = "transcript" | "podcast";

interface LectureDetail {
  lecture: Lecture;
  audioFiles: AudioFile[];
  transcriptions: Transcription[];
  podcastScripts: PodcastScript[];
}

export default function LectureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<LectureDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");

  // Podcast generation state
  const [selectedFormat, setSelectedFormat] = useState<PodcastFormat>("qa");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [scripts, setScripts] = useState<PodcastScript[]>([]);
  const [activeScript, setActiveScript] = useState<PodcastScript | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/lectures/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setScripts(d.podcastScripts ?? []);
        if (d.podcastScripts?.length > 0) {
          setActiveScript(d.podcastScripts[d.podcastScripts.length - 1]);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleGeneratePodcast() {
    if (!data) return;
    setGenerating(true);
    setGenerateError(null);
    setTab("podcast");

    try {
      const res = await fetch("/api/generate-podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: id, format: selectedFormat }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error ?? "Generation failed");

      const newScript: PodcastScript = result.script;
      setScripts((prev) => [...prev, newScript]);
      setActiveScript(newScript);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenerateError(msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!activeScript) return;
    await navigator.clipboard.writeText(activeScript.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!activeScript) return;
    const blob = new Blob(
      [`${activeScript.title}\n\n${activeScript.description}\n\n${activeScript.script}`],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeScript.title.replace(/[^a-z0-9]/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-slate-500">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-spin-slow">⚙️</div>
          <p>Loading lecture…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-6 text-red-300">
          {error ?? "Lecture not found"}
        </div>
        <button onClick={() => router.back()} className="btn-secondary">
          ← Back
        </button>
      </div>
    );
  }

  const { lecture, audioFiles } = data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <button
          onClick={() => router.push("/lectures")}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors mb-2 flex items-center gap-1"
        >
          ← All Lectures
        </button>
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-14 h-14 rounded-xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
            <span className="text-indigo-400 font-bold text-xl">{lecture.lectureNumber}</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-100 leading-snug">{lecture.title}</h1>
            <p className="text-slate-400 mt-1 text-sm">{formatDate(lecture.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Summary + Topics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 card space-y-3">
          <h2 className="section-title">Summary</h2>
          <p className="text-slate-300 text-sm leading-relaxed">{lecture.summary}</p>
        </div>
        <div className="card space-y-3">
          <h2 className="section-title">Key Topics</h2>
          <div className="flex flex-wrap gap-2">
            {lecture.keyTopics.map((topic, i) => (
              <span key={i} className="badge-indigo">
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Audio files */}
      <div className="card space-y-3">
        <h2 className="section-title">
          Source Recordings
          <span className="ml-2 text-sm font-normal text-slate-500">
            ({audioFiles.length} file{audioFiles.length !== 1 ? "s" : ""})
          </span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {audioFiles.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 bg-slate-900/50 rounded-lg px-4 py-3 text-sm"
            >
              <span className="text-lg">🎵</span>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 truncate font-medium">{f.originalName}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {formatBytes(f.size)} &middot; {formatDate(f.recordedAt)}
                </p>
              </div>
              <span className="badge-green shrink-0">transcribed</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs: Transcript / Podcast */}
      <div>
        <div className="flex gap-1 border-b border-slate-700 mb-6">
          {(["transcript", "podcast"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                tab === t
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "transcript" ? "📄 Transcript" : "🎙️ Podcast Script"}
            </button>
          ))}
        </div>

        {/* Transcript Tab */}
        {tab === "transcript" && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Full Transcript</h2>
              <span className="text-xs text-slate-500">
                {lecture.fullTranscript.split(" ").length.toLocaleString()} words
              </span>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-5 max-h-[500px] overflow-y-auto">
              <pre className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {lecture.fullTranscript}
              </pre>
            </div>
          </div>
        )}

        {/* Podcast Tab */}
        {tab === "podcast" && (
          <div className="space-y-6">
            {/* Format selector */}
            <div className="card space-y-4">
              <h2 className="section-title">Generate Podcast Script</h2>
              <p className="text-slate-400 text-sm">
                Choose a format and let Claude write a ready-to-record podcast episode based on
                this lecture.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedFormat(opt.value)}
                    disabled={generating}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      selectedFormat === opt.value
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="text-2xl mb-2">{opt.icon}</div>
                    <div className="font-medium text-slate-200 text-sm">{opt.label}</div>
                    <div className="text-slate-500 text-xs mt-1 leading-relaxed">{opt.desc}</div>
                  </button>
                ))}
              </div>

              {generateError && (
                <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
                  {generateError}
                </div>
              )}

              <button
                onClick={handleGeneratePodcast}
                disabled={generating}
                className="btn-primary flex items-center gap-2"
              >
                {generating ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    Claude is writing the script…
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    Generate{" "}
                    {FORMAT_OPTIONS.find((o) => o.value === selectedFormat)?.label} Script
                  </>
                )}
              </button>
            </div>

            {/* Previous scripts */}
            {scripts.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs text-slate-500 self-center">Previous:</span>
                {scripts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveScript(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      activeScript?.id === s.id
                        ? "border-indigo-500 text-indigo-300 bg-indigo-500/10"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {FORMAT_OPTIONS.find((o) => o.value === s.format)?.icon}{" "}
                    {s.format.toUpperCase()}
                  </button>
                ))}
              </div>
            )}

            {/* Script display */}
            {activeScript && !generating && (
              <div className="card space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-100 text-lg leading-snug">
                      {activeScript.title}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">{activeScript.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="badge-indigo">
                        {FORMAT_OPTIONS.find((o) => o.value === activeScript.format)?.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {activeScript.script.split(" ").length.toLocaleString()} words
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={handleCopy} className="btn-secondary text-xs py-1.5 px-3">
                      {copied ? "✅ Copied" : "📋 Copy"}
                    </button>
                    <button onClick={handleDownload} className="btn-secondary text-xs py-1.5 px-3">
                      ⬇️ Download
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-xl p-5 max-h-[600px] overflow-y-auto">
                  <pre className="podcast-script whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {activeScript.script}
                  </pre>
                </div>
              </div>
            )}

            {generating && (
              <div className="card flex items-center justify-center py-16 space-y-4 flex-col text-center">
                <div className="text-5xl animate-pulse-slow">✨</div>
                <p className="text-slate-300 font-medium">Claude is crafting your podcast script…</p>
                <p className="text-slate-500 text-sm">This typically takes 30-60 seconds for a full episode.</p>
              </div>
            )}

            {scripts.length === 0 && !generating && (
              <div className="card text-center py-12 space-y-3 text-slate-500">
                <div className="text-4xl">🎙️</div>
                <p>No scripts generated yet. Choose a format above and hit Generate.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
