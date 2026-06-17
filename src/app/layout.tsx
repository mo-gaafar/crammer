import type { Metadata } from "next";
import Link from "next/link";
import SettingsPopover from "./components/SettingsPopover";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyForge - AI Study Materials",
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
          <nav className="border-b border-stone-200 bg-stone-50/80 backdrop-blur sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 flex items-center gap-3 sm:gap-6 h-16">
              <Link
                href="/"
                className="flex min-w-0 items-center gap-2.5 font-bold text-lg text-stone-900"
              >
                <img
                  src="/icon.svg"
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-lg shadow-lg shadow-espresso-950/30"
                />
                <span className="truncate">
                  <span className="text-espresso-700">Study</span>Forge
                </span>
              </Link>
              <Link href="/lectures" className="nav-link ml-auto sm:ml-2">
                Library
              </Link>
              <SettingsPopover />
            </div>
          </nav>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-stone-200 py-4 text-center text-xs text-stone-400">
            StudyForge - AI study materials &middot; Deepgram transcription
            &middot; Gemini lecture inference
          </footer>
        </div>
      </body>
    </html>
  );
}
