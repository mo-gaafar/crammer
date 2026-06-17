"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lecture } from "@/types";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function LecturesPage() {
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/lectures")
      .then((r) => r.json())
      .then((d) => setLectures(d.lectures ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 text-slate-500">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-spin-slow">⚙️</div>
          <p>Loading lectures…</p>
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

  if (lectures.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="text-6xl">📭</div>
        <h2 className="text-2xl font-semibold text-slate-200">No lectures yet</h2>
        <p className="text-slate-400 max-w-sm mx-auto">
          Upload and transcribe your voice notes first, then let Gemini group them into
          lectures.
        </p>
        <Link href="/" className="btn-primary inline-flex items-center gap-2">
          <span>←</span> Go Upload Notes
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Your Lectures</h1>
          <p className="text-slate-400 mt-1">
            {lectures.length} lecture{lectures.length !== 1 ? "s" : ""} identified from your voice notes
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="btn-secondary text-sm"
        >
          ＋ Add More Notes
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {lectures.map((lecture) => (
          <Link
            key={lecture.id}
            href={`/lectures/${lecture.id}`}
            className="subtle-panel group block space-y-3 transition-colors hover:bg-slate-900/70"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0 text-xs font-semibold text-indigo-400">
                  {String(lecture.lectureNumber).padStart(2, "0")}
                </span>
                <h2 className="text-base font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors leading-snug truncate">
                  {lecture.title}
                </h2>
              </div>
              <span className="text-slate-500 text-xs shrink-0">
                {formatDate(lecture.createdAt)}
              </span>
            </div>

            <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">
              {lecture.summary}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {lecture.keyTopics.slice(0, 4).map((topic, i) => (
                <span key={i} className="badge-indigo">
                  {topic}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
              <span>{lecture.audioFileIds.length} recording{lecture.audioFileIds.length !== 1 ? "s" : ""}</span>
              <span className="text-indigo-400 group-hover:underline">View →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
