# Crammer

> Open source AI study material generator for lectures, transcripts, course
> recordings, flashcards, quizzes, study guides, printable question banks, and
> review podcasts.

Crammer is an open source education SaaS project for turning lectures,
recordings, and transcripts into reusable study materials.

The current app can upload lecture recordings, transcribe them with Deepgram or
Gemini, group related recordings into lectures with Gemini, and generate podcast
scripts for study on the go. The product direction is broader: Crammer should
become a study-material engine that transforms raw course content into
templates such as study guides, flashcards, quizzes, glossaries, cram sheets,
and review podcasts.

## Product Direction

Crammer is designed around two audiences:

- **Self-hosters and open source users** who want a useful BYOK tool they can
  run with their own provider accounts.
- **Cloud users** who want hosted storage, managed AI credits, subscriptions,
  collaboration, integrations, and less setup.

The open source core should stay genuinely useful. The paid SaaS should
monetize convenience, scale, collaboration, managed AI usage, and polished
workflows instead of locking away the core value.

Read the planning docs:

- [Product Strategy](docs/product-strategy.md)
- [Business Model](docs/business-model.md)
- [BYOK and Provider Keys](docs/byok.md)
- [Study Material Templates](docs/study-material-templates.md)
- [Crammer MCP](docs/mcp.md)
- [Architecture Roadmap](docs/architecture-roadmap.md)
- [Work Plan](docs/work-plan.md)
- [Contributing](CONTRIBUTING.md)
- [Support Crammer](DONATIONS.md)

## Search Keywords

AI study app, lecture transcription, transcript summarizer, study guide
generator, flashcard generator, quiz generator, lecture notes, podcast study
tool, BYOK AI app, self-hosted education SaaS, open source EdTech, Gemini,
Deepgram, Next.js, MCP, Anki export, DOCX study guide, printable question bank.

## Current Features

- Bulk audio/video upload for lecture recordings.
- Public Google Drive folder browsing/import when configured.
- Deepgram Nova-2 transcription with formatting, punctuation, diarization, and
  language detection.
- Gemini speech-to-text transcription option.
- Metadata-aware ordering from filename dates with file mtime fallback.
- Gemini lecture grouping by date and topic continuity.
- Podcast script generation in Q&A, narrative, and discussion formats.
- Optional single-secret auth for simple deployments.
- Dockerfile and Docker Compose support.

## Near-Term Goals

- Add durable persistence so lectures and generated materials survive restarts.
- Support transcript-first uploads, not only audio/video files.
- Generalize podcast generation into a template-based study material pipeline.
- Add exports for Markdown, PDF, Anki-compatible CSV, and shareable bundles.
- Add printable lecture study documents with concept maps, tiered questions,
  writing space, and separated model answers.
- Add a Crammer MCP server so agents and external tools can search lectures,
  read transcripts, generate materials, and export study packs.
- Add account, workspace, subscription, and usage-metering foundations for
  Crammer Cloud.
- Keep BYOK as a first-class self-hosted and cloud option.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DEEPGRAM_API_KEY` | For Deepgram STT | Deepgram API key. |
| `GEMINI_API_KEY` | For Gemini STT, grouping, and generation | Google Gemini API key. |
| `GOOGLE_DRIVE_API_KEY` | Optional | Enables Google Drive browse/import for public or shared files. |
| `APP_SECRET_KEY` | Optional | Enables simple secret-key auth. If unset, local development is open. |

Self-hosted users bring their own keys through environment variables today.
Future multi-user deployments should support encrypted user/workspace keys.

## Workflow

1. Upload local recordings or import audio from a public Google Drive folder.
2. Transcribe each file with Deepgram or Gemini.
3. Process transcripts into grouped lectures.
4. Open a lecture and generate a podcast script.
5. Future workflow: choose a study template and export the generated material.

## Tech Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Deepgram SDK
- Google Generative AI SDK
- In-memory store for the current prototype

## Current Architecture

```text
src/
  app/
    page.tsx                 Upload/import/transcribe/process UI
    lectures/page.tsx        Lecture list
    lectures/[id]/page.tsx   Lecture detail and podcast generation
    api/
      upload/                File ingestion and reset
      drive/                 Google Drive browse/import
      transcribe/            Deepgram/Gemini transcription
      process/               Gemini lecture grouping
      generate-podcast/      Gemini podcast script generation
      lectures/              Lecture APIs
      status/                State hydration and stuck-file recovery
      auth/                  Simple secret-key auth
  lib/
    store.ts                 In-memory singleton store
    metadata.ts              Upload directory, file checks, recording dates
    deepgram.ts              Deepgram transcription
    gemini.ts                Gemini STT, grouping, and generation
    retry.ts                 Retry helper
  types/index.ts             Shared domain models
```

## Verification

```bash
npm run lint
npm run build
docker compose up --build
```

Network-backed flows require valid provider keys and may not be verifiable in
every local environment.

## Known Constraints

- State is stored in a global in-memory singleton and disappears on restart.
- Uploaded files are stored under `/tmp/crammer-uploads`.
- Auth is intentionally simple and not user/account based yet.
- Google Drive imports work only for accessible public/shared files.
- Large audio and AI calls can time out or hit provider quotas.

## License

License has not been finalized yet. See [Business Model](docs/business-model.md)
for the recommended open source licensing direction.
