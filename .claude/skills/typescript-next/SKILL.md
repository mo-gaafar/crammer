# TypeScript Next.js Static Analysis

Use this skill when changing TypeScript, React components, Next.js route handlers, config, middleware, or shared types.

## Workflow

1. Read the relevant files and shared types in `src/types/index.ts`.
2. Prefer existing helpers and App Router patterns.
3. After edits, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/static-analysis.ps1
```

## Project Rules

- Keep API keys and AI provider calls server-side.
- Keep request validation in API routes.
- Reuse `@/` imports.
- Reuse Tailwind classes from `src/app/globals.css`.
- Preserve `strict` TypeScript compatibility.
- Do not silently change API response shapes consumed by client pages.

## Common Files

- `src/types/index.ts`
- `src/app/**/*.tsx`
- `src/app/api/**/route.ts`
- `src/lib/*.ts`
- `src/middleware.ts`

