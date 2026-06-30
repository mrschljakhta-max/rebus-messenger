-- REBUS Messenger — 001_init.sql
-- Базові таблиці проєкту. Безпечно для повторного запуску.

create extension if not exists pgcrypto;

create table if not exists public.rebus_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text default 'USER',
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.messenger_messages (
  id uuid primary key default gen_random_uuid(),
  contour_id uuid,
  recipient_id uuid,
  conversation_key text,
  channel text not null default 'direct',
  user_id uuid references auth.users(id) on delete cascade,
  user_email text,
  user_name text,
  body text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messenger_messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

create table if not exists public.message_receipts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.messenger_messages(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'read',
  read_at timestamptz default now(),
  unique(message_id, user_id)
);

create index if not exists idx_rebus_profiles_user_id on public.rebus_profiles(user_id);
create index if not exists idx_messenger_messages_direct on public.messenger_messages(channel, conversation_key, created_at);
create index if not exists idx_messenger_messages_recipient on public.messenger_messages(recipient_id, created_at);
create index if not exists idx_message_reactions_message on public.message_reactions(message_id);
create index if not exists idx_message_receipts_message on public.message_receipts(message_id);
