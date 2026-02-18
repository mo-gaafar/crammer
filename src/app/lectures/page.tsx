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

      <div className="grid gap-5">
        {lectures.map((lecture) => (
          <Link
            key={lecture.id}
            href={`/lectures/${lecture.id}`}
            className="card group hover:border-indigo-600/50 hover:bg-slate-700/50 transition-all cursor-pointer block"
          >
            <div className="flex items-start gap-4">
              {/* Lecture number badge */}
              <div className="shrink-0 w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center">
                <span className="text-indigo-400 font-bold text-lg">
                  {lecture.lectureNumber}
                </span>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors leading-snug">
                    {lecture.title}
                  </h2>
                  <span className="text-slate-500 text-xs shrink-0 mt-1">
                    {formatDate(lecture.createdAt)}
                  </span>
                </div>

                <p className="text-slate-400 text-sm leading-relaxed line-clamp-2">
                  {lecture.summary}
                </p>

                {/* Key topics */}
                <div className="flex flex-wrap gap-2">
                  {lecture.keyTopics.map((topic, i) => (
                    <span key={i} className="badge-indigo">
                      {topic}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-4 pt-1 text-xs text-slate-500">
                  <span>🎵 {lecture.audioFileIds.length} recording{lecture.audioFileIds.length !== 1 ? "s" : ""}</span>
                  <span className="text-indigo-400 group-hover:underline">
                    View lecture & generate podcast →
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="text-center text-sm text-slate-600 pt-4">
        Click a lecture to view its full transcript and generate a podcast script.
      </div>
    </div>
  );
}
