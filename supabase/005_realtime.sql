-- REBUS Messenger — 005_realtime.sql
-- Enable realtime publications for chat-related tables.

alter publication supabase_realtime add table public.messenger_messages;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.message_receipts;
