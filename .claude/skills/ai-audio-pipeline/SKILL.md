# AI Audio Pipeline

Use this skill when editing upload, Drive import, transcription, lecture inference, Gemini prompts, Deepgram behavior, or podcast generation.

## Pipeline

1. `src/app/api/upload/route.ts` stores local files in `/tmp/crammer-uploads`.
2. `src/app/api/drive/route.ts` lists/imports public Google Drive audio files.
3. `src/app/api/transcribe/route.ts` transcribes uploaded files with Deepgram or Gemini.
4. `src/app/api/process/route.ts` asks Gemini to group transcriptions into lectures.
5. `src/app/api/generate-podcast/route.ts` asks Gemini to generate scripts.

## Guardrails

- Validate MIME type and extension with `isAllowedAudioType`.
- Preserve original filenames for display and AI context.
- Prefer filename dates through `getRecordedAt`.
- Keep Gemini calls behind `withRetry`.
- Clean up Gemini Files API uploads in `finally`.
- Treat full transcripts as sensitive user data.
- Do not log secrets, transcripts, or full AI responses unless the user explicitly asks and it is safe.

## Verification

Run static checks after code changes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/scripts/static-analysis.ps1
```

Network-backed flows require valid `DEEPGRAM_API_KEY`, `GEMINI_API_KEY`, and sometimes `GOOGLE_DRIVE_API_KEY`.

