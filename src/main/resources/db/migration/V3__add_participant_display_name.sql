-- display_name stores the Telegram user's name (first/last or username) captured from initData.
-- Guests keep using guest_name; this column is for telegram-linked participants.
ALTER TABLE participants ADD COLUMN display_name VARCHAR(100);
