-- REBUS Messenger: sync Google/OAuth avatars into public profile rows
-- Run this in Supabase SQL Editor.

alter table public.rebus_profiles
add column if not exists avatar_url text;

-- Backfill existing users from auth metadata.
-- Works for users that signed in through Google/OAuth and have picture/avatar metadata.
update public.rebus_profiles p
set avatar_url = coalesce(
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'picture',
  u.raw_user_meta_data->>'photo_url',
  u.raw_user_meta_data->>'avatar'
)
from auth.users u
where p.user_id = u.id
  and coalesce(p.avatar_url, '') = ''
  and coalesce(
    u.raw_user_meta_data->>'avatar_url',
    u.raw_user_meta_data->>'picture',
    u.raw_user_meta_data->>'photo_url',
    u.raw_user_meta_data->>'avatar'
  ) is not null;

create or replace function public.rebus_sync_profile_avatar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rebus_profiles
  set avatar_url = coalesce(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    new.raw_user_meta_data->>'photo_url',
    new.raw_user_meta_data->>'avatar',
    avatar_url
  )
  where user_id = new.id;

  return new;
end;
$$;

drop trigger if exists rebus_sync_profile_avatar_on_auth_users on auth.users;

create trigger rebus_sync_profile_avatar_on_auth_users
after insert or update of raw_user_meta_data on auth.users
for each row
execute function public.rebus_sync_profile_avatar();
