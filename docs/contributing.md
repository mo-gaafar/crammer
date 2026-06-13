# Contributing

Thanks for helping build Crammer. The project goal is an open source education
tool that turns lectures and transcripts into useful study materials, with a
hosted SaaS for people who want convenience and managed AI usage.

## Ways To Contribute

- Fix bugs.
- Improve the UI.
- Add study material templates.
- Improve prompts and output schemas.
- Add export formats.
- Add provider integrations.
- Improve self-hosting docs.
- Add tests and verification.
- Translate UI or templates.

## Development Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Provider Keys

For local AI-backed flows, configure:

- `DEEPGRAM_API_KEY`
- `GEMINI_API_KEY`
- `GOOGLE_DRIVE_API_KEY` if testing Drive import

Do not commit secrets. Keep real values in `.env.local` or your deployment
secret manager.

## Code Guidelines

- Use TypeScript.
- Keep shared domain shapes in `src/types/index.ts`.
- Keep external API calls on the server.
- Use existing helper modules before adding new abstractions.
- Preserve App Router conventions.
- Keep API route response shapes stable unless client code changes with them.
- Use the existing Tailwind classes and dark slate/indigo style.
- Add comments only for non-obvious behavior.

## Verification

Run the narrowest useful checks:

```bash
npm run lint
npm run build
```

Manual checks are important for flows that depend on provider keys:

- upload
- Drive browse/import
- transcribe
- process into lectures
- open lecture detail
- generate/copy/download study material
- login when `APP_SECRET_KEY` is set

## Template Contributions

Templates are planned as a major community contribution path. Until the
template registry exists, discuss new template ideas in an issue and include:

- target learner or subject
- input requirements
- desired output format
- example output
- export needs

Good template ideas are specific, repeatable, and useful outside a single
course.
