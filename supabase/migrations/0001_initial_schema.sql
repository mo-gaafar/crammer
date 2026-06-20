-- Per-user schema for StudyForge, replacing src/lib/store.ts's in-memory Map store.
-- Run against the `db` service (Studio SQL editor or `psql` directly) — not auto-applied
-- on container start, see docs/supabase-auth-plan.md.

create extension if not exists "pgcrypto";

create table if not exists public.audio_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_name text not null,
  storage_path text not null,
  mime_type text not null,
  size bigint not null,
  recorded_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  status text not null default 'uploaded' check (status in ('uploaded', 'transcribing', 'transcribed', 'error')),
  error_message text,
  extracted_audio_path text
);

create index if not exists audio_files_user_id_idx on public.audio_files (user_id);

create table if not exists public.transcriptions (
  audio_file_id uuid primary key references public.audio_files(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  words jsonb not null default '[]'::jsonb,
  confidence real not null default 0,
  duration real not null default 0,
  paragraphs jsonb
);

create index if not exists transcriptions_user_id_idx on public.transcriptions (user_id);

create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_number integer not null,
  title text not null,
  summary text not null default '',
  key_topics text[] not null default '{}',
  audio_file_ids uuid[] not null default '{}',
  full_transcript text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists lectures_user_id_idx on public.lectures (user_id);

create table if not exists public.podcast_scripts (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  format text not null check (format in ('qa', 'narrative', 'discussion')),
  title text not null,
  description text not null default '',
  script text not null,
  tts_cost_estimate jsonb,
  generated_at timestamptz not null default now()
);

create index if not exists podcast_scripts_user_id_idx on public.podcast_scripts (user_id);
create index if not exists podcast_scripts_lecture_id_idx on public.podcast_scripts (lecture_id);

create table if not exists public.study_materials (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid references public.lectures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_name text,
  template_id text not null,
  type text not null check (type in ('notes', 'flashcards', 'quiz', 'glossary', 'podcast_script', 'study_guide', 'lecture_study_doc')),
  title text not null,
  description text not null default '',
  content_markdown text not null default '',
  content_json jsonb,
  provider text not null default 'gemini',
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_materials_user_id_idx on public.study_materials (user_id);
create index if not exists study_materials_lecture_id_idx on public.study_materials (lecture_id);

create table if not exists public.text_audio_artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_name text not null,
  title text not null,
  script text not null default '',
  raw_text text,
  tts_provider text check (tts_provider in ('gemini', 'deepgram')),
  tts_cost_estimate jsonb,
  storage_path text,
  mime_type text not null default 'audio/wav',
  created_at timestamptz not null default now(),
  script_status text check (script_status in ('pending', 'generating', 'ready', 'error')),
  script_error text,
  audio_status text check (audio_status in ('idle', 'queued', 'generating', 'complete', 'error')),
  audio_chunks_done integer,
  audio_chunks_total integer,
  audio_error text
);

create index if not exists text_audio_artifacts_user_id_idx on public.text_audio_artifacts (user_id);

alter table public.audio_files enable row level security;
alter table public.transcriptions enable row level security;
alter table public.lectures enable row level security;
alter table public.podcast_scripts enable row level security;
alter table public.study_materials enable row level security;
alter table public.text_audio_artifacts enable row level security;

create policy "owner full access" on public.audio_files
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner full access" on public.transcriptions
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner full access" on public.lectures
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner full access" on public.podcast_scripts
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner full access" on public.study_materials
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner full access" on public.text_audio_artifacts
  using (user_id = auth.uid()) with check (user_id = auth.uid());
