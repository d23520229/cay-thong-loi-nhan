# M3b — Trang quản trị + Google cho chủ cây — Kế hoạch làm

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ dự án đăng nhập `/quan-tri` bằng Google để xem tình hình dịch vụ (người dùng + máy chủ), xử lý báo cáo, tra cứu / hỗ trợ phòng, xem nhật ký; chủ cây dùng được nút Google thật; có email hỗ trợ.

**Architecture:** Server thêm nhóm route `/api/admin/*` (phiên riêng `ctln_admin`, CSRF suy ra từ phiên, mọi thao tác ghi `admin_audit` trong cùng giao dịch), hook đếm lỗi 5xx vào bảng `error_counts` và đo p95 trong bộ nhớ. Web thêm route lazy `/quan-tri/*` trỏ vào `apps/web/src/admin/` (gói JS riêng), và component `GoogleButton` dùng chung cho chủ cây và quản trị.

**Tech Stack:** Fastify 5 + Drizzle + PostgreSQL 16 (test: Vitest + PGlite), React 19 + React Router 7 + Vite, Google Identity Services, `google-auth-library` (đã có).

**Spec:** `docs/dac-ta-v3.md` mục **6.8** (đã duyệt 24/11); tham chiếu 3.7, 8.7, 10.

## Trạng thái (cập nhật 24/11/2026)

**Đã xong cả 13 task** (24/11) trên nhánh `m3b`: 247 test server, 460 test web, typecheck sạch, gói quản trị tách riêng. Còn: duyệt cả nhánh, chủ dự án thử tay (danh sách ở `docs/tien-do.md`), PR vào `main`.

Sổ tiến độ chi tiết (bị git bỏ qua, chỉ có trên máy này): `.superpowers/sdd/2026-11-24-m3b-quan-tri-google/progress.md`.

**Quyết định khi làm (lệch nhẹ so với kế hoạch):**
- Task 7: thêm `apps/web/src/admin/context.ts` (AdminContext); số báo cáo chờ trên thanh bên lấy từ `overview()`.
- Task 10: sau mỗi hành động ở Tra cứu phòng, ô ghi chú được xoá (mỗi hành động một ghi chú).
- Task 11: email hỗ trợ ở trang phòng chỉ hiện khi "Không mở được cây này." (không hiện khi 404).
- Task 2: bỏ 2 kiểm tra cũ "nút Google sắp có bị khoá" (`ReopenDialog.test`, `RoomPage.test`) vì nút đã làm thật.
- Task 4: `schema.test.ts` vẫn 16 bảng (test này chỉ chạy `0000_init.sql`); `migrate.test.ts`, `room.test.ts` cập nhật 17 bảng / thêm `0005`.
- Task 4: số lỗi 24 giờ đếm theo ô giờ từ giờ chứa (now − 24h), có thể dư tối đa 1 giờ.
- Task 5: ghi chú khi xử lý báo cáo giới hạn 1–450 ký tự (không phải 500), vì nhật ký thêm tiền tố (`delete_message: `, `báo cáo #id: `) mà cột `admin_audit.note` ≤ 500.
- Task 5: `deleteTreeWithPhotos(app, req, treeId, inTx?)` ở `apps/server/src/trees/delete.ts` gọi `inTx` ngay sau khi khoá dòng cây, trước khi xoá; `inTx` ném lỗi thì huỷ cả giao dịch.

**Cho Task 7–10 (web) — API đã có, đúng kiểu như Interfaces Task 3–6:** `POST /api/admin/auth/google` → `{ email, csrfToken }`; `GET /api/admin/me`; `POST /api/admin/auth/logout`; `GET /api/admin/overview`; `GET /api/admin/reports?status=open|handled` → `{ items: AdminReport[] }`; `GET /api/admin/reports/:rid/photo`; `POST /api/admin/reports/:rid/resolve { action, note }` (note 1–450); `GET /api/admin/trees/:id`; `POST …/unlock-pin { note? }` → 204; `POST …/revoke-sessions { note? }` → `{ revoked }`; `DELETE /api/admin/trees/:id { note }` → 204; `GET /api/admin/audit?before=` → `{ items, nextBefore }`. Lệnh ghi cần header `x-csrf-token`. Mã lỗi: `admin_required` (401), `csrf` (403), `not_admin` (403), `already_handled` / `message_gone` (409), `no_message` (400). Web đã có `useConfig()` (`apps/web/src/lib/config.ts`) và `GoogleButton` (`apps/web/src/ui/GoogleButton.tsx`).

## Global Constraints

- Không thêm thư viện mới (server và web).
- Mọi chữ hiển thị bằng tiếng Việt; thông báo lỗi server theo dạng `{ error: { code, message } }` như hiện có.
- API quản trị **không bao giờ** trả nội dung lời nhắn / ảnh ngoài `reports.message_snapshot` và ảnh `photo_snapshot_key`.
- Mọi thao tác quản trị thay đổi dữ liệu ghi `admin_audit` **trong cùng giao dịch**.
- Cookie `ctln_admin`: HttpOnly, SameSite=Strict, `Path=/api/admin`, Secure khi `production`, hết hạn 12 giờ.
- Giai đoạn chỉ đọc qua `phase.ts` / `phaseOf(app)`; không so ngày trực tiếp.
- Đổi CSDL chỉ bằng migration mới `0005_admin_metrics.sql`; giữ `docs/schema.postgres.sql` và đặc tả 7.3 khớp.
- Gói JS chính của web ≤ 250 KB gzip và không chứa mã `apps/web/src/admin/`.
- Lệnh kiểm: `pnpm --filter @ctln/server test`, `pnpm --filter @ctln/web test`, `pnpm typecheck`, cuối cùng `pnpm test`.

## Review Focus

1. Trình duyệt gửi cả cookie chủ cây (`Path=/`) tới `/api/admin/*` — guard quản trị phải bỏ qua nó (test ở Task 3).
2. Dán **link riêng** (`…/c/{id}#k=…`) vào ô tra cứu — phần `#k=` không bao giờ lên server (test ở Task 10).
3. Phiên quản trị hết hạn khi đang dùng → mọi trang về màn đăng nhập, không lặp gọi API (test ở Task 7).
4. Báo cáo mà lời nhắn đã bị chủ cây xoá → `delete_message` trả 409 `message_gone`, web khoá nút đó (test ở Task 5, Task 9).
5. Hai tab cùng xử lý một báo cáo → tab sau 409 `already_handled`, không ghi audit lần hai (test ở Task 5).

---

### Task 0: Nhánh và tài liệu thiết kế

- [x] **Step 1:** `git switch -c m3b` từ `main`.
- [x] **Step 2:** Commit thay đổi tài liệu đang có:
```bash
git add docs/dac-ta-v3.md docs/tien-do.md docs/superpowers/plans/2026-11-24-m3b-quan-tri-google.md
git commit -m "docs: thiết kế M3b (đặc tả 6.8) + kế hoạch"
```

### Task 1: Env, config, Google trả email

**Files:**
- Modify: `apps/server/src/env.ts`, `apps/server/src/app.ts` (type `GoogleVerifier`), `apps/server/src/google.ts`, `apps/server/src/routes/config.ts`, `apps/server/test/helpers.ts`, `.env.example`
- Test: `apps/server/test/app.test.ts` (config), `apps/server/test/security.test.ts` hoặc file env test hiện có

**Interfaces — Produces:**
- `Env` thêm: `adminBootstrapEmail?: string` (`ADMIN_BOOTSTRAP_EMAIL`, lưu chữ thường, bỏ khoảng trắng), `supportEmail?: string` (`SUPPORT_EMAIL`), `dbQuotaBytes: number` (`DB_QUOTA_GB`, mặc định 32 → `32 * 1024**3`; không phải số dương → throw), `adminAzureUrl?: string` (`ADMIN_AZURE_URL`).
- `GoogleVerifier = (idToken) => Promise<{ sub: string; name?: string; email?: string; emailVerified?: boolean }>`.
- `FakeGoogle` trong test: `ok:SUB` → `{ sub }`; `ok:SUB:EMAIL` → `{ sub, email, emailVerified: true }`; `unverified:SUB:EMAIL` → `{ sub, email, emailVerified: false }`; khác → throw.
- `GET /api/config` thêm `supportEmail: string | null`.

- [x] **Step 1:** Test: `loadEnv({ DB_QUOTA_GB: '10' }).dbQuotaBytes === 10 * 1024 ** 3`; mặc định = `32 * 1024 ** 3`; `DB_QUOTA_GB: 'abc'` → throw; `ADMIN_BOOTSTRAP_EMAIL: ' A@B.com '` → `'a@b.com'`. Test `/api/config` trả `supportEmail` khi đặt env và `null` khi không.
- [x] **Step 2:** Chạy `pnpm --filter @ctln/server test -- app` → FAIL.
- [x] **Step 3:** Làm: các trường env; `google.ts` trả thêm `email: p.email`, `emailVerified: p.email_verified === true` khi có; config trả `supportEmail`; `.env.example` thêm `SUPPORT_EMAIL=`, `DB_QUOTA_GB=32`, `ADMIN_AZURE_URL=` có chú thích; cập nhật `FakeGoogle`.
- [x] **Step 4:** Chạy lại test server → PASS (toàn bộ, vì `FakeGoogle` đổi).
- [x] **Step 5:** Commit `feat(server): env quản trị, supportEmail trong config, Google trả email`.

### Task 2: GoogleButton + Google cho chủ cây (web)

**Files:**
- Create: `apps/web/src/lib/config.ts`, `apps/web/src/ui/GoogleButton.tsx`, `apps/web/src/ui/GoogleButton.test.tsx`, `apps/web/src/lib/gis.ts`
- Modify: `apps/web/src/lib/api.ts` (`AppConfig.supportEmail`), `apps/web/src/routes/CreatePage.tsx`, `apps/web/src/routes/ReopenDialog.tsx`, `apps/web/src/routes/OwnerLogin.tsx`, `apps/web/src/lib/authError.ts`
- Test: `CreatePage.test.tsx`, `ReopenDialog.test.tsx`, thêm `OwnerLogin.test.tsx`

**Interfaces — Produces:**
- `useConfig(): AppConfig | null` trong `lib/config.ts` — gọi `api.getConfig()` một lần cho cả app (cache promise cấp module), trả `null` khi đang tải hoặc lỗi. Có `resetConfigForTest()`.
- `loadGis(): Promise<void>` trong `lib/gis.ts` — chèn `<script src="https://accounts.google.com/gsi/client" async>` một lần, resolve khi `window.google?.accounts?.id` có.
- `<GoogleButton onToken={(idToken: string) => void} text?: 'signin_with' | 'continue_with' />` — `clientId` lấy từ `useConfig()`; `googleClientId === null` → `<Button disabled>` chữ "Đăng nhập Google tạm thời chưa dùng được"; có thì `loadGis()` rồi `google.accounts.id.initialize({ client_id, callback: (r) => onToken(r.credential) })` + `renderButton(div, { theme: 'outline', size: 'large', text })`.
- `googleName(idToken: string): string | null` (giải mã phần payload base64url, lấy `name`) — đặt trong `lib/gis.ts`.
- `authErrorMessage` thêm: `not_owner` → "Tài khoản này không phải chủ cây.", `google_invalid` → "Đăng nhập Google chưa thành công, thử lại nhé.", `google_unavailable` → giữ message server.

- [x] **Step 1:** Test `GoogleButton`: config `googleClientId: null` → nút bị khoá với chữ trên; có clientId và `window.google` giả → gọi `initialize` với `client_id` đúng, gọi callback giả `{ credential: 'tok' }` → `onToken('tok')`.
- [x] **Step 2:** Test màn (mock `GoogleButton` thành nút bấm trả `'tok'`):
  - `CreatePage`: chọn chip "Google" → hiện `GoogleButton`, ẩn `PinInput`; sau token hiện "Đã chọn Google: {tên}" và `createTree` được gọi với `recovery: { type: 'google', idToken: 'tok' }`; lỗi 400 `google_invalid` → hiện lỗi và hiện lại nút Google.
  - `ReopenDialog`: `authGoogle` trả `{ trees: [] }` → "Tài khoản Google này chưa có cây nào"; `{ trees: [{ id: 'abc12345', title: null }] }` → gọi `authGoogle('tok', 'abc12345')` rồi điều hướng `/c/abc12345` và `storage.addMyTree`; 2 cây → hiện 2 chip, bấm một chip → `authGoogle('tok', id)` → điều hướng.
  - `OwnerLogin`: token → `authGoogle('tok', treeId)` → `onSuccess`; 403 `not_owner` → "Tài khoản này không phải chủ cây."
- [x] **Step 3:** Chạy `pnpm --filter @ctln/web test` → FAIL.
- [x] **Step 4:** Làm theo Interfaces; thay ba nút "sắp có". Trang xong của `/tao` khi chọn Google đổi gợi ý thành "Mở cây trên máy khác bằng Google hoặc link riêng".
- [x] **Step 5:** Chạy test web → PASS; `pnpm typecheck` sạch.
- [x] **Step 6:** Commit `feat(web): nút Google thật cho chủ cây (tạo cây, mở lại, chào chủ cây)`.

### Task 3: Đăng nhập quản trị, phiên, CSRF, audit

**Files:**
- Create: `apps/server/src/admin/session.ts`, `apps/server/src/admin/audit.ts`, `apps/server/src/admin/bootstrap.ts`, `apps/server/src/routes/admin/index.ts`, `apps/server/src/routes/admin/auth.ts`
- Modify: `apps/server/src/security.ts` (`HmacPurpose` thêm `'admin' | 'csrf'`), `apps/server/src/app.ts`, `apps/server/test/helpers.ts`
- Test: `apps/server/test/admin-auth.test.ts`

**Interfaces — Produces:**
- `ensureBootstrapAdmin(db: Db, email?: string): Promise<void>` — chèn `admin_users { email, role: 'admin' }` nếu chưa có dòng `lower(email)`; gọi trong `buildApp` trước khi đăng ký route.
- `requireAdmin(app, req): Promise<{ adminId: number; email: string; token: string }>` — đọc cookie `ctln_admin`, so `admin_sessions.token_hash = hmac(env,'admin',token)`, chưa thu hồi, `expires_at > now`, admin không `disabled`; sai → 401 `admin_required`. Với method khác GET/HEAD: header `x-csrf-token` phải bằng `csrfFor(env, token)`, sai → 403 `csrf`.
- `csrfFor(env: Env, token: string): string` = `hmac(env, 'csrf', token)`.
- `setAdminCookie(app, reply, adminId): Promise<{ token: string }>` — `randomToken(32)`, hết hạn `now + 12h`.
- `audit(tx, adminId: number, action: AuditAction, targetType: AuditTarget | null, targetId: string | null, note?: string | null): Promise<void>`; `AuditAction = 'login' | 'logout' | 'report_resolve' | 'tree_delete' | 'sessions_revoke' | 'pin_unlock'`; `AuditTarget = 'tree' | 'message' | 'report' | 'admin'`.
- `adminRoutes(app)` đăng ký các file `routes/admin/*`.
- Route: `POST /api/admin/auth/google { idToken }` → 200 `{ email, csrfToken }` + cookie; `GET /api/admin/me` → `{ email, csrfToken }`; `POST /api/admin/auth/logout` → 204, thu hồi phiên, xoá cookie.
- `makeTestApp` nhận `env.ADMIN_BOOTSTRAP_EMAIL`; thêm helper test `adminLogin(app): Promise<{ cookie: string; csrf: string }>` dùng token `ok:admin-sub:admin@test.vn`.
- Hook trong `app.ts`: `onRequest` bỏ qua 410 khi path bắt đầu `/api/admin/`; `onSend` đặt `X-Robots-Tag: noindex` cho path bắt đầu `/api/admin` hoặc `/quan-tri`.

- [x] **Step 1:** Test (`admin-auth.test.ts`, bootstrap `admin@test.vn`):
  - đăng nhập đúng → 200, có `set-cookie` `ctln_admin` chứa `Path=/api/admin`, `HttpOnly`, `SameSite=Strict`; `admin_users.google_sub` = `admin-sub`; có dòng audit `login`.
  - email lạ / `unverified:` / admin `disabled` / cùng email nhưng sub khác sau lần đầu → 403 `not_admin`; token hỏng → 400 `google_invalid`; `google: null` → 503.
  - lần sai thứ 11 trong giờ từ cùng IP → 429 `rate_limited`.
  - bootstrap chạy 2 lần (hai `buildApp`) → đúng 1 dòng.
  - `me` không cookie → 401; sau `clock.set(+12h 1s)` → 401.
  - cookie chủ cây hợp lệ (tạo cây qua `POST /api/trees`) gửi tới `/api/admin/me` → 401.
  - cookie quản trị gửi tới `GET /api/trees/:id/owner` → 401.
  - `POST /api/admin/auth/logout` thiếu `x-csrf-token` → 403 `csrf`; đúng → 204, sau đó `me` → 401, audit có `logout`.
  - `clock.set('2027-01-02T00:00:00+07:00')`: `/api/admin/me` → 200, `/api/trees/x` → 410.
  - phản hồi `/api/admin/me` có `x-robots-tag: noindex`.
- [x] **Step 2:** Chạy `pnpm --filter @ctln/server test -- admin-auth` → FAIL.
- [x] **Step 3:** Làm theo Interfaces. Giới hạn đăng nhập: bucket `admin-login:ip:{ipHash}`, `rateLimit(..., 10, at)` **chỉ khi thất bại** (dùng `refundRate` khi thành công, như PIN).
- [x] **Step 4:** Chạy test server → PASS.
- [x] **Step 5:** Commit `feat(server): đăng nhập quản trị Google, phiên 12 giờ, CSRF, nhật ký`.

### Task 4: Migration 0005, đếm lỗi, p95, photo_bytes, Tổng quan

**Files:**
- Create: `apps/server/src/db/migrations/0005_admin_metrics.sql`, `apps/server/src/metrics.ts`, `apps/server/src/routes/admin/overview.ts`
- Modify: `apps/server/src/db/schema.ts` (`messages.photoBytes`, bảng `errorCounts`), `apps/server/src/routes/messages.ts` (ghi `photoBytes` ở 2 chỗ `photos.put`; gỡ ảnh → `photoBytes: null`), `apps/server/src/app.ts` (hook `onResponse`), `docs/schema.postgres.sql`, `docs/dac-ta-v3.md` 7.3 (17 bảng)
- Test: `apps/server/test/admin-overview.test.ts`, `apps/server/test/metrics.test.ts`, bổ sung `messages.test.ts`, `migrate.test.ts`

**Interfaces — Produces:**
- SQL đúng như đặc tả 6.8.3 (`error_counts`) + `ALTER TABLE messages ADD COLUMN photo_bytes integer;`.
- `class LatencyTracker { record(ms: number, at: Date): void; p95(at: Date): { p95Ms: number | null; since: Date } }` — 60 ô theo phút, bỏ ô cũ hơn 60 phút; `since` = max(lúc tạo tracker, at − 60 phút). Gắn `app.decorate('latency', new LatencyTracker(now))`.
- `recordError(db: Db, at: Date, route: string | null, status: number): Promise<void>` — upsert theo `hour = date_trunc giờ UTC`, `count + 1`, ghi `last_*`. Hook `onResponse`: `/api/*` → `latency.record(reply.elapsedTime)`; `statusCode >= 500` → `recordError(..., req.routeOptions.url ?? null, ...)`, lỗi của chính nó chỉ `req.log.warn`.
- `GET /api/admin/overview` → `Overview`:
```ts
type Count = { total: number; last24h: number };
type Overview = {
  now: string; phase: Phase;
  next: { key: 'unlockAt' | 'writeClosesAt' | 'serviceEndsAt' | 'purgeAt'; at: string } | null;
  users: { trees: Count; messages: Count; views: Count; openReports: number; viral: number | null };
  server: {
    errors24h: number; lastError: { at: string; route: string | null; status: number } | null;
    p95Ms: number | null; latencySince: string;
    dbBytes: number; dbQuotaBytes: number;
    photos: { count: number; bytes: number; unknown: number; reportSnapshots: number };
    azureUrl: string | null;
  };
};
```
  `views` = `events.type = 'tree_viewed_guest'`; `viral` = phòng có `ref_tree_id` / tổng phòng (0 phòng → `null`); `dbBytes` = `pg_database_size(current_database())`.

- [x] **Step 1:** Test `metrics.test.ts`: 100 lần `record(i)` (i = 1..100) → `p95Ms === 95`; bản ghi 61 phút trước bị bỏ; chưa có gì → `null`.
- [x] **Step 2:** Test overview: seed 3 cây (1 có `refTreeId`, 1 tạo 2 ngày trước), 2 lời nhắn, 1 event view, 1 báo cáo open → số đúng, `viral ≈ 1/3`; route test ném lỗi (đăng ký tạm route `/api/__boom` trong test) → `errors24h === 1`, `lastError.route === '/api/__boom'`, `status === 500`; `dbBytes > 0`; `dbQuotaBytes` theo env; treo lời nhắn kèm ảnh → `photos.count 1`, `bytes` = kích thước Blob trong `memoryStore`; sửa gỡ ảnh → `photo_bytes` null; không có phiên quản trị → 401.
- [x] **Step 3:** Chạy → FAIL.
- [x] **Step 4:** Làm theo Interfaces; cập nhật `docs/schema.postgres.sql`, đặc tả 7.3.
- [x] **Step 5:** Chạy test server → PASS (gồm `migrate.test.ts`, `schema.test.ts`).
- [x] **Step 6:** Commit `feat(server): tổng quan quản trị, đếm lỗi 5xx, p95, photo_bytes (migration 0005)`.

### Task 5: Báo cáo (server)

**Files:**
- Create: `apps/server/src/routes/admin/reports.ts`, `apps/server/src/trees/delete.ts`
- Modify: `apps/server/src/routes/room.ts` (dùng `deleteTreeWithPhotos`)
- Test: `apps/server/test/admin-reports.test.ts`

**Interfaces — Produces:**
- `deleteTreeWithPhotos(app, req, treeId: string, inTx?: (tx) => Promise<void>): Promise<boolean>` — chuyển nguyên logic xoá trong `room.ts` (khoá dòng cây, xoá lời nhắn + báo cáo lấy khoá ảnh, xoá cây, rồi `dropPhoto`), gọi `inTx` trong cùng giao dịch; cây không có → `false`.
- `GET /api/admin/reports?status=open|handled` → `{ items: AdminReport[] }`:
```ts
type AdminReport = {
  id: string; createdAt: string; reporter: 'owner' | 'guest'; reason: string | null;
  treeId: string; messageId: string | null; snapshot: string | null; hasPhoto: boolean;
  messageExists: boolean; status: 'open' | 'resolved' | 'dismissed';
  resolution: string | null; handledAt: string | null; note: string | null; // note lấy từ admin_audit target report
};
```
- `GET /api/admin/reports/:rid/photo` → `image/webp`, `Cache-Control: private, no-store`; không có → 404.
- `POST /api/admin/reports/:rid/resolve { action, note }` (zod: `note` trim 1–500) → 200 `{ ok: true }`. Đánh dấu bằng `UPDATE reports … WHERE id = :rid AND status = 'open' RETURNING` trong giao dịch; 0 dòng → 409 `already_handled` (hoặc 404 nếu không tồn tại).
  - `delete_message`: báo cáo không có `message_id` → 400 `no_message`; lời nhắn không còn → 409 `message_gone`; xoá lời nhắn, `resolved/message_deleted`, audit `report_resolve` target `report` note = `"delete_message: " + note`; sau giao dịch `dropPhoto`.
  - `delete_tree`: `deleteTreeWithPhotos(..., inTx: audit 'tree_delete' target 'tree' note = "báo cáo #{rid}: " + note)`.
  - `dismiss`: `dismissed/no_action`, audit `report_resolve` note `"dismiss: " + note`.

- [x] **Step 1:** Test: danh sách `open` chỉ có báo cáo mở, có `snapshot`, **không** có trường nội dung nào khác của lời nhắn (so khoá JSON với danh sách cho phép); `hasPhoto` đúng; ảnh báo cáo đọc được bằng phiên quản trị, 401 khi không phiên; ba hành động đổi đúng trạng thái và có audit; `delete_message` xoá Blob ảnh lời nhắn nhưng **giữ** bản chụp `r/{id}.webp`; `delete_tree` xoá mọi Blob của cây gồm bản chụp, có audit `tree_delete`; resolve lần 2 → 409 `already_handled` và số dòng audit không đổi; lời nhắn đã xoá → 409 `message_gone`; `note` rỗng → 400; thiếu CSRF → 403; `DELETE /api/trees/:id` của chủ cây vẫn qua test cũ.
- [x] **Step 2:** Chạy → FAIL.
- [x] **Step 3:** Làm theo Interfaces.
- [x] **Step 4:** Chạy test server → PASS.
- [x] **Step 5:** Commit `feat(server): hàng đợi báo cáo quản trị (xoá lời nhắn, xoá phòng, bỏ qua)`.

### Task 6: Tra cứu phòng + Nhật ký (server)

**Files:**
- Create: `apps/server/src/routes/admin/trees.ts`, `apps/server/src/routes/admin/audit.ts`
- Modify: `apps/server/src/routes/auth.ts` (export `PIN_FAILS_PER_TREE_DAY`, `DAY_MS`)
- Test: `apps/server/test/admin-trees.test.ts`

**Interfaces — Produces:**
- `GET /api/admin/trees/:id` → 
```ts
type AdminTree = {
  id: string; ownerName: string; title: string | null; createdAt: string; lastOwnerVisitAt: string | null;
  itemCount: number; messages: { opened: number; unopened: number };
  recovery: { pin: boolean; google: boolean }; activeSessions: number;
  reports: { open: number; total: number };
  pin: { failsToday: number; lockedUntil: string | null }; // bucket pin:tree:{id}, khung DAY_MS; hits ≥ 50 → windowEnd
};
```
- `POST /api/admin/trees/:id/unlock-pin { note? }` → 204: xoá `rate_counters` có `bucket = 'pin:tree:{id}'` hoặc `LIKE 'pin:tree:{id}:%'` (escape `%`/`_` không cần vì id là `[a-z0-9]`), audit `pin_unlock`.
- `POST /api/admin/trees/:id/revoke-sessions { note? }` → `{ revoked: number }`, audit `sessions_revoke`.
- `DELETE /api/admin/trees/:id` body `{ note }` (bắt buộc 1–500) → 204 qua `deleteTreeWithPhotos`, audit `tree_delete`. Cây không có → 404.
- `GET /api/admin/audit?before=` → `{ items: { id: string; at: string; email: string | null; action: string; targetType: string | null; targetId: string | null; note: string | null }[]; nextBefore: string | null }` — 50 dòng, `id < before`, mới nhất trước.

- [x] **Step 1:** Test: JSON tra cứu chỉ có đúng các khoá trong `AdminTree` (không có `content`, `authorName`, `photoKey`); số đếm đúng với dữ liệu seed (2 lời nhắn, 1 đã mở; 1 phiên còn, 1 đã thu hồi); 50 lần PIN sai (ghi thẳng `rate_counters` hits = 50) → `lockedUntil` = cuối ngày UTC; `unlock-pin` → bucket của cây này mất, bucket `pin:tree:khac` còn, sau đó `POST /auth/pin` đúng PIN → 204; `revoke-sessions` → cookie chủ cây cũ gọi `/owner` → 401; `DELETE` không `note` → 400, có → 204 và Blob mất; audit trả mới nhất trước, `nextBefore` phân trang đúng với 55 dòng.
- [x] **Step 2:** Chạy → FAIL.
- [x] **Step 3:** Làm theo Interfaces.
- [x] **Step 4:** Chạy test server → PASS; cập nhật `apps/server/src/routes/README.md` (thêm nhóm `/api/admin`).
- [x] **Step 5:** Commit `feat(server): tra cứu phòng, mở khoá PIN, thu hồi phiên, xoá phòng, nhật ký quản trị`.

### Task 7: Khung trang quản trị (web)

**Files:**
- Create: `apps/web/src/admin/adminApi.ts`, `apps/web/src/admin/AdminApp.tsx`, `apps/web/src/admin/AdminLogin.tsx`, `apps/web/src/admin/admin.css`, `apps/web/src/admin/AdminApp.test.tsx`
- Modify: `apps/web/src/lib/api.ts` (export `request`), `apps/web/src/App.tsx`

**Interfaces — Produces:**
- Route trong `App.tsx`: `{ path: '/quan-tri/*', lazy: () => import('./admin/AdminApp').then((m) => ({ Component: m.AdminApp })) }` (đặt trước `*`).
- `adminApi` (gói trong `adminApi.ts`, giữ `csrf` ở biến module): `me()`, `login(idToken)`, `logout()`, `overview()`, `reports(status)`, `reportPhotoUrl(rid)`, `resolve(rid, action, note)`, `tree(id)`, `unlockPin(id, note?)`, `revokeSessions(id, note?)`, `deleteTree(id, note)`, `audit(before?)`. Mọi lệnh POST/DELETE gửi `x-csrf-token`; gặp 403 `csrf` → gọi `me()` lấy token mới rồi thử lại **một lần**. Kiểu trả về trùng với Task 4–6.
- `AdminContext = { email: string; onError(e: unknown): void }`; `onError` với `ApiError` 401 → về màn đăng nhập (đặt `me = null`).
- `AdminApp`: lúc vào gọi `me()`; 401 → `<AdminLogin>` (một `GoogleButton` + lỗi `not_admin` "Tài khoản này không có quyền quản trị"); có `me` → khung: thanh bên (≥ 900px) / tab trên cùng với Tổng quan · Báo cáo (số chờ) · Tra cứu phòng · Nhật ký · email + Đăng xuất; `<Routes>` con: `''`, `bao-cao`, `phong`, `nhat-ky` (trang con là placeholder ở task này). `useEffect` thêm `<meta name="robots" content="noindex">` và gỡ khi rời trang.

- [x] **Step 1:** Test: `me` 401 → thấy màn đăng nhập; đăng nhập (mock `GoogleButton` + `adminApi.login`) → thấy thanh bên có email; một trang con ném `ApiError(401)` qua `onError` → về màn đăng nhập và `me` chỉ bị gọi đúng số lần mong đợi (không lặp); 403 `csrf` lần đầu → `me` được gọi lại và yêu cầu thử lại thành công (test trên `adminApi` với `fetch` giả); meta `robots` có khi mở và mất khi gỡ.
- [x] **Step 2:** Chạy → FAIL.
- [x] **Step 3:** Làm theo Interfaces.
- [x] **Step 4:** Chạy test web → PASS. `pnpm --filter @ctln/web build`: có chunk riêng chứa `AdminApp`; chunk chính không chứa chuỗi `"Tài khoản này không có quyền quản trị"` (`grep` trên file `dist/assets/index-*.js`); gzip chunk chính ≤ 250 KB.
- [x] **Step 5:** Commit `feat(web): khung trang quản trị /quan-tri (lazy), đăng nhập Google`.

### Task 8: Trang Tổng quan (web)

**Files:** Create `apps/web/src/admin/Overview.tsx`, `Overview.test.tsx`.

- [x] **Step 1:** Test với `overview()` giả: hiện giai đoạn và đếm ngược tới `next.at`; ba thẻ tổng + "+N trong 24 giờ"; "Báo cáo đang chờ: N" là link `/quan-tri/bao-cao`; lan truyền hiện `0,33` (`viral: null` → "—"); khối Máy chủ hiện lỗi 24 giờ, lần lỗi gần nhất (route + mã), p95 (`null` → "chưa có số liệu"; `latencySince` trong vòng 60 phút → ghi "từ {giờ}"), CSDL "x / 32 GB", kho ảnh (`unknown > 0` → "{n} ảnh chưa rõ dung lượng"), link Azure chỉ khi `azureUrl` khác null; dùng đồng hồ giả: sau 60 giây gọi `overview()` lần 2.
- [x] **Step 2:** Chạy → FAIL. **Step 3:** Làm. **Step 4:** Chạy → PASS.
- [x] **Step 5:** Commit `feat(web): trang tổng quan quản trị`.

### Task 9: Trang Báo cáo (web)

**Files:** Create `apps/web/src/admin/Reports.tsx`, `Reports.test.tsx`.

- [x] **Step 1:** Test: tab "Đang chờ" / "Đã xử lý" gọi `reports('open' | 'handled')`; bấm một báo cáo → chi tiết có bản chụp chữ, `<img src={reportPhotoUrl(id)}>` chỉ khi `hasPhoto`, mã phòng là link `/quan-tri/phong?id=…`; ba nút; ghi chú trống → nút khoá; báo cáo cả phòng (`messageId: null`) không có nút xoá lời nhắn; `messageExists: false` → nút xoá lời nhắn khoá kèm chữ "Lời nhắn đã bị xoá"; xoá lời nhắn / xoá phòng mở `ConfirmDialog`, xác nhận → `resolve(id, action, note)` → báo cáo rời danh sách; 409 `already_handled` → thông báo và tải lại danh sách.
- [x] **Step 2:** FAIL. **Step 3:** Làm. **Step 4:** PASS.
- [x] **Step 5:** Commit `feat(web): hàng đợi báo cáo quản trị`.

### Task 10: Trang Tra cứu phòng + Nhật ký (web)

**Files:** Create `apps/web/src/admin/TreeLookup.tsx`, `TreeLookup.test.tsx`, `AuditLog.tsx`, `AuditLog.test.tsx`.

**Interfaces — Consumes:** `parseTreeRef(input)` trong `apps/web/src/lib/treeRef.ts` (trả `{ id, key? }`), `api.roomImageUrl(id)`.

- [x] **Step 1:** Test `TreeLookup`: nhập `https://x/c/abc12345#k=SECRET` → `adminApi.tree` được gọi với `'abc12345'` và **không** lời gọi nào chứa `SECRET`; URL trang thành `?id=abc12345`; mở với `?id=` tự tra; hiện các số liệu, ảnh `roomImageUrl`, "PIN đang bị khoá đến {giờ}" khi `lockedUntil`; ba nút đều qua `ConfirmDialog`; xoá phòng bắt ghi chú; 404 → "Không tìm thấy cây này". Test `AuditLog`: hiện danh sách, "Xem thêm" gọi `audit(nextBefore)` và nối thêm, ẩn khi `nextBefore: null`.
- [x] **Step 2:** FAIL. **Step 3:** Làm. **Step 4:** PASS.
- [x] **Step 5:** Commit `feat(web): tra cứu phòng và nhật ký quản trị`.

### Task 11: Email hỗ trợ (web)

**Files:** Create `apps/web/src/ui/SupportHint.tsx`, `SupportHint.test.tsx`. Modify `routes/Home.tsx`, `routes/ReopenDialog.tsx`, `routes/OwnerLogin.tsx`, `routes/RoomPage.tsx` (chỗ "Không mở được cây này.").

**Interfaces — Produces:** `<SupportHint />` — `useConfig()?.supportEmail` null → không render; có → "Cần giúp? Gửi mã cây và mô tả vấn đề tới {email} (đừng gửi PIN hay link riêng)." với `mailto:`.

- [x] **Step 1:** Test: ẩn khi `supportEmail: null`; Home có chân trang với email; `ReopenDialog`/`OwnerLogin` hiện `SupportHint` khi lỗi `pin_locked` có `retryAt` > 60 phút, khi `not_owner`, khi Google không có cây; `RoomPage` hiện khi "Không mở được cây này."
- [x] **Step 2:** FAIL. **Step 3:** Làm. **Step 4:** PASS.
- [x] **Step 5:** Commit `feat(web): email hỗ trợ`.

### Task 12: Kiểm tra cuối + tài liệu

- [x] **Step 1:** `pnpm test` và `pnpm typecheck` → tất cả qua; ghi số test.
- [x] **Step 2:** `pnpm --filter @ctln/web build` → ghi kích thước gzip chunk chính và chunk quản trị.
- [x] **Step 3:** Chạy thật: `pnpm db:up`, `pnpm dev`; `pnpm db:migrate` báo chạy `0005_admin_metrics.sql`; mở `http://localhost:5173/quan-tri`, đăng nhập Google bằng email bootstrap; mở `/tao` thấy nút Google.
- [x] **Step 4:** Cập nhật `docs/tien-do.md`: trạng thái M3b, số test, danh sách thử tay M3b (đăng nhập quản trị; email khác bị từ chối; tổng quan; báo cáo 3 hành động; tra cứu + 3 hành động; nhật ký; Google tạo cây / mở lại / chào chủ cây; email hỗ trợ), việc M4 (thêm nguồn Azure vào Google Cloud, Publish app, `ADMIN_AZURE_URL`, `SUPPORT_EMAIL`, `ADMIN_BOOTSTRAP_EMAIL` trong App Service).
- [x] **Step 5:** Commit `docs: tiến độ M3b`.
