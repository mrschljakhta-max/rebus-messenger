# rebus-messenger

REBUS Messenger — responsive web messenger for secure communication inside REBUS contours.

## Current stage

- Responsive start page
- Desktop and mobile background assets
- Minimal login entry button
- Ready for GitHub Pages


## v0.3.3
- Added custom navbar icons.
- Left navbar is compact by default and expands on hover/focus.


## v0.3.5
- Removed duplicated page headings from workspace pages.
- Kept left navigation labels as the primary section indicator.


## v0.3.6
- Центрування іконок у згорнутому лівому навбарі.
- Чат розтягнуто на всю доступну ширину: менший блок зліва, більший справа.

## v0.3.8
- Розтягнуто блоки сторінки чату майже на всю ширину робочої області.
- Зафіксовано центрування іконок у згорнутому лівому навбарі.


## v0.3.8

- Перероблено сторінку контурів: пошук, кнопка “Додати контур”, плашки-рядки списку.


## v0.4.1

- Google OAuth через Supabase Auth.
- Підключення до `messenger_messages`.
- Надсилання повідомлень у Supabase.
- Завантаження повідомлень по каналах.
- Realtime-підписка на нові повідомлення.


## v0.4.2
- Додано внутрішній екран Messenger 2FA після Google OAuth.
- OAuth redirect зафіксовано на поточний URL GitHub Pages.
- Підготовлено підтримку Supabase TOTP MFA; якщо фактор ще не налаштований, показується тимчасовий внутрішній gate для тестування UI.


## v0.4.6
- Fixed OAuth redirect so Messenger never falls back to rebus-secure.com/verify-2fa.html.
- Messenger 2FA now uses the same background styling as the login page.
- Fixed duplicated Supabase call in message loading.


## v0.4.6 — Message statuses

Додано відображення статусів повідомлень у чаті:

- `○ Відправляється` — локальне повідомлення ще записується в Supabase.
- `✓ Надіслано` — повідомлення успішно записане в `messenger_messages`.
- `✓✓ Отримано` — є запис у `message_receipts.received_at` від іншого користувача.
- `✓✓ Прочитано` — є запис у `message_receipts.read_at` від іншого користувача.

Перед повною роботою отримання/прочитання потрібно виконати SQL з файлу `supabase-message-receipts-v045.sql`.


## v0.4.8
- Fixed direct chat visibility for both users.
- Added SQL to sync rebus_profiles.user_id with auth.users.id by email.
- Direct messages now load by user_id/recipient_id pair, not only conversation_key.


## v0.4.9
- Fixed direct chat layout: message history now scrolls inside the chat panel.
- Chat and users panels no longer stretch when many messages are loaded.


## v0.5.0

- Прибрано верхній блок реципієнта з правої області чату.
- Додано tooltip для статусу «Прочитано» з часом прочитання повідомлення.
