# Supabase Auth, Per-User Library, and Storage Migration Plan

## Context

StudyForge is currently a single-tenant prototype: `src/lib/store.ts` is a
global in-memory `Map`-based singleton, uploaded files live unscoped on disk
under `/tmp/crammer-uploads`, and auth is a single shared `APP_SECRET_KEY`
cookie checked in `src/middleware.ts` with no concept of a user. This is
fine for one person running their own instance, but it cannot support
multiple people sharing a deployment without seeing each other's lectures,
transcripts, and generated study material.

A self-hosted Supabase stack (Postgres + GoTrue auth + PostgREST + Storage +
Realtime + Studio) has been added to `docker-compose.yml` (see
`supabase/volumes/`, vendored from the official `supabase/supabase` docker
self-host template). This doc lays out how to actually wire it in: real
per-user accounts, a per-user library of lectures/materials, and local
Storage buckets for audio files — replacing the in-memory store and the
shared-secret cookie. This corresponds to Phase 6 ("Accounts and
Workspaces") in [work-plan.md](work-plan.md).

Nothing here is implemented yet. This is the plan to review before any
app code changes.

## Target data model

Keep it flat — one user owns their own rows directly, no workspace/team
layer yet (the architecture roadmap's `Workspace`/`WorkspaceMember` entities
can be added later as a thin wrapper around `user_id` without reshaping this
schema).

```
auth.users                 -- managed entirely by Supabase Auth (GoTrue)

public.audio_files
  id uuid pk, user_id uuid fk -> auth.users, original_name, storage_path,
  mime_type, size, recorded_at, uploaded_at, status, error_message,
  extracted_audio_path

public.transcriptions
  audio_file_id uuid fk -> audio_files (pk), user_id uuid,
  text, words jsonb, confidence, duration, paragraphs jsonb

public.lectures
  id uuid pk, user_id uuid, lecture_number, title, summary,
  key_topics text[], audio_file_ids uuid[], full_transcript, created_at

public.podcast_scripts
  id uuid pk, lecture_id uuid fk -> lectures, user_id uuid,
  format, title, description, script, tts_cost_estimate jsonb, generated_at

public.study_materials
  id uuid pk, lecture_id uuid fk -> lectures (nullable), user_id uuid,
  source_name, template_id, type, title, description,
  content_markdown, content_json jsonb, provider, model, created_at, updated_at

public.text_audio_artifacts
  id uuid pk, user_id uuid, source_name, title, script, raw_text,
  tts_provider, tts_cost_estimate jsonb, storage_path, mime_type,
  created_at, script_status, script_error, audio_status,
  audio_chunks_done, audio_chunks_total, audio_error
```

Every table gets `user_id uuid not null references auth.users(id) on delete cascade`
and Row Level Security:

```sql
alter table public.lectures enable row level security;
create policy "owner full access" on public.lectures
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- repeat per table
```

With RLS in place, the app can talk to PostgREST (`rest` service, exposed by
Kong) using the user's own JWT and the database itself enforces isolation —
no `WHERE user_id = ...` can be forgotten in app code.

`audio_files.saved_path` / `text_audio_artifacts.audio_path` become
`storage_path` — a path inside a Supabase Storage bucket instead of a
filesystem path, e.g. `audio/{user_id}/{audio_file_id}.mp3`.

## Storage buckets

The `storage` service is already configured with `STORAGE_BACKEND: file`
(see `docker-compose.yml`), so buckets are plain folders on disk under
`./supabase/volumes/storage` — no S3 account needed, matches the "locally
hosted buckets" ask.

Two buckets, both private (no public read):

- `lecture-audio` — original uploads + extracted audio, replaces
  `/tmp/crammer-uploads` for anything kept beyond the transcription step.
- `generated-audio` — text-to-audio WAV output (`TextAudioArtifact.audioPath`).

Object keys are prefixed with `user_id` and a Storage RLS policy restricts
access to `auth.uid() = (storage.foldername(name))[1]::uuid`, the standard
Supabase per-user-folder pattern. Downloads go through signed URLs
(`storage.createSignedUrl`) rather than the public endpoint.

`/tmp/crammer-uploads` stays as a *transient* staging area: incoming
multipart uploads land there first (as today), then get pushed to the
`lecture-audio` bucket once `AudioFile` records are created, and the local
temp copy is deleted. This keeps the existing extraction/transcription code
that does synchronous `fs` reads on a local path largely unchanged — it just
operates on a freshly-downloaded copy from Storage when needed instead of
assuming the original upload is still on disk.

## Auth flow

Replace `crammer_auth` cookie auth with Supabase Auth, using `@supabase/ssr`
(the supported package for Next.js cookie-based sessions):

1. `npm install @supabase/ssr @supabase/supabase-js`
2. `src/lib/supabase/server.ts` — `createServerClient` reading/writing
   cookies via `next/headers`, used in Server Components, Route Handlers,
   and Server Actions.
3. `src/lib/supabase/client.ts` — `createBrowserClient` for client
   components (e.g. the login form).
4. Replace `src/app/login/page.tsx` and `src/app/api/auth/route.ts` with
   Supabase email/password sign-in (`supabase.auth.signInWithPassword`) and
   sign-up. Keep the page at `/login`, same UX shell, swap the backing call.
5. `src/middleware.ts` swaps the `crammer_auth` cookie check for
   `supabase.auth.getUser()` via the SSR client, refreshing the session on
   every request (the standard `@supabase/ssr` middleware pattern). Keep
   `APP_SECRET_KEY` as a documented fallback for self-hosters who don't want
   multi-user accounts at all (Phase 6 in work-plan.md explicitly says to
   preserve this option) — if `APP_SECRET_KEY` is set and Supabase env vars
   are absent, fall back to today's behavior; the two are mutually exclusive
   per deployment, not layered.
6. Every API route under `src/app/api/**` reads the user via the server
   Supabase client at the top of the handler and uses that `user.id` for all
   queries/storage paths. No route currently checks auth at all (confirmed —
   they all rely solely on the global middleware), so this is new code in
   each route, not a refactor of existing checks.

## Store migration

`src/lib/store.ts`'s public method signatures (`addAudioFile`,
`getAllLectures`, etc.) stay conceptually the same shape but become async
Supabase queries scoped by the caller's `user_id`, e.g.:

```ts
async function getAllLectures(supabase: SupabaseClient): Promise<Lecture[]> {
  const { data } = await supabase
    .from("lectures")
    .select("*")
    .order("lecture_number");
  return data ?? [];
}
```

Because RLS scopes rows automatically once the client is authenticated as
that user, route handlers don't need to pass `user_id` explicitly into
every query — just need to use a per-request client built from the
incoming session, not the old global singleton.

This is the highest-risk, most mechanical part of the migration: every API
route listed in the architecture map touches `store.*` and needs updating
to call the new async store against a request-scoped client instead of the
synchronous global one. Do this one route at a time, route + its tests
(once tests exist) in the same change, not as one giant rewrite.

## Suggested rollout order

1. Stand up Supabase via `docker compose up` (done), run
   `supabase/generate-secrets.sh`, confirm Studio loads at
   `localhost:8000` and `auth.users` / SQL editor work.
2. Write the schema + RLS migration SQL (table list above) and the two
   Storage buckets + policies. Apply via Studio's SQL editor or a
   `supabase/migrations/*.sql` file run against `db` directly.
3. Add `@supabase/ssr` server/browser clients and swap login + middleware.
   At this point auth works but no data is wired up yet.
4. Migrate `store.ts` and the routes that read/write `audio_files` and
   `transcriptions` first (upload, transcribe) — these are the entry point
   for everything else.
5. Migrate `lectures`, `podcast_scripts`, `study_materials`,
   `text_audio_artifacts` the same way.
6. Switch upload/download paths from `/tmp/crammer-uploads` to the Storage
   buckets, keeping `/tmp` only as transient staging.
7. Remove the in-memory store and the `crammer_auth` cookie path once every
   route is migrated and verified end-to-end (upload → transcribe → process
   → generate, all scoped to a real logged-in user).

## Verification

- `docker compose up --build`, confirm `supabase-db`, `supabase-auth`,
  `supabase-rest`, `supabase-storage`, `supabase-kong`, `supabase-studio` all
  report healthy (`docker compose ps`).
- Open `http://localhost:8000`, log into Studio, confirm `auth.users` table
  exists and you can create a test user from the Auth panel.
- After the auth flow lands: sign up two separate users in the running app,
  upload a lecture as each, and confirm neither can see the other's
  lectures via the UI or by calling `/api/lectures` with the other user's
  session cookie.
- After storage migration: confirm uploaded audio appears under
  `supabase/volumes/storage/lecture-audio/{user_id}/...` on disk, and that
  a signed download URL for one user's file 403s when fetched without that
  user's auth.
