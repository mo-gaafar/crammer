"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SlideOver from "@/app/components/SlideOver";
import type { Lecture, StudyMaterial } from "@/types";

interface TextAudioArtifact {
  id: string;
  sourceName: string;
  title: string;
  script: string;
  audioFileName?: string;
  audioUrl?: string | null;
  createdAt: string;
}

type OutputType = "lecture" | "study" | "audio";

interface FeedItem {
  type: OutputType;
  id: string;
  title: string;
  subtitle: string;
  date: string;
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

const TYPE_LABEL: Record<OutputType, string> = {
  lecture: "Lecture",
  study: "Study Material",
  audio: "Audio",
};

const TYPE_BADGE: Record<OutputType, string> = {
  lecture: "badge-indigo",
  study: "badge-green",
  audio: "badge-yellow",
};

export default function LibraryPage() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [audioArtifacts, setAudioArtifacts] = useState<TextAudioArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | OutputType>("all");
  const [openMaterial, setOpenMaterial] = useState<StudyMaterial | null>(null);
  const [openAudio, setOpenAudio] = useState<TextAudioArtifact | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/lectures").then((r) => r.json()),
      fetch("/api/study-materials").then((r) => r.json()),
      fetch("/api/text-audio").then((r) => r.json()),
    ])
      .then(([lecturesData, studyData, audioData]) => {
        setLectures(lecturesData.lectures ?? []);
        setMaterials(studyData.materials ?? []);
        setAudioArtifacts(audioData.artifacts ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function copyMaterial(material: StudyMaterial) {
    await navigator.clipboard.writeText(material.contentMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-slate-500">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-spin-slow">⚙️</div>
          <p>Loading your outputs…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-red-950/50 border border-red-800 rounded-xl p-6 text-red-300">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  const items: FeedItem[] = [
    ...lectures.map((l) => ({
      type: "lecture" as const,
      id: l.id,
      title: l.title,
      subtitle: l.summary,
      date: l.createdAt,
    })),
    ...materials.map((m) => ({
      type: "study" as const,
      id: m.id,
      title: m.title,
      subtitle: m.sourceName ?? m.description,
      date: m.createdAt,
    })),
    ...audioArtifacts.map((a) => ({
      type: "audio" as const,
      id: a.id,
      title: a.title,
      subtitle: a.sourceName,
      date: a.createdAt,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="text-6xl">📭</div>
        <h2 className="text-2xl font-semibold text-slate-200">Nothing here yet</h2>
        <p className="text-slate-400 max-w-sm mx-auto">
          Use one of the tools to generate a lecture, a study material, or a study audio clip —
          it'll show up here.
        </p>
        <Link href="/" className="btn-primary inline-flex items-center gap-2">
          <span>←</span> Go to Tools
        </Link>
      </div>
    );
  }

  function openItem(item: FeedItem) {
    if (item.type === "study") {
      setOpenMaterial(materials.find((m) => m.id === item.id) ?? null);
    } else if (item.type === "audio") {
      setOpenAudio(audioArtifacts.find((a) => a.id === item.id) ?? null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">My Outputs</h1>
          <p className="text-slate-400 mt-1">
            {items.length} item{items.length !== 1 ? "s" : ""} generated across all tools
          </p>
        </div>
        <Link href="/" className="btn-secondary text-sm">
          ＋ New
        </Link>
      </div>

      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/70 p-1 text-sm w-fit">
        {(["all", "lecture", "study", "audio"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 transition-colors capitalize ${
              filter === f
                ? "bg-slate-800 text-slate-100"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {f === "all" ? "All" : `${TYPE_LABEL[f]}s`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((item) => {
          const content = (
            <div className="subtle-panel space-y-2">
              <div className="flex items-start justify-between gap-3">
                <span className={TYPE_BADGE[item.type]}>{TYPE_LABEL[item.type]}</span>
                <span className="text-slate-500 text-xs shrink-0">{formatDate(item.date)}</span>
              </div>
              <h2 className="text-base font-semibold text-slate-100 leading-snug truncate">
                {item.title}
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">{item.subtitle}</p>
            </div>
          );

          return item.type === "lecture" ? (
            <Link
              key={`${item.type}-${item.id}`}
              href={`/lectures/${item.id}`}
              className="group block transition-colors hover:opacity-90"
            >
              {content}
            </Link>
          ) : (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => openItem(item)}
              className="text-left block transition-colors hover:opacity-90"
            >
              {content}
            </button>
          );
        })}
      </div>

      {openMaterial && (
        <SlideOver title={openMaterial.title} onClose={() => setOpenMaterial(null)}>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">{openMaterial.description}</p>
            <div className="flex gap-2">
              <button onClick={() => copyMaterial(openMaterial)} className="btn-secondary text-xs py-1.5 px-3">
                {copied ? "✅ Copied" : "📋 Copy"}
              </button>
              {openMaterial.type === "flashcards" && (
                <a
                  href={`/api/study-materials/${openMaterial.id}/anki-csv`}
                  download
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  🗂️ Anki CSV
                </a>
              )}
            </div>
            <textarea
              readOnly
              value={openMaterial.contentMarkdown}
              spellCheck={false}
              className="large-text-viewer max-h-[60vh]"
              aria-label="Study material content"
            />
          </div>
        </SlideOver>
      )}

      {openAudio && (
        <SlideOver title={openAudio.title} onClose={() => setOpenAudio(null)}>
          <div className="space-y-4">
            <p className="text-slate-500 text-xs">{openAudio.sourceName}</p>
            {openAudio.audioUrl ? (
              <audio controls src={openAudio.audioUrl} className="w-full" />
            ) : (
              <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-3 text-xs text-amber-200">
                Audio was not generated for this script.
              </div>
            )}
            <div className="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto border border-slate-700">
              {openAudio.script}
            </div>
          </div>
        </SlideOver>
      )}
    </div>
  );
}
