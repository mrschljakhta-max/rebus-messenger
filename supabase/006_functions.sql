-- REBUS Messenger — 006_functions.sql
-- Utility functions for future backend logic.

create or replace function public.rebus_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rebus_profiles_touch_updated_at on public.rebus_profiles;
create trigger rebus_profiles_touch_updated_at
before update on public.rebus_profiles
for each row
execute function public.rebus_touch_updated_at();

drop trigger if exists messenger_messages_touch_updated_at on public.messenger_messages;
create trigger messenger_messages_touch_updated_at
before update on public.messenger_messages
for each row
execute function public.rebus_touch_updated_at();
