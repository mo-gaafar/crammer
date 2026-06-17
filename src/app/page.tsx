"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ToolCard {
  href: string;
  icon: string;
  title: string;
  description: string;
  countLabel: (count: number) => string;
}

const TOOLS: ToolCard[] = [
  {
    href: "/tools/lectures",
    icon: "🎙️",
    title: "Lecture Recordings → Script → Audio",
    description:
      "Upload voice notes, transcribe with Deepgram or Gemini, group into lectures, and generate podcast scripts.",
    countLabel: (n) => `${n} lecture${n !== 1 ? "s" : ""} created`,
  },
  {
    href: "/tools/text-to-audio",
    icon: "🎧",
    title: "Text → Audio",
    description:
      "Paste any notes or a finished script and turn it into a study podcast you can listen to on the go.",
    countLabel: (n) => `${n} audio script${n !== 1 ? "s" : ""}`,
  },
  {
    href: "/tools/study",
    icon: "📚",
    title: "Text → Study Materials",
    description:
      "Paste notes and generate a study guide, flashcards, a quiz, a glossary, or a cram sheet — flashcards export straight to Anki.",
    countLabel: (n) => `${n} material${n !== 1 ? "s" : ""} generated`,
  },
];

export default function HubPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/lectures").then((r) => r.json()).catch(() => ({})),
      fetch("/api/text-audio").then((r) => r.json()).catch(() => ({})),
      fetch("/api/study-materials").then((r) => r.json()).catch(() => ({})),
    ]).then(([lecturesData, textAudioData, studyData]) => {
      setCounts({
        "/tools/lectures": lecturesData.lectures?.length ?? 0,
        "/tools/text-to-audio": textAudioData.artifacts?.length ?? 0,
        "/tools/study": studyData.materials?.length ?? 0,
      });
    });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold">
          <span className="text-espresso-700">Study</span>Forge
        </h1>
        <p className="text-stone-600 max-w-xl mx-auto">
          Pick a tool. Every tool turns what you give it — recordings or text — into study
          material you can review, listen to, or export.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {TOOLS.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="card group flex flex-col gap-3 hover:border-espresso-600/50 hover:bg-stone-300/40 transition-all"
          >
            <div className="text-4xl">{tool.icon}</div>
            <h2 className="font-semibold text-stone-900 group-hover:text-espresso-700 transition-colors leading-snug">
              {tool.title}
            </h2>
            <p className="text-stone-600 text-sm leading-relaxed flex-1">{tool.description}</p>
            <span className="text-xs text-stone-500">
              {tool.countLabel(counts[tool.href] ?? 0)}
            </span>
          </Link>
        ))}
      </div>

      <div className="text-center">
        <Link href="/lectures" className="text-sm text-espresso-700 hover:underline">
          View everything you've generated →
        </Link>
      </div>
    </div>
  );
}
