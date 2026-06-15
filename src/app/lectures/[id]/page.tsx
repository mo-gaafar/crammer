"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AudioFile,
  Lecture,
  PodcastFormat,
  PodcastScript,
  StudyMaterial,
  StudyTemplate,
  Transcription,
} from "@/types";

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

type Tab = "transcript" | "podcast" | "materials";

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

const LargeTextViewer = memo(function LargeTextViewer({
  text,
  className = "",
  maxHeightClass = "max-h-[600px]",
}: {
  text: string;
  className?: string;
  maxHeightClass?: string;
}) {
  return (
    <textarea
      readOnly
      value={text}
      spellCheck={false}
      className={`large-text-viewer ${maxHeightClass} ${className}`}
      aria-label="Generated text"
    />
  );
});

interface LectureDetail {
  lecture: Lecture;
  audioFiles: AudioFile[];
  transcriptions: Transcription[];
  podcastScripts: PodcastScript[];
  studyMaterials: StudyMaterial[];
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
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const [templates, setTemplates] = useState<StudyTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("study-guide-core");
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [activeMaterial, setActiveMaterial] = useState<StudyMaterial | null>(null);
  const [generatingMaterial, setGeneratingMaterial] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);
  const [materialCopied, setMaterialCopied] = useState(false);

  const transcriptWordCount = useMemo(
    () => (data ? countWords(data.lecture.fullTranscript).toLocaleString() : "0"),
    [data]
  );
  const activeMaterialWordCount = useMemo(
    () => (activeMaterial ? countWords(activeMaterial.contentMarkdown).toLocaleString() : "0"),
    [activeMaterial]
  );
  const activeScriptWordCount = useMemo(
    () => (activeScript ? countWords(activeScript.script).toLocaleString() : "0"),
    [activeScript]
  );

  useEffect(() => {
    if (!id) return;
    fetch(`/api/lectures/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setScripts(d.podcastScripts ?? []);
        setMaterials(d.studyMaterials ?? []);
        if (d.podcastScripts?.length > 0) {
          setActiveScript(d.podcastScripts[d.podcastScripts.length - 1]);
        }
        if (d.studyMaterials?.length > 0) {
          setActiveMaterial(d.studyMaterials[d.studyMaterials.length - 1]);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch("/api/study-materials")
      .then((r) => r.json())
      .then((d) => {
        setTemplates(d.templates ?? []);
        if (d.templates?.[0]?.id) setSelectedTemplateId(d.templates[0].id);
      })
      .catch(() => {});
  }, []);

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

  async function handleCopyTranscript() {
    if (!data) return;
    const { lecture } = data;
    const text = [
      `Title: ${lecture.title}`,
      `Date: ${formatDate(lecture.createdAt)}`,
      `Summary: ${lecture.summary}`,
      `Key Topics: ${lecture.keyTopics.join(", ")}`,
      "",
      "--- Full Transcript ---",
      "",
      lecture.fullTranscript,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setTranscriptCopied(true);
    setTimeout(() => setTranscriptCopied(false), 2000);
  }

  async function handleGenerateMaterial() {
    if (!data) return;
    setGeneratingMaterial(true);
    setMaterialError(null);
    setTab("materials");

    try {
      const res = await fetch("/api/study-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureId: id, templateId: selectedTemplateId }),
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error ?? "Generation failed");

      const newMaterial: StudyMaterial = result.material;
      setMaterials((prev) => [...prev, newMaterial]);
      setActiveMaterial(newMaterial);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMaterialError(msg);
    } finally {
      setGeneratingMaterial(false);
    }
  }

  async function handleCopyMaterial() {
    if (!activeMaterial) return;
    await navigator.clipboard.writeText(activeMaterial.contentMarkdown);
    setMaterialCopied(true);
    setTimeout(() => setMaterialCopied(false), 2000);
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

  function handleDownloadMaterial() {
    if (!activeMaterial) return;
    const blob = new Blob(
      [`${activeMaterial.title}\n\n${activeMaterial.description}\n\n${activeMaterial.contentMarkdown}`],
      { type: "text/markdown" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeMaterial.title.replace(/[^a-z0-9]/gi, "_")}.md`;
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

      {/* Tabs: Transcript / Study Materials / Podcast */}
      <div>
        <div className="flex gap-1 border-b border-slate-700 mb-6">
          {(["transcript", "materials", "podcast"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
                tab === t
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "transcript"
                ? "📄 Transcript"
                : t === "materials"
                  ? "📚 Study Materials"
                  : "🎙️ Podcast Script"}
            </button>
          ))}
        </div>

        {/* Transcript Tab */}
        {tab === "transcript" && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Full Transcript</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {transcriptWordCount} words
                </span>
                <button
                  onClick={handleCopyTranscript}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  {transcriptCopied ? "✅ Copied" : "📋 Copy"}
                </button>
              </div>
            </div>
            <LargeTextViewer text={lecture.fullTranscript} maxHeightClass="max-h-[500px]" />
          </div>
        )}

        {/* Study Materials Tab */}
        {tab === "materials" && (
          <div className="space-y-6">
            <div className="card space-y-4">
              <div>
                <h2 className="section-title">Generate Study Material</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Choose a reusable template flow. Community templates live beside built-in ones
                  so contributors can add new study outputs cleanly.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    disabled={generatingMaterial}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      selectedTemplateId === template.id
                        ? "border-indigo-500 bg-indigo-500/10"
                        : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-slate-200 text-sm">{template.name}</div>
                      <span
                        className={
                          template.source === "community" ? "badge-green" : "badge-indigo"
                        }
                      >
                        {template.source}
                      </span>
                    </div>
                    <div className="text-slate-500 text-xs mt-2 leading-relaxed">
                      {template.description}
                    </div>
                    <div className="text-slate-400 text-xs mt-3 uppercase">
                      {template.type.replace(/_/g, " ")}
                    </div>
                  </button>
                ))}
              </div>

              {materialError && (
                <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
                  {materialError}
                </div>
              )}

              <button
                onClick={handleGenerateMaterial}
                disabled={generatingMaterial || templates.length === 0}
                className="btn-primary flex items-center gap-2"
              >
                {generatingMaterial ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    Gemini is building the material...
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    Generate {templates.find((t) => t.id === selectedTemplateId)?.name ?? "Material"}
                  </>
                )}
              </button>
            </div>

            {materials.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs text-slate-500 self-center">Generated:</span>
                {materials.map((material) => {
                  const template = templates.find((t) => t.id === material.templateId);
                  return (
                    <button
                      key={material.id}
                      onClick={() => setActiveMaterial(material)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        activeMaterial?.id === material.id
                          ? "border-indigo-500 text-indigo-300 bg-indigo-500/10"
                          : "border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {template?.name ?? material.type.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            )}

            {activeMaterial && !generatingMaterial && (
              <div className="card space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-100 text-lg leading-snug">
                      {activeMaterial.title}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">{activeMaterial.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="badge-indigo">
                        {activeMaterial.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-slate-500">
                        {activeMaterialWordCount} words
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={handleCopyMaterial}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      {materialCopied ? "✅ Copied" : "📋 Copy"}
                    </button>
                    <button
                      onClick={handleDownloadMaterial}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      ⬇️ Download
                    </button>
                  </div>
                </div>

                <LargeTextViewer text={activeMaterial.contentMarkdown} />
              </div>
            )}

            {generatingMaterial && (
              <div className="card flex items-center justify-center py-16 space-y-4 flex-col text-center">
                <div className="text-5xl animate-pulse-slow">✨</div>
                <p className="text-slate-300 font-medium">
                  Gemini is shaping this lecture into a study material...
                </p>
                <p className="text-slate-500 text-sm">
                  Longer transcripts can take about a minute.
                </p>
              </div>
            )}

            {materials.length === 0 && !generatingMaterial && (
              <div className="card text-center py-12 space-y-3 text-slate-500">
                <div className="text-4xl">📚</div>
                <p>No study materials generated yet. Choose a template and hit Generate.</p>
              </div>
            )}
          </div>
        )}

        {/* Podcast Tab */}
        {tab === "podcast" && (
          <div className="space-y-6">
            {/* Format selector */}
            <div className="card space-y-4">
              <h2 className="section-title">Generate Podcast Script</h2>
              <p className="text-slate-400 text-sm">
                Choose a format and let Gemini write a ready-to-record podcast episode based on
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
                    Gemini is writing the script…
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
                        {activeScriptWordCount} words
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

                <LargeTextViewer text={activeScript.script} />
              </div>
            )}

            {generating && (
              <div className="card flex items-center justify-center py-16 space-y-4 flex-col text-center">
                <div className="text-5xl animate-pulse-slow">✨</div>
                <p className="text-slate-300 font-medium">Gemini is crafting your podcast script…</p>
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
