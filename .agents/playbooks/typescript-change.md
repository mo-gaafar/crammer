# TypeScript Change Playbook

Use this when editing `.ts` or `.tsx` files.

1. Read `src/types/index.ts` if shared data shapes are involved.
2. Keep API response shapes stable unless the client is updated in the same change.
3. Prefer `@/` imports for source files.
4. Keep external service calls in server-side modules or API routes.
5. Run static analysis:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/static-analysis.ps1
```

