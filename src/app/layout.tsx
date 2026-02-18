import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Crammer — AI Study Voice Notes",
  description:
    "Upload bulk voice notes, transcribe them with Deepgram, group into lectures, and generate podcast scripts with AI.",
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
          {/* Nav */}
          <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 flex items-center gap-8 h-14">
              <Link href="/" className="flex items-center gap-2 font-bold text-lg text-slate-100">
                <span className="text-2xl">🎙️</span>
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
                Powered by Deepgram + Claude
              </div>
            </div>
          </nav>

          {/* Main content */}
          <main className="flex-1">{children}</main>

          {/* Footer */}
          <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-600">
            Crammer — AI Study Voice Notes &middot; Deepgram transcription &middot; Claude lecture inference
          </footer>
        </div>
      </body>
    </html>
  );
}
