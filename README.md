# Crammer — AI Study Voice Notes

Upload bulk voice recordings from your lectures. Crammer transcribes them with **Deepgram Nova-2**, uses **Gemini** to chronologically order and group them into named lectures, then generates **podcast scripts** so you can study on the go.

## Features

- **Bulk audio upload** — drag & drop MP3, M4A, WAV, OGG, FLAC, WebM files
- **Deepgram transcription** — Nova-2 model with smart formatting, punctuation, paragraph detection, and speaker diarization
- **Metadata-aware ordering** — date parsing from filenames (`2024-01-15_lecture.m4a`) with fallback to file mtime
- **AI lecture inference** — Gemini groups recordings by topic and date, assigns lecture numbers and titles
- **Podcast script generation** in three formats:
  - **Q&A Style** — student–expert dialogue
  - **Solo Narrative** — engaging monologue
  - **Two-Host Discussion** — co-hosts Alex & Riley

## Setup

```bash
# 1. Clone and install
npm install

# 2. Configure API keys
cp .env.example .env.local
# Edit .env.local with your Deepgram and Gemini keys

# 3. Run in development
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|---|---|
| `DEEPGRAM_API_KEY` | Deepgram API key ([deepgram.com](https://deepgram.com)) |
| `GEMINI_API_KEY` | Google Gemini API key ([aistudio.google.com](https://aistudio.google.com)) |

## Workflow

1. **Upload** — Drop your voice notes. Filenames with dates (`YYYY-MM-DD`) improve ordering accuracy.
2. **Transcribe** — Files are sent to Deepgram one-by-one with progress tracking.
3. **Infer Lectures** — Gemini analyzes all transcripts and groups them into named lectures.
4. **Generate Podcast** — Open any lecture and generate a podcast script in your preferred format.

## Tips for Best Results

- Name files with dates: `2024-03-15_thermodynamics.m4a`
- Record one topic per file where possible
- Files from the same lecture recorded on the same day are automatically grouped

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS**
- **Deepgram SDK** (`@deepgram/sdk`) — prerecorded audio transcription
- **Google Generative AI SDK** (`@google/generative-ai`) — Gemini 2.0 Flash for lecture inference & podcast generation

## Architecture

```
src/
├── app/
│   ├── page.tsx              # Upload & workflow wizard
│   ├── lectures/
│   │   ├── page.tsx          # Lectures list
│   │   └── [id]/page.tsx     # Lecture detail + podcast generation
│   └── api/
│       ├── upload/           # File ingestion + metadata extraction
│       ├── transcribe/       # Deepgram transcription per file
│       ├── process/          # Gemini lecture grouping
│       ├── generate-podcast/ # Gemini podcast script generation
│       ├── lectures/         # Lecture CRUD
│       └── status/           # Processing status
├── lib/
│   ├── store.ts              # In-memory data store (global singleton)
│   ├── deepgram.ts           # Deepgram API wrapper
│   ├── gemini.ts             # Gemini API wrapper
│   └── metadata.ts           # File metadata extraction
└── types/index.ts            # Shared TypeScript types
```

## Docker / Coolify Deploy

```bash
# Local Docker test
docker compose up --build

# Required env vars (set in Coolify dashboard or .env.local)
DEEPGRAM_API_KEY=...
GEMINI_API_KEY=...
```

Coolify will auto-detect the `Dockerfile`. Set the two env vars in the Coolify dashboard and expose port `3000`.
