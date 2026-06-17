# StudyForge Project Guide

## Project Summary

StudyForge is a Next.js 14 App Router application for turning lecture voice notes into study material.

Claude-specific project assets live in `.claude/`, including slash-command prompts, local skills, and a post-edit static-analysis hook. Shared agent assets live in `.agents/`.

The core workflow is:

1. Upload or import multiple audio/video recordings.
2. Store files temporarily in `/tmp/crammer-uploads`.
3. Transcribe recordings with Deepgram Nova-2 or Gemini STT.
4. Use Gemini to group transcriptions into chronological lectures.
5. Generate study podcast scripts for each lecture.

The app currently uses an in-memory global store, so uploaded files, transcriptions, lectures, and generated scripts are not durable across process restarts. Treat this as a prototype/local or single-instance deployment constraint unless persistence is explicitly added.

## Tech Stack

- Next.js 14 App Router
- React 18 client components for the main UI flows
- TypeScript
- Tailwind CSS
- Deepgram SDK for prerecorded transcription
- Google Generative AI SDK for Gemini transcription, lecture grouping, and podcast generation
- Docker/Coolify deployment support

## Important Commands

- `npm install`: install dependencies
- `npm run dev`: start local development server
- `npm run build`: production build and type/lint validation through Next.js
- `npm run start`: start the production server
- `npm run lint`: run Next linting
- `docker compose up --build`: local container test
- `powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/static-analysis.ps1`: run TypeScript and lint checks

Run `npm run build` before considering broad app changes complete. Run `npm run lint` for style-focused changes when dependencies are available.

## Environment Variables

Required for full functionality:

- `DEEPGRAM_API_KEY`: required for Deepgram transcription.
- `GEMINI_API_KEY`: required for Gemini STT, lecture inference, and podcast generation.

Optional:

- `GOOGLE_DRIVE_API_KEY`: used for Google Drive folder imports. The app falls back to `GEMINI_API_KEY` if this is not set.
- `APP_SECRET_KEY`: enables simple password-style protection through middleware. If omitted, the app is open for development.

Never commit real secrets. Use `.env.example` as the public template and keep local secrets in `.env` or `.env.local`.

## Architecture Map

- `src/app/page.tsx`: upload workflow, Google Drive import UI, STT provider/model settings, transcription and lecture-processing actions.
- `src/app/lectures/page.tsx`: lecture list.
- `src/app/lectures/[id]/page.tsx`: lecture detail, transcript viewing, podcast generation, copy/download actions.
- `src/app/login/page.tsx`: secret-key login screen used when `APP_SECRET_KEY` is configured.
- `src/middleware.ts`: optional app protection based on `APP_SECRET_KEY` and the `crammer_auth` cookie.
- `src/app/api/upload/route.ts`: multipart file upload, temporary disk writes, reset/delete behavior.
- `src/app/api/drive/route.ts`: public Google Drive folder listing and selected file import.
- `src/app/api/transcribe/route.ts`: per-file transcription through Deepgram or Gemini.
- `src/app/api/process/route.ts`: Gemini lecture grouping from transcribed files.
- `src/app/api/generate-podcast/route.ts`: Gemini podcast script generation.
- `src/app/api/lectures/route.ts`: lecture list API.
- `src/app/api/lectures/[id]/route.ts`: lecture detail API.
- `src/app/api/status/route.ts`: current processing state and file/transcript hydration.
- `src/lib/store.ts`: global in-memory singleton store.
- `src/lib/metadata.ts`: supported audio types, upload directory, and recording-date inference.
- `src/lib/deepgram.ts`: Deepgram transcription wrapper.
- `src/lib/gemini.ts`: Gemini STT, lecture inference, podcast generation, and file cleanup.
- `src/lib/gemini-models.ts`: supported Gemini model list and default model.
- `src/lib/retry.ts`: retry helper for rate limits, quota, 503, timeout, and aborted requests.
- `src/types/index.ts`: shared domain types.

## Data Flow Notes

- Uploaded and Drive-imported files become `AudioFile` records in `store`.
- Transcriptions are keyed by `audioFileId`.
- Lecture inference sorts transcribed files by `recordedAt`, sends simplified IDs like `file_0` to Gemini, then maps them back to real UUIDs.
- `Lecture.createdAt` is set to the earliest recording date in that lecture, not the generation time.
- Podcast scripts are stored in memory and associated with a lecture ID.
- `GET /api/status` intentionally reports stuck `transcribing` files as `uploaded` to help recover from crashed requests.

## Coding Practices

- Prefer TypeScript types from `src/types/index.ts` and keep API response shapes consistent with those types.
- Keep API route handlers small and explicit. Validate request input before calling external APIs.
- Preserve the existing App Router structure and `@/` path alias.
- Keep UI state local to client pages unless shared state becomes genuinely necessary.
- Use existing Tailwind component classes from `src/app/globals.css` before adding new styling patterns.
- Keep external AI calls server-side only. Do not expose API keys to client components.
- Use `withRetry` around Gemini operations that may hit rate limits, quota, 503s, or timeouts.
- When adding file-handling behavior, validate MIME type and extension with `isAllowedAudioType`.
- Clean up external temporary resources when possible, as Gemini Files API uploads currently do in `finally`.
- Be careful with synchronous filesystem calls in API routes. They are acceptable in the current prototype, but larger production work should consider async I/O and durable storage.

## UX Conventions

- The visual language is dark, slate/indigo, card-based, and utility-focused.
- Reuse `.card`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, badge classes, `.input`, and `.section-title`.
- Existing pages use client-side fetches, optimistic-ish local state, and simple progress states.
- Keep upload, transcription, processing, and generation flows explicit; users should always know which phase they are in.

## Known Constraints And Risks

- State is in memory. A server restart loses uploaded file records, transcriptions, lectures, and generated scripts.
- Uploaded files live in `/tmp/crammer-uploads`, which may be ephemeral depending on deployment.
- The auth cookie currently stores only `crammer_auth=ok`; `APP_SECRET_KEY` gates login but there is no user model.
- `secure: false` is set on the auth cookie, so production HTTPS hardening may be needed.
- Large audio files can take a long time. Gemini timeout is currently 10 minutes; Deepgram fetch timeout is 2 minutes.
- Gemini lecture grouping depends on valid JSON output. The parser strips markdown fences but otherwise expects strict JSON.
- Google Drive import requires public/shared files and an API key.

## Change Guidelines

- For persistence work, update the store abstraction first so API routes do not need broad rewrites.
- For new AI providers, add server-side wrappers in `src/lib`, expose only provider/model choices needed by the UI, and keep request validation in API routes.
- For new podcast formats, extend `PodcastFormat`, update UI format options, and update Gemini prompt instructions together.
- For new supported file types, update `ALLOWED_AUDIO_TYPES`, extension fallback checks, and user-facing accept/help text.
- For deployment/security changes, verify middleware, cookies, environment variables, Docker, and README together.
