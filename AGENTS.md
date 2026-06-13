# Agent Instructions For Crammer

## Mission

Help maintain and extend Crammer, a Next.js 14 app that converts lecture recordings into transcriptions, grouped lectures, and AI-generated podcast scripts.

Before editing, read the relevant files and preserve the current architecture unless the task clearly calls for a larger change.

Shared agent assets live in `.agents/`. Claude-specific commands, hooks, and skills live in `.claude/`.

## Quick Start

- Install: `npm install`
- Develop: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Docker test: `docker compose up --build`
- Static analysis helper: `powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/static-analysis.ps1`

Use `npm run build` as the main verification for app-wide changes. Use `npm run lint` for style and smaller TypeScript/React edits when available.

## Project Context

Crammer's user flow:

1. Users upload local audio/video files or import public Google Drive folder audio.
2. Files are stored under `/tmp/crammer-uploads`.
3. Users transcribe files with Deepgram Nova-2 or Gemini STT.
4. Gemini groups transcripts into lectures based on date and topic continuity.
5. Users open lectures and generate podcast scripts in `qa`, `narrative`, or `discussion` formats.

State is stored in `src/lib/store.ts` as a global in-memory singleton. This is a major project constraint: data disappears when the server process restarts.

## Files To Know

- `src/app/page.tsx`: main upload/import/transcribe/process page.
- `src/app/lectures/page.tsx`: lectures overview.
- `src/app/lectures/[id]/page.tsx`: transcript and podcast-generation UI.
- `src/app/login/page.tsx`: login form for secret-key auth.
- `src/middleware.ts`: optional auth guard.
- `src/app/api/upload/route.ts`: upload and reset.
- `src/app/api/drive/route.ts`: Google Drive browse/import.
- `src/app/api/transcribe/route.ts`: Deepgram/Gemini transcription.
- `src/app/api/process/route.ts`: Gemini lecture grouping.
- `src/app/api/generate-podcast/route.ts`: Gemini podcast generation.
- `src/app/api/status/route.ts`: state hydration and stuck-file recovery.
- `src/lib/store.ts`: in-memory data store.
- `src/lib/metadata.ts`: upload directory, file type checks, recording-date parsing.
- `src/lib/deepgram.ts`: Deepgram transcription.
- `src/lib/gemini.ts`: Gemini STT, grouping, and script generation.
- `src/lib/retry.ts`: retry helper for AI/API calls.
- `src/types/index.ts`: shared domain models.

## Environment And Secrets

Do not commit secrets. Keep real values in `.env` or `.env.local`.

Required for full app use:

- `DEEPGRAM_API_KEY`
- `GEMINI_API_KEY`

Optional:

- `GOOGLE_DRIVE_API_KEY`
- `APP_SECRET_KEY`

If `APP_SECRET_KEY` is not set, middleware allows open access for development.

## Coding Standards

- Use TypeScript and keep shared shapes in `src/types/index.ts`.
- Prefer existing helper modules over duplicating logic.
- Keep API routes explicit: parse input, validate it, call helpers, return JSON.
- Keep external API calls on the server. Never expose API keys from client code.
- Use `@/` imports for app source paths.
- Preserve App Router conventions.
- Keep client components focused on UI state and fetch orchestration.
- Prefer existing Tailwind component classes from `src/app/globals.css`.
- Add comments only when they clarify non-obvious behavior.
- Keep changes scoped to the task. Avoid unrelated refactors.

## AI And External API Practices

- Wrap Gemini calls with `withRetry` when rate limits, quota, 503, aborts, or timeouts are plausible.
- Keep Gemini file uploads cleaned up with `finally`.
- When prompting Gemini for structured output, request strict JSON and handle parse failures with useful errors.
- Keep long transcript prompts mindful of token limits. Existing lecture inference truncates each transcript to 40,000 characters for grouping.
- Deepgram transcription reads the uploaded file from disk and uses Nova-2 with smart formatting, punctuation, paragraphs, diarization, and language detection.

## File Upload Practices

- Validate audio/video uploads with `isAllowedAudioType`.
- Store files through `getUploadDir()` and `ensureUploadDir()`.
- Use UUID-based saved filenames and preserve `originalName` for display and AI context.
- Use `getRecordedAt()` so filename dates are preferred over file modification time.
- When resetting, remove uploaded files and reset the in-memory store.

## UI Practices

- Match the current dark slate/indigo Tailwind style unless a design task explicitly changes direction.
- Reuse `.card`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.badge-*`, `.input`, and `.section-title`.
- Preserve clear phase feedback for upload, transcription, processing, and generation.
- Keep the interface usable for multiple files and long transcripts.
- Avoid adding new global state unless the same state is needed across multiple routes.

## Testing And Verification

For most code changes:

1. Run `npm run lint` if the change touches TypeScript, React, or styles.
2. Run `npm run build` before finishing if the change is broad or touches routes, types, Next config, or dependencies.
3. Manually sanity-check affected flows when possible:
   - upload
   - Drive browse/import
   - transcribe
   - process into lectures
   - open lecture detail
   - generate/copy/download podcast script
   - login when `APP_SECRET_KEY` is set

Network-backed flows require valid API keys and may not be verifiable in every agent environment.

## Known Constraints

- No durable database yet.
- `/tmp/crammer-uploads` may be ephemeral in production.
- Auth is intentionally simple and not user/account based.
- Podcast scripts and lectures are lost on restart.
- Google Drive imports work only for accessible public/shared files.
- Large audio and AI calls can time out or hit provider quotas.

## Safe Change Patterns

- Persistence: keep the `store` API stable, then replace its internals or add a repository layer.
- New STT provider: add a server helper, extend request validation in `/api/transcribe`, then add UI provider selection.
- New Gemini model: update `src/lib/gemini-models.ts`.
- New podcast format: update `PodcastFormat`, `FORMAT_OPTIONS`, and `formatInstructions` together.
- New file type: update `metadata.ts`, file input accept/help text, and README/docs.
- Auth hardening: update middleware, auth route cookies, Docker/env docs, and deployment notes together.

## Things To Avoid

- Do not move AI calls into client components.
- Do not rely on in-memory state for new production-critical behavior without calling out the persistence limitation.
- Do not log transcripts, API keys, auth keys, or full provider responses unless explicitly needed for debugging and safe to expose.
- Do not introduce a second source of truth for files, lectures, or scripts.
- Do not silently change API response shapes used by the client pages.
