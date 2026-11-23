-- Lời nhắn 400 ký tự + ảnh kèm (đặc tả 6.7)
ALTER TABLE messages DROP CONSTRAINT messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_check CHECK (char_length(content) BETWEEN 1 AND 400);
ALTER TABLE messages ADD COLUMN photo_key text;
ALTER TABLE reports ADD COLUMN photo_snapshot_key text;
