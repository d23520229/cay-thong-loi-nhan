# M3 phần 2 + 3 — Chủ cây đọc & quản lý, chia sẻ, OG: kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ cây xem đếm ngược, số lời nhắn, mở quà từ 0h 24/12, xoá/chặn/báo cáo, bật/tắt số lời nhắn, xoá cây; nút chia sẻ; ảnh OG và HTML `/c/:id` có thẻ OG.

**Architecture:** Web: module thuần (`owner/countdown.ts`), hook camera dùng chung (`guest/useTreeZoom.ts`), component hiển thị (`owner/MessageCard.tsx`, `owner/ReportSheet.tsx`, `owner/OwnerOptions.tsx`, `owner/ShareSheet.tsx`), bộ điều khiển `owner/OwnerTree.tsx` nối vào `RoomPage`. Server: `og/render.ts` (ghép ảnh bằng sharp), `routes/og.ts` (`/og/:id.png`, phục vụ `WEB_DIST`, `/c/:id` chèn thẻ OG).

**Tech Stack:** React 19, Vitest + RTL, Fastify 5, `@fastify/static` (đã có trong dependencies), `sharp` (đã có), `@ctln/art` (thêm vào server), PGlite cho test server.

**Spec:** `docs/dac-ta-v3.md` mục **6.6.2**, **6.6.3** (cùng 3.3, 3.4, 8.3, 8.5, 8.6, 9.6).

## Global Constraints

- Nội dung lời nhắn chỉ qua `POST /api/trees/:id/messages/:mid/open`; không gọi khi điểm `locked`. Hiển thị chữ người dùng bằng React text; trong HTML server mọi giá trị chèn phải thoát `& < > " '`.
- Mốc thời gian lấy từ `/api/config` (`unlockAt`) và `serverNow()` (`lib/clock.ts`).
- Không thêm dịch vụ trả phí; ảnh OG không có chữ.
- Tên class CSS mới không trùng `room-animations.css`; tiền tố `ow-` (chủ cây), `sh-` (chia sẻ).
- Server: mọi route mới có test (Vitest + PGlite, `apps/server/test/helpers.ts`). Không log nội dung người dùng.
- Mỗi task: test + typecheck của gói bị sửa sạch trước khi commit; commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **StrictMode / tải lại** — lượt vào trang chỉ gọi `/owner` một lần, số "mới" không về 0 (test Task 4).
2. **Thẻ lời nhắn với nội dung có HTML/emoji/xuống dòng** — hiện nguyên chữ, giữ xuống dòng (test Task 3).
3. **Xoá/chặn lời nhắn đang mở rồi bấm "Sau ›"** — không mở lại điểm đã xoá (test Task 4).
4. **`ownerName` có ký tự HTML trong thẻ OG** — thoát đúng, không vỡ `<head>` (test Task 7).
5. **Không có bản build web** (`WEB_DIST` thiếu) — server vẫn chạy API như cũ (test Task 7).

---

### Task 1: API chủ cây + đếm ngược

**Files:** Modify `apps/web/src/lib/api.ts`; Create `apps/web/src/owner/countdown.ts`; Test `apps/web/src/lib/api.test.ts`, `apps/web/src/owner/countdown.test.ts`.

**Interfaces — Produces:**
- `type OpenedMessage = { messageId: string; slotIndex: number; ornament: string; anonymous: boolean; authorName: string | null; content: string; createdAt: string }`
- `api.openMessage(id, mid) → Promise<OpenedMessage>` (POST `/api/trees/:id/messages/:mid/open`)
- `api.ownerDeleteMessage(id, mid) → Promise<void>` (DELETE `/api/trees/:id/messages/:mid`)
- `api.blockSender(id, mid) → Promise<void>` (POST `/api/trees/:id/block` `{ messageId }`)
- `api.report(id, body: { messageId?: string; reason?: string }) → Promise<{ reportId: string }>`
- `api.setShowCount(id, show: boolean) → Promise<{ showMessageCount: boolean }>` (PUT `/settings`)
- `api.deleteTree(id) → Promise<void>`
- `countdownText(msLeft: number): string` — `≥ 1 ngày` → "Còn {d} ngày {h} giờ nữa là mở quà"; `≥ 1 giờ` → "Còn {h} giờ {m} phút nữa là mở quà"; `> 0` → "Còn {max(1,m)} phút nữa là mở quà"; `≤ 0` → "Quà đã mở!" (phút làm tròn lên).
- `formatSentAt(iso: string): string` — "dd/mm lúc HH:MM" giờ Việt Nam (UTC+7, không phụ thuộc múi giờ máy).

- [ ] Test: mỗi hàm API gọi đúng method/đường dẫn/body; `countdownText` các mốc 3 ngày 5 giờ, 5 giờ 12 phút, 30 giây → "Còn 1 phút…", 0 → "Quà đã mở!"; `formatSentAt('2026-11-21T13:05:00Z') === '21/11 lúc 20:05'`.
- [ ] Chạy → FAIL; cài đặt; chạy → PASS; commit `feat(web): API chủ cây, đếm ngược`.

### Task 2: Hook camera dùng chung + SlotsLayer cho chủ cây

**Files:** Create `apps/web/src/guest/useTreeZoom.ts`; Modify `apps/web/src/guest/GuestTree.tsx` (dùng hook, không đổi hành vi), `apps/web/src/guest/SlotsLayer.tsx`; Test `SlotsLayer.test.tsx` (thêm), GuestTree test cũ phải qua nguyên.

**Interfaces — Produces:**
- `useTreeZoom(room: Room): { camera: Camera | null; stageRef: MutableRefObject<HTMLDivElement | null>; zoomIn(): void; zoomOut(): void; onFit(): void }`
- `SlotsLayer` prop mới `states?: Record<number, 'locked' | 'unread' | 'read'>` — có thì vẽ `ornamentSVGSoft(kind, state)` và nhãn "Quà còn gói" / "Lời nhắn chưa đọc: {tên phụ kiện}" / "Lời nhắn đã đọc: {tên phụ kiện}".

- [ ] Test SlotsLayer: `states` cho đúng nhãn và SVG có class `st-locked` / `st-unread` / `st-read`.
- [ ] FAIL → cài đặt → toàn bộ test web PASS → commit `refactor(web): hook zoom cây dùng chung; SlotsLayer vẽ trạng thái quà`.

### Task 3: Thẻ lời nhắn + bảng báo cáo

**Files:** Create `apps/web/src/owner/MessageCard.tsx`, `apps/web/src/owner/ReportSheet.tsx`; Test `MessageCard.test.tsx`, `ReportSheet.test.tsx`.

**Interfaces — Produces:**
- `MessageCard({ message, hasPrev, hasNext, busy, onPrev, onNext, onDelete, onBlock, onReport, onClose }: { message: OpenedMessage; … })` — Sheet tiêu đề "Lời nhắn từ {tên}" / "Lời nhắn ẩn danh"; nội dung `white-space: pre-wrap`; `formatSentAt`; nút "‹ Trước", "Sau ›" (disabled khi không có), "Xoá", "Chặn người gửi", "Báo cáo". Xoá và Chặn hỏi lại bằng `ConfirmDialog` (chữ ở đặc tả 6.6.2).
- `ReportSheet({ busy, onSubmit(reason: string), onClose })` — ô lý do ≤ 200, nút "Gửi báo cáo".

- [ ] Test: tiêu đề có tên / ẩn danh; nội dung `<b>x</b>\nhai dòng` hiện nguyên chữ, không tạo thẻ `b`; trước/sau gọi callback, disabled đúng; Xoá → hộp "Xoá lời nhắn này?" → onDelete; Chặn → hộp "Chặn người gửi?" → onBlock; ReportSheet giới hạn 200, gửi lý do đã trim.
- [ ] FAIL → cài đặt → PASS → commit `feat(web): thẻ lời nhắn và bảng báo cáo`.

### Task 4: Bộ điều khiển chủ cây, tuỳ chọn, nối RoomPage

**Files:** Create `apps/web/src/owner/OwnerTree.tsx`, `apps/web/src/owner/OwnerOptions.tsx`; Modify `apps/web/src/routes/RoomPage.tsx`, `apps/web/src/styles/app.css`; Test `apps/web/src/owner/OwnerTree.test.tsx`, bổ sung `RoomPage.test.tsx`.

**Interfaces:** `OwnerTree({ treeId, meta: OwnerRoom, room, toast, onUnauthorized, onShare })`; `OwnerOptions({ showCount, busy, onToggleCount(v), onDeleteTree, onClose })`.

Hành vi theo đặc tả 6.6.2 (khối dưới, lời nhắc, đếm ngược 30 giây, zoom, trạng thái phụ kiện, `locked` → toast + rung, mở → thẻ, trước/sau, xoá/chặn/báo cáo, tuỳ chọn, xoá cây → `storage.removeMyTree` + điều hướng `/`, lỗi 423/404/401/mạng). Zoom gọi lại `getOwnerTree` chỉ lấy `slots`, `messageCount`. `RoomPage`: lượt tải đầu dùng chung một promise `/owner` giữa hai lần effect của StrictMode.

- [ ] Test OwnerTree: BUILD hiện đếm ngược theo giờ server + "· 3 lời nhắn · 2 mới"; tắt `showMessageCount` thì không có số; zoom → phụ kiện `Quà còn gói`, chạm → toast, không gọi `openMessage`; OPEN → chạm → `openMessage`, thẻ hiện nội dung; "Sau ›" mở điểm kế; xoá → API + điểm biến mất + thẻ đóng (Review Focus 3); chặn → `blockSender`; báo cáo → `report(id, { messageId, reason })`; 423 → toast; tuỳ chọn tắt số → `setShowCount(false)`; xoá cây → `deleteTree`, myTrees bỏ cây, về `/`.
- [ ] Test RoomPage: StrictMode → `getOwnerTree` gọi 1 lần khi vào trang (Review Focus 1).
- [ ] FAIL → cài đặt → toàn bộ web PASS → commit `feat(web): chủ cây đếm ngược, mở quà, xoá/chặn/báo cáo, tuỳ chọn`.

### Task 5: Bảng chia sẻ

**Files:** Create `apps/web/src/owner/ShareSheet.tsx`; Modify `OwnerTree.tsx` (nút "Chia sẻ"); Test `ShareSheet.test.tsx`.

**Interfaces:** `ShareSheet({ url, title, toast, onClose })`; `isMobile(ua = navigator.userAgent): boolean` (Android|iPhone|iPad).

- [ ] Test: hiện link; Sao chép gọi `navigator.clipboard.writeText(url)` + toast "Đã sao chép link"; clipboard lỗi → ô link được chọn + toast "Hãy giữ vào ô link để sao chép"; không có `navigator.share` thì không có nút "Chia sẻ…", có thì gọi `share({ title, url })`; Messenger trên điện thoại đặt `location.href = 'fb-messenger://share/?link=' + encodeURIComponent(url)` (qua hàm `openUrl` truyền vào để test), máy tính sao chép + "Đã sao chép — dán vào Messenger nhé"; Zalo sao chép + "Đã sao chép — mở Zalo và dán vào nhé".
- [ ] FAIL → cài đặt → PASS → commit `feat(web): bảng chia sẻ`.

### Task 6: Server — ảnh OG

**Files:** Create `apps/server/src/og/render.ts`, `apps/server/src/routes/og.ts`; Modify `apps/server/src/app.ts` (đăng ký), `apps/server/src/env.ts` (`webDist?: string` từ `WEB_DIST`; `assetDir: string` = `WEB_DIST` nếu có `index.html`, ngược lại `apps/web/public`), `apps/server/package.json` (`@ctln/art: workspace:*`); Test `apps/server/test/og.test.ts`.

**Interfaces:**
- `renderOg(room: { background; tree; items; slots }, assetDir: string): Promise<Buffer>` — PNG 1200×630, cách vẽ theo đặc tả 6.6.3 (thứ tự `rank` như `apps/web/src/room/model.ts drawOrder`, toạ độ điểm như `apps/web/src/guest/geometry.ts slotRects` — chép công thức, server không import code web).
- `GET /og/:id.png` — 404 JSON khi không có cây; đệm `Map` theo `${id}:${roomVersion}:${slotsKey}`, tối đa 200 (xoá cái cũ nhất).

- [ ] Test: PNG đúng 1200×630 (`sharp(buf).metadata()`); 404; gọi hai lần → `renderOg` chạy một lần (đếm qua hàm render tiêm vào `ogRoutes` hoặc so thời gian — dùng tiêm phụ thuộc `render` tuỳ chọn); lưu phòng đổi `roomVersion` → render lại; `content-type: image/png`, `cache-control` có `max-age=300`.
- [ ] FAIL → cài đặt → `pnpm --filter @ctln/server test && pnpm --filter @ctln/server typecheck` PASS → commit `feat(server): ảnh xem trước OG ghép từ căn phòng`.

### Task 7: Server — phục vụ bản build web và `/c/:id` có thẻ OG

**Files:** Modify `apps/server/src/routes/og.ts`, `apps/server/src/app.ts` (không đổi `setNotFoundHandler` cho `/api/*`); Test `apps/server/test/og.test.ts` (thêm, dùng thư mục tạm có `index.html` giả + `assets/x.js`).

**Interfaces:** `ogTags(meta: { id; ownerName; title }, baseUrl): string`; `escapeHtml(s): string`. Có `env.webDist` thì đăng ký `@fastify/static` (`root: webDist`, `wildcard: false`/`index: false`) và route trang: `GET /c/:id` → chèn thẻ trước `</head>`, đổi `<title>`; các đường dẫn trang khác (không bắt đầu `/api/`, `/og/`, không phải file tĩnh) → `index.html`.

- [ ] Test: `/c/{id}` 200 HTML có `og:title`, `og:description`, `og:image` = `{baseUrl}/og/{id}.png`, `og:url`, `twitter:card`; `ownerName` `A"<b>&` được thoát (Review Focus 4); `/c/zzzzzzzz` → 404 HTML gốc; `/tao` → 200 `index.html`; `/assets/x.js` → file tĩnh; `/api/khong-co` → 404 JSON như cũ; không có `webDist` → `/tao` 404 JSON, API vẫn chạy (Review Focus 5).
- [ ] FAIL → cài đặt → server PASS → commit `feat(server): phục vụ bản build web, /c/:id có thẻ OG`.

### Task 8: Kiểm toàn bộ, tài liệu, danh sách thử tay gộp

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm --filter @ctln/web build` (gzip ≤ 250 KB) — ghi số.
- [ ] Chạy thật: `pnpm --filter @ctln/server build`, `pnpm --filter @ctln/web build`, chạy `WEB_DIST=apps/web/dist BASE_URL=http://localhost:3001 PORT=3001 node apps/server/dist/index.js` (tạm, cổng khác để không đụng `pnpm dev` đang chạy) → `curl /c/{id}` có thẻ OG, `curl /og/{id}.png` ra PNG 1200×630; tắt server tạm.
- [ ] Cập nhật `docs/tien-do.md` (hiện tại, danh sách thử tay gộp M3, nhật ký, quyết định), `apps/web/src/README.md`, `apps/server/src/routes/README.md` (`og.ts` có rồi), `.env.example` (`WEB_DIST`).
- [ ] Commit `docs: tiến độ — xong M3`.
