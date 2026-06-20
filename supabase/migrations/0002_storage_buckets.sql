-- Private, file-backed Storage buckets for uploaded/generated audio.
-- The `storage` service already runs with STORAGE_BACKEND: file (see docker-compose.yml),
-- so objects land under ./supabase/volumes/storage/<bucket-id>/... on disk.
-- Run after 0001_initial_schema.sql.

insert into storage.buckets (id, name, public)
values
  ('lecture-audio', 'lecture-audio', false),
  ('generated-audio', 'generated-audio', false)
on conflict (id) do nothing;

-- Objects are keyed as `{user_id}/...`; restrict access to the owning user's folder.
create policy "owner read own lecture-audio"
  on storage.objects for select
  using (bucket_id = 'lecture-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner write own lecture-audio"
  on storage.objects for insert
  with check (bucket_id = 'lecture-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner update own lecture-audio"
  on storage.objects for update
  using (bucket_id = 'lecture-audio' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'lecture-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner delete own lecture-audio"
  on storage.objects for delete
  using (bucket_id = 'lecture-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner read own generated-audio"
  on storage.objects for select
  using (bucket_id = 'generated-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner write own generated-audio"
  on storage.objects for insert
  with check (bucket_id = 'generated-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner update own generated-audio"
  on storage.objects for update
  using (bucket_id = 'generated-audio' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'generated-audio' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "owner delete own generated-audio"
  on storage.objects for delete
  using (bucket_id = 'generated-audio' and auth.uid()::text = (storage.foldername(name))[1]);
