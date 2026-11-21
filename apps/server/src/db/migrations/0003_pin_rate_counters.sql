-- Khoá PIN chuyển sang rate_counters (phòng + IP, 15 phút; phòng, ngày) — bỏ 3 cột đếm cũ.
ALTER TABLE trees DROP COLUMN pin_failed_count, DROP COLUMN pin_locked_until, DROP COLUMN pin_last_failed_at;
-- Trigger chạm updated_at ở mọi UPDATE (kể cả giờ ghé thăm) và không theo FAKE_NOW; code tự đặt updated_at.
DROP TRIGGER trg_trees_touch ON trees;
DROP TRIGGER trg_messages_touch ON messages;
DROP FUNCTION touch_updated_at();
