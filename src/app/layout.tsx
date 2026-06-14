import type { Metadata } from "next";
import Link from "next/link";
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
            <div className="max-w-6xl mx-auto px-4 flex items-center gap-8 h-14">
              <Link
                href="/"
                className="flex items-center gap-2 font-bold text-lg text-slate-100"
              >
                <span className="grid h-7 w-7 place-items-center rounded-md bg-indigo-600 text-sm font-black text-indigo-50">
                  C
                </span>
                <span>
                  <span className="text-indigo-400">Cram</span>mer
                </span>
              </Link>
              <div className="flex items-center gap-1 text-sm">
                <Link
                  href="/"
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                >
                  Upload
                </Link>
                <Link
                  href="/lectures"
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
                >
                  Lectures
                </Link>
              </div>
              <div className="ml-auto text-xs text-slate-500">
                Powered by Deepgram + Gemini
              </div>
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
