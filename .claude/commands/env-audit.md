# /env-audit

Audit environment variable usage without exposing secret values.

Recommended checks:

```powershell
rg "process\\.env|APP_SECRET_KEY|GEMINI_API_KEY|DEEPGRAM_API_KEY|GOOGLE_DRIVE_API_KEY" src .env.example README.md Dockerfile docker-compose.yml
```

Confirm that new required variables are documented in `.env.example`, README/deployment notes, and relevant agent docs.

