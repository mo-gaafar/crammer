"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const highlights = [
  { label: "Transcribe", value: "Nova-2 + Gemini", detail: "Audio and video recordings" },
  { label: "Organize", value: "Lecture grouping", detail: "Dates, topics, continuity" },
  { label: "Study", value: "Podcast scripts", detail: "QA, narrative, discussion" },
];

const flow = ["Upload", "Transcribe", "Group", "Review"];

function LoginForm() {
  const searchParams = useSearchParams();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });

      if (res.ok) {
        const next = searchParams.get("next") || "/";
        window.location.href = next;
      } else {
        setLoading(false);
        setError("Invalid secret key.");
      }
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }

  return (
    <main className="relative overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 hidden opacity-50 sm:block">
        <div className="landing-wave landing-wave-a" />
        <div className="landing-wave landing-wave-b" />
        <div className="landing-wave landing-wave-c" />
      </div>

      <section className="relative mx-auto grid min-h-[calc(100vh-7.5rem)] max-w-6xl items-center gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
        <div className="space-y-7">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-indigo-300/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-100 sm:text-sm">
            <img src="/icon.svg" alt="" className="h-5 w-5 rounded-md" />
            <span className="truncate">Self-hosted AI study workflow</span>
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl">
              Turn lecture recordings into study material that is ready to use.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Upload class recordings, create clean transcripts, group them into
              lectures, and generate review podcasts without leaving your own app.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-black/10">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-300">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-100">{item.value}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70 p-2">
            <div className="grid grid-cols-4 gap-2">
              {flow.map((step, index) => (
                <div key={step} className="flex min-w-0 items-center gap-2 rounded-md bg-slate-950/70 px-2.5 py-2 text-xs text-slate-300 sm:px-3">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-indigo-500/20 text-[11px] font-semibold text-indigo-200">
                    {index + 1}
                  </span>
                  <span className="truncate">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/30">
            <img
              src="/images/crammer-landing-hero.png"
              alt=""
              className="aspect-[16/10] w-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="rounded-lg border border-white/10 bg-slate-950/80 p-3 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">Lecture set processed</p>
                    <p className="mt-1 text-xs text-slate-400">3 transcripts grouped into 2 review sessions</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-300">
                    Ready
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/95 p-5 shadow-xl shadow-black/20 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-indigo-300">Private workspace</p>
                <h2 className="mt-1 text-2xl font-bold text-white">Unlock Crammer</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Enter the app secret to continue to your dashboard.
                </p>
              </div>
              <div className="hidden h-12 items-end gap-1.5 opacity-70 sm:flex">
                {[28, 42, 24, 52, 34, 46].map((height, index) => (
                  <span
                    key={index}
                    className="w-1.5 rounded-full bg-indigo-300/80 landing-eq"
                    style={{ height, animationDelay: `${index * 120}ms` }}
                  />
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="secret-key" className="label">
                  Secret key
                </label>
                <input
                  id="secret-key"
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Paste your access key"
                  required
                  autoFocus
                  className="input mt-2"
                />
              </div>

              {error && (
                <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !key}
                className="btn-primary w-full py-3"
              >
                {loading ? "Checking..." : "Enter workspace"}
              </button>
            </form>

            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-800 pt-5">
              {["Local files", "Drive import", "AI scripts"].map((item) => (
                <div key={item} className="rounded-lg bg-slate-950 px-2 py-2 text-center text-[11px] leading-4 text-slate-400 sm:text-xs">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
