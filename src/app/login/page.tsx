"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const highlights = [
  { label: "Transcribe", value: "Nova-2 + Gemini" },
  { label: "Organize", value: "Lecture grouping" },
  { label: "Study", value: "Podcast scripts" },
];

const flow = ["Upload recordings", "Clean transcripts", "Grouped lectures", "Review podcasts"];

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
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0">
        <img
          src="/images/crammer-landing-hero.png"
          alt=""
          className="h-full w-full scale-105 object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.26),transparent_26%),linear-gradient(115deg,rgba(2,6,23,0.96)_0%,rgba(15,23,42,0.9)_38%,rgba(15,23,42,0.62)_100%)]" />
      </div>

      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="landing-wave landing-wave-a" />
        <div className="landing-wave landing-wave-b" />
        <div className="landing-wave landing-wave-c" />
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 shadow-lg shadow-cyan-500/10">
              <span className="h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_22px_rgba(103,232,249,0.9)]" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              <span className="text-cyan-300">Cram</span>mer
            </span>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 backdrop-blur sm:flex">
            Self-hosted AI study workflow
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.08fr_0.92fr] lg:py-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-sm text-cyan-100 shadow-lg shadow-cyan-950/20 backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
              Lecture recordings become focused study sessions
            </div>

            <h1 className="max-w-4xl text-5xl font-black leading-[0.95] tracking-normal text-white sm:text-6xl lg:text-7xl">
              Turn messy lectures into something you actually want to review.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Crammer transcribes recordings, groups related sessions into lectures, and
              generates podcast-ready review scripts for studying between classes.
            </p>

            <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {highlights.map((item) => (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.07] p-4 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              {flow.map((step, index) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="rounded-full border border-cyan-300/30 bg-slate-950/60 px-3 py-1 text-cyan-100">
                    {step}
                  </span>
                  {index < flow.length - 1 && <span className="hidden text-cyan-300/70 sm:inline">/</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:mr-0">
            <div className="absolute -inset-4 rounded-[2rem] border border-cyan-300/20 bg-cyan-300/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-slate-950/78 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="absolute right-6 top-6 flex h-14 items-end gap-1.5 opacity-70">
                {[28, 42, 24, 52, 34, 46].map((height, index) => (
                  <span
                    key={index}
                    className="w-1.5 rounded-full bg-cyan-300/80 landing-eq"
                    style={{ height, animationDelay: `${index * 120}ms` }}
                  />
                ))}
              </div>

              <div className="mb-8 pr-24">
                <p className="text-sm font-medium text-cyan-200">Private workspace</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Unlock Crammer</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Enter the app secret to continue to your upload and lecture dashboard.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="input mt-2 border-white/10 bg-white/[0.08] backdrop-blur placeholder:text-slate-500"
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
                  className="w-full rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Checking..." : "Enter workspace"}
                </button>
              </form>

              <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-5">
                {["Local files", "Drive import", "AI scripts"].map((item) => (
                  <div key={item} className="rounded-lg bg-white/[0.06] px-3 py-2 text-center text-xs text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
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
