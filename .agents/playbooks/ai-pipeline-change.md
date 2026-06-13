# AI Pipeline Change Playbook

Use this when touching Gemini, Deepgram, upload, Drive import, lecture processing, or podcast generation.

1. Read `src/lib/gemini.ts`, `src/lib/deepgram.ts`, `src/lib/retry.ts`, and the affected API route.
2. Validate request inputs before external calls.
3. Keep secrets server-side.
4. Preserve retry behavior for Gemini operations.
5. Preserve cleanup of temporary Gemini Files API uploads.
6. Avoid logging transcripts or full model responses.
7. Run static analysis:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/static-analysis.ps1
```

