# Project Maintenance

Use this skill for docs, dependency, Docker, deployment, auth, and repo hygiene changes.

## Checkpoints

- Keep `.env.example`, README, `CLAUDE.md`, `AGENTS.md`, and `.agents/context/project.md` aligned when environment variables or workflows change.
- For Docker or deployment changes, inspect `Dockerfile`, `docker-compose.yml`, `next.config.mjs`, and runtime env requirements.
- For auth changes, inspect `src/middleware.ts`, `src/app/api/auth/route.ts`, and `src/app/login/page.tsx`.
- For persistence changes, preserve or intentionally replace the `store` API in `src/lib/store.ts`.

## Verification

Use:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/static-analysis.ps1
```

Run a Docker build only when Docker-specific behavior changes.

