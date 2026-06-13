# /ai-flow

Use this before editing AI, transcription, or podcast-generation behavior.

Read:

```powershell
Get-Content src\lib\gemini.ts
Get-Content src\lib\deepgram.ts
Get-Content src\lib\retry.ts
Get-Content src\app\api\transcribe\route.ts
Get-Content src\app\api\process\route.ts
Get-Content src\app\api\generate-podcast\route.ts
```

Keep external API calls server-side, protect secrets, and preserve cleanup for temporary Gemini Files API uploads.

