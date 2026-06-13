# Post-Edit Static Analysis Hook

`.claude/settings.json` runs this command after file edits:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/static-analysis.ps1 -Fast
```

The hook is intentionally defensive:

- It exits successfully if `node_modules` is missing and tells the agent to run `npm install`.
- It runs TypeScript checks with `npx tsc --noEmit --pretty false`.
- In non-fast mode it also runs `npm run lint`.
- It does not run network-backed AI flows.

Use the full check manually before finishing broader work:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/static-analysis.ps1
```

