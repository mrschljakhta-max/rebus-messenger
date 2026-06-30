# REBUS Messenger — Supabase

Ця папка містить SQL-міграції для бази даних Supabase.

## Як запускати

1. Відкрий Supabase Dashboard.
2. Перейди в **SQL Editor**.
3. Запускай файли по черзі за номером:
   - `001_init.sql`
   - `002_storage.sql`
   - `003_rls.sql`
   - `004_avatar_profile_sync.sql`
   - `005_realtime.sql`
   - `006_functions.sql`

## Правило

Кожен файл має бути максимально безпечним для повторного запуску:

- `create table if not exists`
- `alter table ... add column if not exists`
- `create or replace function`
- `drop trigger if exists` перед створенням trigger

Так легше переносити проєкт між середовищами і не ламати вже існуючу базу.
