# Crammer — AI Study Voice Notes

Upload bulk voice recordings from your lectures. Crammer transcribes them with **Deepgram Nova-2**, uses Claude to chronologically order and group them into named lectures, then generates **podcast scripts** so you can study on the go.

## Features

- **Bulk audio upload** — drag & drop MP3, M4A, WAV, OGG, FLAC, WebM files
- **Deepgram transcription** — Nova-2 model with smart formatting, punctuation, paragraph detection, and speaker diarization
- **Metadata-aware ordering** — date parsing from filenames (`2024-01-15_lecture.m4a`) with fallback to file mtime
- **AI lecture inference** — Claude groups recordings by topic and date, assigns lecture numbers and titles
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
# Edit .env.local with your Deepgram and Anthropic keys

# 3. Run in development
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|---|---|
| `DEEPGRAM_API_KEY` | Deepgram API key ([deepgram.com](https://deepgram.com)) |
| `ANTHROPIC_API_KEY` | Anthropic API key ([console.anthropic.com](https://console.anthropic.com)) |

## Workflow

1. **Upload** — Drop your voice notes. Filenames with dates (`YYYY-MM-DD`) improve ordering accuracy.
2. **Transcribe** — Files are sent to Deepgram one-by-one with progress tracking.
3. **Infer Lectures** — Claude analyzes all transcripts and groups them into named lectures.
4. **Generate Podcast** — Open any lecture and generate a podcast script in your preferred format.

## Tips for Best Results

- Name files with dates: `2024-03-15_thermodynamics.m4a`
- Record one topic per file where possible
- Files from the same lecture recorded on the same day are automatically grouped

## Tech Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS**
- **Deepgram SDK** (`@deepgram/sdk`) — prerecorded audio transcription
- **Anthropic SDK** (`@anthropic-ai/sdk`) — Claude claude-opus-4-6 for lecture inference & podcast generation

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
│       ├── process/          # Claude lecture grouping
│       ├── generate-podcast/ # Claude podcast script generation
│       ├── lectures/         # Lecture CRUD
│       └── status/           # Processing status
├── lib/
│   ├── store.ts              # In-memory data store (global singleton)
│   ├── deepgram.ts           # Deepgram API wrapper
│   ├── anthropic.ts          # Claude API wrapper
│   └── metadata.ts           # File metadata extraction
└── types/index.ts            # Shared TypeScript types
```
