-- REBUS Messenger — 002_storage.sql
-- Storage buckets for future avatars/files.

-- Аватари можна зберігати у bucket `avatars`, якщо не використовуємо Google OAuth picture URL.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('rebus-files', 'rebus-files', false)
on conflict (id) do nothing;

-- Public read for avatars.
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar path: avatars/<user_id>/...
drop policy if exists "avatars authenticated upload own folder" on storage.objects;
create policy "avatars authenticated upload own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Private REBUS files: authenticated users only. More precise contour-based policies can be added later.
drop policy if exists "rebus files authenticated read" on storage.objects;
create policy "rebus files authenticated read"
on storage.objects
for select
to authenticated
using (bucket_id = 'rebus-files');
