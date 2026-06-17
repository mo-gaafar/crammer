import type { Metadata } from "next";
import Link from "next/link";
import SettingsPopover from "./components/SettingsPopover";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crammer - AI Study Materials",
  description:
    "Turn lectures, recordings, and transcripts into study guides, flashcards, quizzes, and review podcasts.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <div className="min-h-screen flex flex-col">
          <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 flex items-center gap-3 sm:gap-6 h-16">
              <Link
                href="/"
                className="flex min-w-0 items-center gap-2.5 font-bold text-lg text-slate-100"
              >
                <img
                  src="/icon.svg"
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-lg shadow-lg shadow-indigo-950/30"
                />
                <span className="truncate">
                  <span className="text-indigo-400">Cram</span>mer
                </span>
              </Link>
              <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/70 p-1 text-sm sm:ml-2">
                <Link href="/" className="nav-link">
                  Workspace
                </Link>
                <Link href="/lectures" className="nav-link">
                  Library
                </Link>
              </div>
              <SettingsPopover />
            </div>
          </nav>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
            Crammer - AI study materials &middot; Deepgram transcription
            &middot; Gemini lecture inference
          </footer>
        </div>
      </body>
    </html>
  );
}
