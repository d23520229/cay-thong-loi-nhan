-- Trang quản trị M3b (đặc tả 6.8.3): dung lượng ảnh + đếm lỗi 5xx theo giờ
ALTER TABLE messages ADD COLUMN photo_bytes integer;

CREATE TABLE error_counts (
  hour        timestamptz PRIMARY KEY,   -- đầu giờ
  count       integer NOT NULL DEFAULT 0,
  last_at     timestamptz NOT NULL,
  last_route  text,                      -- mẫu route, không có giá trị tham số
  last_status smallint NOT NULL
);
