# Contributing to StudyForge

Welcome. StudyForge is an open source education project for turning lectures,
recordings, and transcripts into study materials people can actually use:
study guides, flashcards, quizzes, concept maps, printable question banks,
review podcasts, and course packs.

You do not need to be a full-stack engineer to contribute. Strong templates,
better prompts, clear docs, subject-matter examples, and testing weird real
lecture files are all valuable.

## Good First Contributions

- Improve setup docs.
- Add example transcripts or demo courses.
- Polish empty, loading, and error states.
- Improve prompt wording for a study material template.
- Add export examples for Markdown, Anki CSV, DOCX, or PDF.
- File bugs with clear reproduction steps.
- Suggest templates for specific subjects, majors, or study styles.
- Improve accessibility and mobile usability.

## Contribution Lanes

### Code

The app is currently a Next.js 14 project using TypeScript, Tailwind, Deepgram,
Gemini, and an in-memory prototype store.

Useful code areas:

- durable persistence
- transcript-first ingestion
- study material templates
- export formats
- BYOK provider-key handling
- background jobs
- MCP resources and tools
- SaaS billing and usage metering

### Study Templates

Templates are the heart of StudyForge. A good template is specific, repeatable,
and produces a study artifact someone would keep.

Examples:

- lecture study document
- Cornell notes
- flashcards
- multiple choice quiz
- short answer quiz
- glossary
- formula sheet
- exam cram sheet
- review podcast
- case brief

### Docs

Docs should help three groups:

- students who want to use StudyForge
- self-hosters who want BYOK and control
- contributors who want a clear next task

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Provider-backed flows need keys in `.env.local`:

```bash
DEEPGRAM_API_KEY=...
GEMINI_API_KEY=...
GOOGLE_DRIVE_API_KEY=...
APP_SECRET_KEY=...
```

Do not commit real secrets.

## Development Checks

Run checks that match your change:

```bash
npm run lint
npm run build
```

Use `npm run build` for broad changes, route changes, type changes,
dependency changes, and release prep.

## Pull Request Checklist

- The change is scoped to one clear problem.
- User-facing behavior is described in the PR.
- Docs are updated when behavior or setup changes.
- API response shape changes are intentional and coordinated with client code.
- Provider keys stay server-side.
- No transcripts, API keys, auth keys, or full provider responses are logged.
- `npm run lint` or `npm run build` was run when relevant.

## Before You Add a Big Feature

Open an issue first for:

- persistence architecture
- accounts and workspaces
- billing
- provider credential storage
- MCP design
- new AI providers
- new export engines
- changes to public API response shapes

This keeps the project coherent as it grows.

## Community Tone

Be direct, generous, and practical. StudyForge is for learning; the project should
feel like that too.

Assume good intent, explain tradeoffs, and help newcomers find a useful first
step.
