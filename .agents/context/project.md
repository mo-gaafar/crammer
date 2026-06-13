# Crammer Context

Crammer is a Next.js 14 App Router app for converting lecture recordings into study assets.

## Core Workflow

1. Upload local audio/video files or import public Google Drive folder audio.
2. Store temporary files in `/tmp/crammer-uploads`.
3. Transcribe with Deepgram Nova-2 or Gemini STT.
4. Group transcriptions into lectures with Gemini.
5. Generate podcast scripts for each lecture.

## Architecture

- Client pages orchestrate fetches and UI state.
- API routes validate input and call server-side helpers.
- `src/lib/store.ts` is an in-memory singleton. This is not durable storage.
- `src/lib/gemini.ts` owns Gemini STT, lecture inference, and podcast generation.
- `src/lib/deepgram.ts` owns Deepgram transcription.
- `src/lib/metadata.ts` owns file type validation and recording date inference.

## Main Risks

- Restarting the server loses state.
- `/tmp/crammer-uploads` may be ephemeral in deployment.
- AI calls may time out, fail quota, or return malformed JSON.
- Transcripts and recordings are sensitive user data.
- Auth is simple secret-key gating, not a real user system.

