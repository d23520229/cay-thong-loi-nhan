-- Cây Thông Lời Nhắn — lược đồ PostgreSQL 16
-- Thời gian: timestamptz (UTC). Mã bí mật chỉ lưu dạng băm. Không lưu IP thô.

-- ===== Người dùng =====

CREATE TABLE owner_accounts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  google_sub    text NOT NULL UNIQUE,              -- mã người dùng Google ("sub"); không lưu email
  display_name  text CHECK (display_name IS NULL OR char_length(display_name) <= 60),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE trees (
  id                  text PRIMARY KEY CHECK (id ~ '^[a-z2-9]{8}$'),  -- 8 ký tự base32 bỏ ký tự dễ nhầm
  owner_account_id    bigint REFERENCES owner_accounts(id) ON DELETE SET NULL,
  owner_name          text NOT NULL CHECK (char_length(owner_name) BETWEEN 1 AND 30),
  title               text CHECK (title IS NULL OR char_length(title) <= 40),

  -- xác thực chủ cây
  private_key_hash    text NOT NULL,                                  -- HMAC khoá trong link riêng
  pin_hash            text,                                           -- scrypt(PIN 6 số); NULL nếu chỉ dùng Google
  -- pin_failed_count, pin_locked_until, pin_last_failed_at: bỏ ở migration 0003 (khoá PIN dùng rate_counters)

  -- phòng và cấu hình cây
  background          text NOT NULL DEFAULT 'night',
  tree_shape          text NOT NULL DEFAULT 'cloud3' CHECK (tree_shape IN ('cloud3','cloud4','puffy','snowy')),
  tree_palette        text NOT NULL DEFAULT 'teal'   CHECK (tree_palette IN ('teal','green','pine','pink','lavender','frost')),
  trunk_shape         text NOT NULL DEFAULT 'straight' CHECK (trunk_shape IN ('straight','flared','stout')),
  trunk_wood          text NOT NULL DEFAULT 'oak'    CHECK (trunk_wood IN ('oak','walnut','cedar','birch')),
  slot_count          smallint NOT NULL DEFAULT 12   CHECK (slot_count IN (6,9,12,16,20,25,30)),

  room_version        integer NOT NULL DEFAULT 1,                     -- chống ghi đè khi sửa trên 2 thiết bị
  catalog_version     integer NOT NULL DEFAULT 1,
  ref_tree_id         text REFERENCES trees(id) ON DELETE SET NULL,   -- phòng tạo ra từ lời mời của phòng nào
  creator_ip_hash     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  last_owner_visit_at timestamptz,
  show_message_count  boolean NOT NULL DEFAULT true,               -- thêm ở migration 0001

  CONSTRAINT trees_has_recovery CHECK (pin_hash IS NOT NULL OR owner_account_id IS NOT NULL)
);
CREATE INDEX idx_trees_owner   ON trees(owner_account_id);
CREATE INDEX idx_trees_ref     ON trees(ref_tree_id);
CREATE INDEX idx_trees_created ON trees(created_at);

CREATE TABLE room_items (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tree_id     text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  client_id   text NOT NULL CHECK (char_length(client_id) BETWEEN 1 AND 24),  -- mã do trình duyệt sinh
  item_type   text NOT NULL CHECK (item_type IN ('tree','window','fireplace','rug','stack','gift','pet')),
  variant     text NOT NULL CHECK (char_length(variant) BETWEEN 1 AND 24), -- kiểm tra theo catalog ở tầng ứng dụng
  x           double precision NOT NULL CHECK (x BETWEEN 0 AND 720),        -- điểm neo trong khung 720x1080
  y           double precision NOT NULL CHECK (y BETWEEN 0 AND 1080),
  scale       real NOT NULL DEFAULT 1 CHECK (scale BETWEEN 0.5 AND 1.6),
  flip        boolean NOT NULL DEFAULT false,
  UNIQUE (tree_id, client_id)
);
CREATE INDEX idx_items_tree ON room_items(tree_id);
CREATE UNIQUE INDEX uq_one_tree_per_room ON room_items(tree_id) WHERE item_type = 'tree';

CREATE TABLE owner_sessions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tree_id      text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,                                  -- HMAC token trong cookie HttpOnly
  method       text NOT NULL CHECK (method IN ('create','link','pin','google')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);
CREATE INDEX idx_sessions_tree ON owner_sessions(tree_id);

CREATE TABLE messages (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tree_id         text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  slot_index      smallint NOT NULL CHECK (slot_index BETWEEN 0 AND 29),
  ornament        text NOT NULL CHECK (ornament IN ('sock','star','bulb','ball','candy','bell','gingerbread','heart',
                    'snowflake','mitten','minigift','pinecone','bow','snowman','moon','lantern','stripeball','cookie','reindeer','cocoa')),
  is_anonymous    boolean NOT NULL DEFAULT false,
  author_name     text CHECK (author_name IS NULL OR char_length(author_name) BETWEEN 1 AND 30),
  content         text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 400),
  edit_token_hash text NOT NULL,                                      -- HMAC token sửa lưu trên thiết bị người viết
  edit_until      timestamptz NOT NULL,                               -- created_at + 15 phút, không kéo dài khi sửa
  device_hash     text NOT NULL,
  ip_hash         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  photo_key       text,                                               -- ảnh kèm (migration 0004), NULL nếu không có
  photo_bytes     integer,                                            -- số byte ảnh đã lưu (migration 0005)
  read_at         timestamptz,                                        -- NULL = chưa mở
  UNIQUE (tree_id, slot_index),
  CONSTRAINT messages_anon_name CHECK ((is_anonymous AND author_name IS NULL) OR (NOT is_anonymous AND author_name IS NOT NULL))
);
CREATE INDEX idx_messages_tree_device ON messages(tree_id, device_hash);

CREATE TABLE blocked_devices (
  tree_id     text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  device_hash text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tree_id, device_hash)
);

CREATE TABLE auth_attempts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tree_id    text REFERENCES trees(id) ON DELETE CASCADE,
  ip_hash    text NOT NULL,
  method     text NOT NULL CHECK (method IN ('pin','link','google','admin')),
  success    boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_auth_ip_time   ON auth_attempts(ip_hash, created_at);
CREATE INDEX idx_auth_tree_time ON auth_attempts(tree_id, created_at);

-- Giới hạn tần suất dùng chung giữa nhiều instance (thay cho bộ nhớ trong tiến trình)
CREATE TABLE rate_counters (
  bucket      text NOT NULL,              -- vd 'create:ip:<hash>', 'msg:ip:<hash>', 'save:tree:<id>'
  window_start timestamptz NOT NULL,      -- đầu khung giờ
  hits        integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

-- ===== Quản trị =====

CREATE TABLE admin_users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  google_sub    text UNIQUE,
  email         text NOT NULL,
  role          text NOT NULL DEFAULT 'moderator' CHECK (role IN ('admin','moderator')),
  disabled      boolean NOT NULL DEFAULT false,
  created_by    bigint REFERENCES admin_users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX uq_admin_email ON admin_users (lower(email));

CREATE TABLE admin_sessions (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id   bigint NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,                                    -- 12 giờ
  revoked_at timestamptz
);

CREATE TABLE reports (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tree_id          text NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  message_id       bigint,                                            -- NULL nếu báo cáo cả phòng
  message_snapshot text,                                              -- chép nội dung lúc báo cáo
  photo_snapshot_key text,                                            -- chép khoá ảnh kèm lúc báo cáo (migration 0004)
  reason           text CHECK (reason IS NULL OR char_length(reason) <= 200),
  reporter         text NOT NULL CHECK (reporter IN ('owner','guest')),
  reporter_hash    text,
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution       text CHECK (resolution IS NULL OR resolution IN ('message_deleted','tree_deleted','device_blocked','no_action')),
  handled_by       bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  handled_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reports_open ON reports(created_at) WHERE status = 'open';

CREATE TABLE admin_audit (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id    bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text CHECK (target_type IN ('tree','message','report','block','word','setting','admin','system')),
  target_id   text,
  note        text CHECK (note IS NULL OR char_length(note) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_time ON admin_audit(created_at);

CREATE TABLE global_blocks (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       text NOT NULL CHECK (kind IN ('device','ip')),
  value_hash text NOT NULL,
  reason     text CHECK (reason IS NULL OR char_length(reason) <= 200),
  created_by bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (kind, value_hash)
);

CREATE TABLE banned_words (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  word       text NOT NULL UNIQUE CHECK (char_length(word) BETWEEN 1 AND 40),  -- chữ thường, bỏ dấu
  action     text NOT NULL DEFAULT 'mask' CHECK (action IN ('mask','reject')),
  created_by bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE site_settings (
  key        text PRIMARY KEY CHECK (key IN ('banner_text','banner_enabled','pause_create','pause_messages')),
  value      text NOT NULL,
  updated_by bigint REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Đếm lỗi 5xx theo giờ cho Tổng quan quản trị (migration 0005, đặc tả 6.8.3)
CREATE TABLE error_counts (
  hour        timestamptz PRIMARY KEY,   -- đầu giờ
  count       integer NOT NULL DEFAULT 0,
  last_at     timestamptz NOT NULL,
  last_route  text,                      -- mẫu route, không có giá trị tham số
  last_status smallint NOT NULL
);

-- ===== Thống kê =====

CREATE TABLE events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type       text NOT NULL CHECK (type IN ('tree_created','room_saved','tree_viewed_guest','tree_zoomed',
               'compose_opened','message_created','message_edited','message_deleted_by_author',
               'message_opened','cta_clicked','image_downloaded')),
  tree_id    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_type_time ON events(type, created_at);

-- Tự cập nhật updated_at — BỎ ở migration 0003 (chạm updated_at ở mọi UPDATE); giữ để đối chiếu 0000
-- CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
-- BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
-- CREATE TRIGGER trg_trees_touch    BEFORE UPDATE ON trees    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
-- CREATE TRIGGER trg_messages_touch BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
