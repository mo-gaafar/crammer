# Deployment Change Playbook

Use this when editing Docker, Next config, env vars, auth, or deployment docs.

1. Inspect `Dockerfile`, `docker-compose.yml`, `next.config.mjs`, `.env.example`, and README.
2. For auth changes, inspect `src/middleware.ts`, `src/app/api/auth/route.ts`, and `src/app/login/page.tsx`.
3. Keep required env vars documented.
4. Consider the `/tmp/crammer-uploads` and in-memory store deployment constraints.
5. Run static analysis and build when feasible:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/static-analysis.ps1
npm run build
```

