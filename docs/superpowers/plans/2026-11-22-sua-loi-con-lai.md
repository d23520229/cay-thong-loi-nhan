# Sửa nốt lỗi còn lại sau rà soát — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa các lỗi còn lại của `docs/luong-hoat-dong.md` mục 9 (6, 7, 10, 11, 12) và xung đột giả khi lưu; ghi lỗi 13 là chấp nhận.

**Architecture:** Khoá PIN chuyển từ 3 cột trên `trees` sang `rate_counters` (theo phòng + IP, khung 15 phút; trần phòng theo ngày); migration 0003 bỏ 3 cột đó và 2 trigger `touch_updated_at`; helmet có CSP cho Google Identity; `/mine` trả mã lỗi nhất quán; web có cookie dự phòng cho `deviceId`, thông báo khoá theo giờ, và tự bỏ qua xung đột khi phòng server giống hệt phòng trên máy.

**Tech Stack:** Fastify 5 + @fastify/helmet + Drizzle + Vitest/PGlite; React 19 + zustand + Vitest/jsdom.

**Spec:** `docs/dac-ta-v3.md` — mục 6.5 (409 `version_conflict`), 7.3 (bảng `trees`, trigger), 7.4 (`updated_at`), 7.6 (`deviceId`), 8.4 (`/mine`), 10 (Chống dò PIN, CSP) — đã cập nhật 22/11.

## Global Constraints

- Nhánh `fix-luong-sau-m2`. **Không commit.** Việc lượt trước đã nằm trong index (staged); mỗi task chỉ sửa working tree, không `git add`.
- Không đụng `.gitignore`. Không sửa `0000_init.sql`/`0001`/`0002`; mọi đổi CSDL ở `apps/server/src/db/migrations/0003_pin_rate_counters.sql`.
- Giữ `docs/schema.postgres.sql` khớp (đã sửa phần cột/trigger; task migration kiểm lại).
- Giá trị: 5 lần / phòng + IP / khung 15 phút; 50 lần sai / phòng / khung ngày UTC; 20 lần sai / IP / giờ (giữ nguyên); bucket `pin:tree:{id}:ip:{ipHash}` và `pin:tree:{id}`; mã lỗi `429 pin_locked` kèm `retryAt` (ISO) = cuối khung đang khoá.
- CSP: chỉ cùng nguồn (`'self'`), thêm `https://accounts.google.com` cho `script-src`, `frame-src`, `connect-src`, `style-src`. Không thêm nguồn khác ngoài các nguồn helmet mặc định đã có.
- Cookie dự phòng: `ctln_did`, `max-age` 1 năm (31536000), `SameSite=Lax`, `path=/`.
- Không log IP hay nội dung; giữ `reqSerializer`.
- Xong mỗi task: test của gói đó qua hết; cuối cùng `pnpm test` + `pnpm typecheck` sạch. Tên test tiếng Việt.

## Review Focus

1. Nhiều lượt nhập PIN **song song** cùng IP → tối đa 5 lượt chạy scrypt (giữ chỗ nguyên tử trước khi băm) — Task 1.
2. IP A bị khoá → IP B vẫn đăng nhập PIN đúng được — Task 1.
3. Chủ cây nhập đúng PIN sau vài lần sai của chính mình → các lần sai đó không còn tính (không bị khoá sớm lần sau) — Task 1.
4. Phòng server giống hệt phòng trên máy nhưng **thứ tự món khác** → vẫn coi là giống (không hỏi) — Task 3.
5. localStorage ném lỗi ở cả đọc lẫn ghi → `deviceId` vẫn giữ nguyên qua lần "tải lại" (đọc từ cookie) — Task 3.

---

### Task 1: Server — khoá PIN theo phòng + IP bằng `rate_counters`; migration 0003

**Files:**
- Create: `apps/server/src/db/migrations/0003_pin_rate_counters.sql`
- Modify: `apps/server/src/security.ts` (`rateLimit`), `apps/server/src/routes/auth.ts` (route `/auth/pin`), `apps/server/src/db/schema.ts` (bỏ 3 cột)
- Modify nếu cần: `apps/server/src/routes/README.md`, `apps/server/src/db/README.md`
- Test: `apps/server/test/auth.test.ts`, `apps/server/test/migrate.test.ts` (danh sách migration), `apps/server/test/security.test.ts`

**Interfaces:**
- Produces: `rateLimit(db: Db, bucket: string, limit: number, at: Date, windowMs = 3_600_000): Promise<boolean>` — khung = `floor(at / windowMs) * windowMs`; các chỗ gọi cũ không đổi.
- Produces: hàm nội bộ trả lại một lượt đã giữ, ví dụ `refundRate(db, bucket, at, windowMs)` trong `security.ts` (giảm `hits` 1, không âm) — dùng thay cho đoạn trả lượt viết tay hiện có trong `auth.ts`.
- Migration 0003: `ALTER TABLE trees DROP COLUMN pin_failed_count, DROP COLUMN pin_locked_until, DROP COLUMN pin_last_failed_at;` `DROP TRIGGER trg_trees_touch ON trees; DROP TRIGGER trg_messages_touch ON messages; DROP FUNCTION touch_updated_at();`

- [ ] **Step 1: Test** trong `auth.test.ts` (sửa các test khoá hiện có cho khớp; giờ test mặc định 2026-12-01T10:00+07 = 03:00Z là đầu khung 15 phút):
  - `'sai 5 lần → lần 6 (đúng PIN) 429 pin_locked, retryAt = cuối khung 15 phút; sang khung sau đăng nhập được'`.
  - `'IP khác không bị khoá: IP A sai 5 lần, IP B nhập đúng → 204'` (dùng `app.inject({ ..., remoteAddress: '10.0.0.2' })`; kiểm lại rằng `clientIp` lấy được địa chỉ này).
  - `'10 lần sai song song cùng IP → tối đa 5 lần 401, còn lại 429 pin_locked'` (giữ test song song hiện có, đổi phần khẳng định theo cột cũ sang `rate_counters`).
  - `'đúng PIN xoá các lần sai trước của IP đó: sai 4, đúng, rồi sai 4 nữa vẫn 401 (không khoá)'`.
  - `'trần 50 lần sai / phòng / ngày trên mọi IP → 429 pin_locked cho cả IP mới, retryAt = đầu ngày UTC kế tiếp'` (chèn sẵn dòng `rate_counters` `{ bucket: 'pin:tree:' + id, windowStart: đầu ngày UTC, hits: 50 }` thay vì gửi 50 request).
  - Bỏ mọi khẳng định đọc `pinFailedCount` / `pinLockedUntil` / `pinLastFailedAt`.
  - `security.test.ts`: `'rateLimit với windowMs 15 phút: khung tính theo bội của 15 phút'`.
  - `migrate.test.ts`: danh sách file chạy có thêm `0003_pin_rate_counters.sql`.
- [ ] **Step 2:** `pnpm --filter @ctln/server exec vitest run test/auth.test.ts test/security.test.ts test/migrate.test.ts` → FAIL.
- [ ] **Step 3: Cài đặt** route `/auth/pin` theo thứ tự: cây tồn tại → body → `pin_not_set` → giữ lượt `pin:tree:{id}:ip:{ipH}` (5, 15 phút) — vượt thì trả lại lượt vừa giữ rồi `429 pin_locked` → giữ lượt `pin:tree:{id}` (50, 1 ngày) — vượt thì trả lại cả hai rồi `429 pin_locked` → `pinfail:ip:{ipH}` (20, 1 giờ, như cũ) — vượt thì trả lại hai lượt trên rồi `429 rate_limited` → scrypt → ghi `auth_attempts` → sai: `401 bad_pin` (giữ nguyên các lượt đã đếm); đúng: xoá dòng bucket phòng + IP của khung hiện tại, trả lại một lượt ở bucket ngày và ở `pinfail:ip`, đặt cookie, 204. `retryAt` = `windowStart + windowMs` của bucket bị vượt.
  - "Vượt thì trả lại lượt vừa giữ" để lượt bị từ chối không kéo dài khoá. Kiểm bằng test song song (Step 1).
  - Bỏ các truy vấn tới 3 cột cũ; bỏ `PIN_MAX_FAILS`/`PIN_LOCK_MS` nếu không còn dùng, thay bằng hằng có tên rõ.
- [ ] **Step 4:** Viết migration 0003; sửa `schema.ts` bỏ 3 cột; đối chiếu `docs/schema.postgres.sql` (phần bảng `trees` và trigger đã ghi "bỏ ở 0003").
- [ ] **Step 5:** `pnpm --filter @ctln/server test` → PASS hết (kể cả `schema.test.ts` — vẫn chạy trên 0000, 16 bảng); `pnpm --filter @ctln/server typecheck` sạch.

### Task 2: Server — `updated_at` không còn trigger; `/mine` nhất quán; CSP

**Files:**
- Modify: `apps/server/src/routes/messages.ts` (`GET /api/messages/:mid/mine`, `denyReason`)
- Modify: `apps/server/src/app.ts` (đăng ký helmet với `contentSecurityPolicy.directives`)
- Test: `apps/server/test/messages.test.ts`, `apps/server/test/room.test.ts` hoặc `owner.test.ts`, `apps/server/test/app.test.ts`

**Interfaces:**
- Consumes: migration 0003 (Task 1) đã bỏ trigger.

- [ ] **Step 1: Test**:
  - `'updated_at của cây chỉ đổi khi lưu phòng: PIN sai, ghé thăm (owner/visit) không đổi; lưu phòng đặt = giờ giả'`.
  - `'updated_at của lời nhắn chỉ đổi khi người viết sửa: chủ cây mở lời nhắn không đổi; sửa đặt = giờ giả'` (mở cần giai đoạn OPEN — dùng `clock.set` như các test owner có sẵn).
  - `'GET /mine: lời nhắn không tồn tại → 404 not_found; sai token → 403 bad_token'`.
  - `app.test.ts`: `'CSP chỉ cùng nguồn + accounts.google.com'` — header `content-security-policy` của `GET /api/config` có `default-src 'self'`, và `script-src`, `frame-src`, `connect-src`, `style-src` mỗi cái chứa `'self'` và `https://accounts.google.com`.
- [ ] **Step 2:** chạy các file test trên → FAIL đúng chỗ.
- [ ] **Step 3: Cài đặt**:
  - `/mine`: tìm lời nhắn theo `id`; không có → 404 `not_found` ("Không tìm thấy lời nhắn này."); so `editTokenHash` với `hmac(env, 'edit', token)` bằng `timingSafeEqual` (độ dài khác → không khớp) → sai 403 `bad_token`. `denyReason` dùng cùng cách so.
  - Helmet: `app.register(helmet, { contentSecurityPolicy: { directives: { ... } } })` — giữ mặc định của helmet cho các chỉ thị khác, chỉ ghi đè 4 chỉ thị trên (có `'self'`; `style-src` giữ cả `'unsafe-inline'` nếu mặc định helmet đang có — kiểm bằng test hiện có/console, đừng bớt).
- [ ] **Step 4:** `pnpm --filter @ctln/server test` → PASS; typecheck sạch.

### Task 3: Web — thông báo khoá theo giờ, cookie dự phòng `deviceId`, bỏ qua xung đột giả

**Files:**
- Modify: `apps/web/src/lib/authError.ts`, `apps/web/src/lib/storage.ts`, `apps/web/src/room/model.ts` (thêm `sameRoom`), `apps/web/src/room/autosave.ts` (`handleError`, `send`)
- Test: `apps/web/src/lib/authError.test.ts`, `apps/web/src/lib/storage.test.ts`, `apps/web/src/room/model.test.ts`, `apps/web/src/room/autosave.test.ts`

**Interfaces:**
- Produces: `sameRoom(a: Room, b: Room): boolean` trong `model.ts` — so `background`, mọi trường của `tree`, và `items` theo `clientId` (cùng tập mã, từng món cùng `type, variant, x, y, scale, flip`), bỏ qua thứ tự.

- [ ] **Step 1: Test**:
  - authError: `'pin_locked còn ≤ 60 phút → "thử lại sau N phút"; > 60 phút → "thử lại sau N giờ" (làm tròn lên)'` — câu đầy đủ: `Nhập sai quá nhiều lần, thử lại sau ${n} giờ`.
  - storage: `'localStorage ném lỗi → deviceId lấy/ghi cookie ctln_did, giữ nguyên sau khi nạp lại module'` (`vi.resetModules()` + import lại để mô phỏng tải lại; stub `localStorage.getItem/setItem` ném lỗi; kiểm `document.cookie` có `ctln_did=`). Và `'localStorage chạy bình thường → không ghi cookie'`.
  - model: `'sameRoom: khác thứ tự món vẫn giống; khác x / variant / slotCount / background → khác'`.
  - autosave:
    - `'409 version_conflict mà phòng server giống hệt phòng trên máy → không hỏi, nhận version mới, trạng thái saved'` (`onConflict` không gọi; `version()` = version server; `hasConflict()` false).
    - `'409 mà phòng server giống phòng vừa gửi nhưng trên máy đã sửa tiếp → nhận version, hẹn lưu tiếp, không hỏi'`.
    - Test xung đột thật có sẵn vẫn qua.
- [ ] **Step 2:** chạy các file test trên → FAIL.
- [ ] **Step 3: Cài đặt**:
  - `authError.ts`: dùng phút như cũ; > 60 thì đổi sang giờ.
  - `storage.ts` `deviceId()`: đọc localStorage → không có thì đọc cookie `ctln_did` → không có thì sinh mới; ghi localStorage rồi đọc lại; đọc lại không ra đúng mã thì ghi cookie `ctln_did=<id>; max-age=31536000; path=/; samesite=lax`. Mã đọc từ cookie phải đúng dạng UUID mới dùng.
  - `autosave.ts`: trong `send` nhớ phòng đang gửi; `handleError` với 409 `version_conflict`: `server = err.extra.room`; nếu `sameRoom(server, store.getState().room)` → `version = server.roomVersion; lastSaved = store.getState().room; o.onState('saved')`, không đặt `conflict`; nếu không mà `sameRoom(server, roomĐãGửi)` → `version = server.roomVersion; lastSaved = roomĐãGửi; schedule()`; còn lại như cũ (đặt `conflict`, `onConflict`).
- [ ] **Step 4:** `pnpm --filter @ctln/web test` → PASS hết; `pnpm --filter @ctln/web typecheck` sạch.

### Task 4: Tài liệu và kiểm cuối

**Files:** `docs/tien-do.md`, `docs/luong-hoat-dong.md`, `apps/server/src/routes/README.md` (nếu có mô tả khoá PIN)

- [ ] **Step 1:** `docs/tien-do.md`:
  - Mục "Việc nhỏ còn lại sau rà soát 22/11": đánh dấu đã sửa các dòng PIN, CSP, `updated_at`, `deviceId`, `/mine`, `pagehide` khi đang lưu. Dòng "cây mồ côi" ghi "chấp nhận (chủ dự án chốt 22/11)".
  - Dòng M3b ở "Việc nhỏ còn lại từ các lượt duyệt M1" ("nút mở khoá PIN phải xoá cả `pin_last_failed_at`") đổi thành "xoá các bucket `pin:tree:{id}…` trong `rate_counters`".
  - Bài học kỹ thuật: thêm "Trigger `BEFORE UPDATE` đặt `updated_at := now()` ghi đè giá trị code đặt và không theo `FAKE_NOW` — đã bỏ ở 0003".
  - Nhật ký 22/11: thêm câu tóm tắt lượt 2; cập nhật số test ở "Hiện tại".
- [ ] **Step 2:** `docs/luong-hoat-dong.md`:
  - Bảng route: dòng `/auth/pin` theo cách khoá mới; dòng `/mine` (404/403).
  - Mục 9: đánh dấu "✅ đã sửa 22/11" cho 6, 7, 10, 11, 12; 13 ghi "chấp nhận".
  - Ghi chú "Cập nhật 22/11" thêm số test mới.
- [ ] **Step 3:** `pnpm test` (shared, server, web) PASS; `pnpm typecheck` sạch. Chạy `pnpm --filter @ctln/server db:migrate` **không** cần (không có Postgres); migration được test qua PGlite.
- [ ] **Step 4:** `git status --short` để báo cáo; không commit.
