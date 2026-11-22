# Sửa lỗi luồng sau M2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa các lỗi đã duyệt trong `docs/luong-hoat-dong.md` mục 9 (số 1, 2, 3, 4, 5, 8, 9, 14, 15) và ghi phần còn lại vào tiến độ.

**Architecture:** Server tách ghi lượt vào của chủ cây ra route riêng và nới giới hạn IP; web gọi route mới, sửa luồng "Xong" khi xung đột, tự thử phiên chỉ khi có 1 cây, lưu khi `pagehide` bằng `keepalive`, bỏ lưu thừa, kẹp tỉ lệ phòng.

**Tech Stack:** Fastify 5 + Drizzle + Vitest/PGlite (server); React 19 + zustand + Vitest/RTL/jsdom (web).

**Spec:** `docs/dac-ta-v3.md` — mục 6.5 (Tự lưu, Khung "Mở lại cây của bạn"), 7.9, 8.3, 10 (đã cập nhật 22/11). Bối cảnh lỗi: `docs/luong-hoat-dong.md` mục 9.

## Global Constraints

- Nhánh `fix-luong-sau-m2`. **Không commit** (chủ dự án chưa cho phép) — để thay đổi trong working tree; bước "Commit" thay bằng "Kiểm diff".
- Không đụng `.gitignore` (thay đổi có sẵn, không thuộc việc này).
- Chữ hiển thị tiếng Việt; tên test tiếng Việt theo phong cách file test hiện có.
- Mọi kiểm tra giai đoạn đi qua `phase.ts`/`guards.ts`; không đổi CSDL (không migration mới).
- Xong mỗi task: `pnpm --filter @ctln/server test` hoặc `pnpm --filter @ctln/web test` (tuỳ phần) qua hết; cuối cùng `pnpm test` và `pnpm typecheck` sạch.
- Giới hạn mới (đặc tả 10): tạo phòng **20/giờ/IP**, lời nhắn **100/giờ/IP**, chỉ đếm sau khi dữ liệu hợp lệ. Giới hạn khác giữ nguyên.

## Review Focus

1. StrictMode chạy effect hai lần → `POST /owner/visit` vẫn chỉ gửi **một** lần mỗi lần mở phòng (test ở Task 3).
2. Phiên hết giữa lúc sửa rồi đăng nhập lại (`load()` lần hai) → không gửi visit lần nữa (test ở Task 3).
3. `pagehide` khi phòng đã lưu, hoặc khi đang chờ bảng xung đột → **không** gửi gì (test ở Task 5).
4. `pagehide` sau khi autosave đã `stop()` (ví dụ đã rời chế độ Sửa) → không gửi (test ở Task 5).
5. Bấm lại đúng dáng/màu/phông đang chọn → không đổi `revision`, không lưu (test ở Task 6).

---

### Task 1: Môi trường — typecheck web

**Files:** không sửa file nào.

- [ ] **Step 1:** `pnpm install` (không đổi `pnpm-lock.yaml`; nếu lockfile đổi thì dừng và báo).
- [ ] **Step 2:** `pnpm typecheck` → mong đợi cả server, web, shared đều "Done", không lỗi `@tanstack/react-query`.
- [ ] **Step 3:** `git status --short` → chỉ còn các thay đổi đã có trước (`.gitignore`, `docs/`).

### Task 2: Server — `GET /owner` chỉ đọc, thêm `POST /owner/visit`; nới giới hạn IP

**Files:**
- Modify: `apps/server/src/routes/room.ts` (route `GET /api/trees/:id/owner`, thêm route mới)
- Modify: `apps/server/src/routes/trees.ts` (thứ tự đếm + ngưỡng 20 trong `POST /api/trees`)
- Modify: `apps/server/src/routes/messages.ts` (ngưỡng `msg:ip:` 20 → 100)
- Modify: `apps/server/src/routes/README.md` (thêm route mới vào bảng nếu README liệt kê route)
- Test: `apps/server/test/room.test.ts`, `apps/server/test/trees.test.ts`, `apps/server/test/messages.test.ts`

**Interfaces:**
- Produces: `POST /api/trees/:id/owner/visit` — cần cookie chủ cây; 401 `owner_required` nếu không; 204 không body; ghi `trees.last_owner_visit_at = app.deps.now()`. Không kiểm giai đoạn (đọc được cả NOTICE), ENDED đã có 410 chung.

- [ ] **Step 1: Sửa test O10** trong `room.test.ts` (`'O10: showMessageCount mặc định true; đếm mới từ lần xem trước'`) thành: GET hai lần liên tiếp đều `newSinceLastVisit: 2`; sau `POST /owner/visit` (204) thì GET trả `newSinceLastVisit: 0`; thêm lời nhắn mới (giờ sau) → GET trả 1. Thêm test `'POST /owner/visit: 401 không cookie; 204 và ghi last_owner_visit_at = now'` (đọc cột trong DB, so với giờ giả của `makeTestApp`).
- [ ] **Step 2:** `pnpm --filter @ctln/server test room` → FAIL (GET vẫn ghi; route mới 404).
- [ ] **Step 3:** Bỏ dòng `update(trees).set({ lastOwnerVisitAt: at })` khỏi GET; thêm route `POST /api/trees/:id/owner/visit` dùng `requireOwner`.
- [ ] **Step 4:** chạy lại → PASS.
- [ ] **Step 5: Test giới hạn tạo phòng** trong `trees.test.ts`: đổi `'lần thứ 6 cùng IP → 429'` thành `'lần thứ 21 cùng IP → 429'` (20 lần 201 rồi 429); thêm `'body sai không tốn lượt: 25 lần 400 rồi vẫn tạo được'` (25 × body thiếu cây → 400 `tree_count` hoặc `invalid_body`, rồi `pinBody()` → 201).
- [ ] **Step 6: Test giới hạn lời nhắn** trong `messages.test.ts`: `'lời nhắn thứ 101 trong giờ từ cùng IP → 429 rate_limited'`. Đừng tạo 100 lời nhắn thật: chèn sẵn dòng `rate_counters` `{ bucket: 'msg:ip:' + ipHash(loadEnv({}), '127.0.0.1', at), windowStart: đầu giờ UTC của at, hits: 99 }` (IP của `app.inject` là `127.0.0.1`; kiểm lại bằng một request nếu khác), gửi 1 lời nhắn → 201, gửi lời nhắn thứ hai (thiết bị khác, điểm khác) → 429.
- [ ] **Step 7:** chạy test trees + messages → FAIL đúng chỗ (ngưỡng cũ).
- [ ] **Step 8:** `trees.ts`: dời khối `rateLimit('create:ip:'…)` xuống **sau** `CreateTreeBodySchema.parse` và `validateRoom` (trước nhánh PIN/Google), ngưỡng `20`. `messages.ts`: ngưỡng `100`.
- [ ] **Step 9:** `pnpm --filter @ctln/server test` → toàn bộ PASS (kiểm test XFF trong `trees.test.ts` vẫn qua — nó có thể dựa vào ngưỡng 5; nếu vậy sửa vòng lặp theo 20).
- [ ] **Step 10:** Kiểm diff: chỉ các file trên.

### Task 3: Web — gọi `ownerVisit` một lần khi mở phòng chủ cây

**Files:**
- Modify: `apps/web/src/lib/api.ts` (thêm `ownerVisit`)
- Modify: `apps/web/src/routes/RoomPage.tsx` (`TreeRoom`)
- Test: `apps/web/src/lib/api.test.ts`, `apps/web/src/routes/RoomPage.test.tsx`

**Interfaces:**
- Consumes: `POST /api/trees/:id/owner/visit` (Task 2).
- Produces: `api.ownerVisit(id: string): Promise<void>` — `request<void>('POST', \`${tree(id)}/owner/visit\`)`.

- [ ] **Step 1: Test api** `'ownerVisit gửi POST /api/trees/{id}/owner/visit không body'` theo kiểu các test có sẵn trong `api.test.ts`.
- [ ] **Step 2: Test RoomPage** — thêm `ownerVisit: vi.fn()` vào mock `api` (và `mocked.ownerVisit.mockResolvedValue(undefined)` trong các test cần): 
  - `'chủ cây: mở phòng gọi ownerVisit đúng 1 lần (kể cả StrictMode)'` → `renderAt(undefined, true)`, chờ "Sửa phòng", `expect(mocked.ownerVisit).toHaveBeenCalledTimes(1)` với `ID`.
  - `'khách: không gọi ownerVisit'`.
  - Trong test có sẵn `'lưu bị 401 → "Chào chủ cây" → đăng nhập → tải lại và gửi lại thay đổi'`: thêm `expect(mocked.ownerVisit).toHaveBeenCalledTimes(1)` ở cuối.
  - `'ownerVisit lỗi (mạng) không làm hỏng trang'` → reject `ApiError(0,'network',…)`, vẫn thấy "Sửa phòng", không toast lỗi.
- [ ] **Step 3:** `pnpm --filter @ctln/web test RoomPage api` → FAIL.
- [ ] **Step 4:** Cài đặt: trong `TreeRoom` dùng `const visited = useRef(false)`; ngay sau `setView({ kind: 'owner', … })` trong `load`, nếu `!visited.current` thì đặt `true` và `void api.ownerVisit(id).catch(() => {})`. (Ref sống qua StrictMode vì `link.current` đã gộp lượt tải; nếu test StrictMode vẫn ra 2 lần thì đặt cờ trước khi gọi `load` thứ hai — kiểm bằng test.)
- [ ] **Step 5:** chạy lại → PASS; `pnpm --filter @ctln/web test` toàn bộ PASS.

### Task 4: Web — "Bạn đã có cây?" chỉ tự thử khi máy nhớ đúng 1 cây

**Files:**
- Modify: `apps/web/src/routes/ReopenDialog.tsx` (effect khi mở)
- Test: `apps/web/src/routes/ReopenDialog.test.tsx`

- [ ] **Step 1: Test** `'nhiều cây trong myTrees: không tự gọi getOwnerTree, điền sẵn cây mới nhất; bấm chip mới thử phiên rồi chuyển'` — `storage.addMyTree` hai cây, `getOwnerTree` resolve; sau khi render chờ một nhịp, `expect(mocked.getOwnerTree).not.toHaveBeenCalled()`, ô mã có giá trị cây đầu; bấm chip cây thứ hai → `getOwnerTree` gọi với id đó → thấy "Phòng đã mở". Giữ nguyên test `'cây có trong myTrees và phiên còn hiệu lực: mở thẳng, không hỏi PIN'` (1 cây).
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Effect chỉ gọi `tryOwner` khi `trees.length === 1` (đổi `first` ref cho khớp).
- [ ] **Step 4:** chạy lại → PASS.

### Task 5: Web — tự lưu: "Xong" khi xung đột, lưu khi `pagehide`

**Files:**
- Modify: `apps/web/src/lib/api.ts` (`request` nhận tuỳ chọn `keepalive`; `saveRoom` thêm tham số)
- Modify: `apps/web/src/room/autosave.ts`
- Modify: `apps/web/src/routes/RoomPage.tsx` (`OwnerEditor`)
- Test: `apps/web/src/lib/api.test.ts`, `apps/web/src/room/autosave.test.ts`, `apps/web/src/routes/RoomPage.test.tsx`

**Interfaces:**
- Produces:
  - `api.saveRoom(id: string, roomVersion: number, room: Room, opts?: { keepalive?: boolean }): Promise<{ roomVersion: number }>` — `keepalive` truyền thẳng vào `fetch`.
  - Autosave thêm `hasConflict(): boolean` (true từ lúc nhận 409 `version_conflict` đến khi `keepMine`/`useLatest`).
  - Autosave thêm `flushOnUnload(): void` — nếu `!stopped && !conflict && store.getState().room !== lastSaved && validateRoom(room).ok` thì gọi `o.api.saveRoom(treeId, version, room, { keepalive: true })` một lần, bỏ qua kết quả và lỗi (`.catch(() => {})`), không gọi `onState`. Kiểu `api` trong `Opts` giữ `Pick<typeof apiModule, 'saveRoom'>`.

- [ ] **Step 1: Test api** `'saveRoom với { keepalive: true } truyền keepalive cho fetch'`; và không truyền thì `keepalive` không có / `undefined`.
- [ ] **Step 2: Test autosave**:
  - `'hasConflict: true sau 409 version_conflict, false sau keepMine / useLatest'`.
  - `'flushOnUnload: có thay đổi chưa lưu → saveRoom một lần với keepalive và version hiện tại'` (gọi ngay, không tua 1,5 s; `saveRoom` nhận tham số thứ 4 `{ keepalive: true }`).
  - `'flushOnUnload: đã lưu / đang xung đột / đã stop → không gửi'` (ba trường hợp).
- [ ] **Step 3: Test RoomPage**:
  - `'"Xong" gặp 409 version_conflict → ở lại chế độ Sửa, hiện bảng xung đột'` — `saveRoom` reject `new ApiError(409,'version_conflict','x',{ room: publicRoom({ roomVersion: 5 }) })`; `editBackground()`, bấm "Xong" (không tua debounce) → thấy hai nút "Giữ bản trên máy này" / "Dùng bản mới nhất", vẫn có nút "Xong", không có "Sửa phòng", không toast "Thay đổi chưa được lưu.".
  - `'đang sửa có thay đổi chưa lưu, pagehide → saveRoom với keepalive'` — `window.dispatchEvent(new Event('pagehide'))` trước khi hết 1,5 s.
- [ ] **Step 4:** chạy các file test trên → FAIL.
- [ ] **Step 5: Cài đặt**:
  - `api.ts`: `request(method, path, body?, opts?: { keepalive?: boolean })`, thêm `keepalive` vào init của `fetch` chỉ khi có.
  - `autosave.ts`: `hasConflict`, `flushOnUnload` như Interfaces.
  - `RoomPage.tsx` `done()`: sau `await a.flush()`, `if (a.hasConflict()) return;` (bảng xung đột đã hiện qua `onConflict`). `OwnerEditor`: `useEffect` gắn `window.addEventListener('pagehide', h)` với `h = () => mine.current?.flushOnUnload()`, gỡ khi unmount.
- [ ] **Step 6:** chạy lại → PASS; `pnpm --filter @ctln/web test` toàn bộ PASS (đặc biệt các test "Xong" có sẵn).

### Task 6: Web — bỏ lưu thừa, kẹp tỉ lệ phòng

**Files:**
- Modify: `apps/web/src/room/model.ts` (`setBackground`, `setTreeConfig`)
- Modify: `apps/web/src/room/fit.ts` (`fitRoom`)
- Test: `apps/web/src/room/model.test.ts`, `apps/web/src/room/store.test.ts`, `apps/web/src/room/fit.test.ts`

- [ ] **Step 1: Test**:
  - model: `'setTreeConfig với giá trị đang có trả nguyên tham chiếu phòng'`, `'setBackground với phông đang có trả nguyên tham chiếu'`; đổi thật thì vẫn ra object mới.
  - store: `'setTree / setBackground không đổi gì → revision không tăng'`.
  - fit: `'vùng thấp hơn reserveTop + reserveBottom → scale 0, width/height 0, không âm'` (ví dụ `fitRoom(360, 100, 56, 116)`), và `fitRoom(0, 0)` → `scale` 0.
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** `setTreeConfig`: nếu mọi khoá trong `patch` bằng giá trị trong `room.tree` thì trả `room`. `setBackground`: nếu bằng thì trả `room`. `fitRoom`: `scale = Math.max(0, Math.min(...))`.
- [ ] **Step 4:** chạy lại → PASS; test autosave `slots_in_use` có sẵn vẫn qua (trả slotCount về giá trị cũ khi đang khác → vẫn là thay đổi thật).

### Task 7: Tài liệu và kiểm cuối

**Files:**
- Modify: `apps/web/vite.config.ts` (chú thích dòng 4: bỏ `/c`, chỉ `/api, /og`)
- Modify: `docs/tien-do.md`
- Modify: `docs/luong-hoat-dong.md`

- [ ] **Step 1:** Sửa chú thích `vite.config.ts` (không đổi cấu hình).
- [ ] **Step 2:** `docs/tien-do.md`: phần "Hiện tại" cập nhật ngày 22/11, số test mới; thêm mục "Việc nhỏ còn lại sau rà soát 22/11" gồm: PIN có thể bị người lạ khoá (chấp nhận); CSP helmet phải cho Google Identity khi server phục vụ web (M3/M4); `trees.updated_at` bị trigger chạm bởi mọi UPDATE (M3b); `deviceId` mất khi trình duyệt chặn storage (M3); `/mine` trả 403 khi không có lời nhắn; tạo cây mất phản hồi sinh cây mồ côi. Bảng mốc M4 thêm "bật IPv6 inbound cho App Service nếu gói B1 cho phép (kiểm chi phí)". Nhật ký: một dòng 22/11 tóm tắt các sửa.
- [ ] **Step 3:** `docs/luong-hoat-dong.md`: bảng route thêm `POST /owner/visit`, sửa dòng `GET /owner` (chỉ đọc), ngưỡng 20/100, luồng 4.4 (chỉ tự thử khi 1 cây), sơ đồ tự lưu (pagehide, "Xong" khi xung đột); mục 9 đánh dấu các lỗi đã sửa ("đã sửa 22/11").
- [ ] **Step 4:** `pnpm test` → shared, server, web đều PASS; `pnpm typecheck` → sạch. Ghi số test mới vào `tien-do.md`.
- [ ] **Step 5:** `git status --short` / `git diff --stat` để báo cáo; không commit.
