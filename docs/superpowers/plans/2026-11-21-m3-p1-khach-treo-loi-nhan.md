# M3 phần 1 — Khách treo lời nhắn: kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bạn bè mở `/c/:id` chạm cây → zoom → chọn bong bóng "+" → viết lời nhắn, chọn phụ kiện, treo; sửa/gỡ trong 15 phút trên cùng máy; chạm quà/thú cưng/lò sưởi có hiệu ứng đổi mỗi lần.

**Architecture:** Toàn bộ là frontend (`apps/web`), API đã có từ M1. Quy tắc tách module thuần có test (`guest/geometry.ts`, `guest/slots.ts`, `room/effects.ts`, `lib/clock.ts`); component chỉ hiển thị (`guest/SlotsLayer.tsx`, `guest/Compose.tsx`) và một bộ điều khiển (`guest/GuestTree.tsx`) nối vào `RoomPage`. Giao diện theo bản thiết kế canvas `tools/design-canvas/build-board-free.mjs`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest + RTL + jsdom, `@ctln/shared` (slots, catalog, schemas), `@ctln/art/ornaments`.

**Spec:** `docs/dac-ta-v3.md` mục **6.6** và **6.6.1** (cùng 3.2, 7.6, 8.4, 9.4, 9.5, 9.11, 11).

## Global Constraints

- Không sửa server; nếu buộc phải sửa thì có test server kèm theo.
- Khách chỉ gọi `GET /api/trees/:id` để biết trạng thái điểm; nội dung chỉ đọc qua `GET /api/messages/:mid/mine` với token của chính mình.
- Hiển thị chữ người dùng bằng React text (không `dangerouslySetInnerHTML`); SVG chèn nguyên văn chỉ là chuỗi tĩnh từ `@ctln/art`.
- Giới hạn: lời nhắn ≤ `catalog.limits.messageMax` (300), tên ≤ `nameMax` (30), 3 lời nhắn/thiết bị/phòng, sửa 15 phút (`editMinutes`).
- Khoá trình duyệt: `deviceId`, `msg:{treeId}:{slot}` = `{ messageId, editToken, editUntil }`, `lastName` — không thêm khoá mới.
- Hạn sửa so theo **giờ server** (`lib/clock.ts`), không theo `Date.now()` trần.
- Chỉ `BUILD`, `OPEN` có bong bóng/bảng viết/sửa.
- Tôn trọng `prefers-reduced-motion`: không chuyển tiếp zoom, không bay hạt.
- Tên class CSS mới không trùng `room-animations.css` (test `styles/styles.test.ts` chặn).
- Mỗi task: `pnpm --filter @ctln/web test` và `pnpm --filter @ctln/web typecheck` sạch trước khi commit. Commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Chữ giao diện tiếng Việt, đúng như đặc tả 6.6.1 / canvas.

## Review Focus

1. **Bảng viết bị đóng/mở lại sau `slot_taken`** — chữ, phụ kiện, tên đã chọn phải còn nguyên khi chạm bong bóng khác (test ở Task 7).
2. **Bấm "Treo lên cây" hai lần nhanh** — chỉ một `POST` được gửi (nút khoá khi đang gửi; test ở Task 6).
3. **Khoá `msg:` hỏng hoặc của điểm giờ đã trống** (JSON lỗi, điểm bị chủ cây xoá) — không làm sập trang, điểm hiện như bong bóng trống, khoá bị dọn (test ở Task 3).
4. **Máy lệch giờ / `FAKE_NOW`** — hạn sửa và "còn N phút" tính theo giờ server (test ở Task 1 và Task 7).
5. **Cây lật hoặc thu nhỏ 0,5** — điểm nhắn và tâm zoom vẫn nằm trên tán (test ở Task 2).

---

### Task 1: Thư viện — API lời nhắn, khoá `msg:`, đồng hồ server; gỡ TanStack Query

**Files:**
- Modify: `apps/web/src/lib/api.ts` (thêm header tuỳ chọn cho `request`, 4 hàm lời nhắn)
- Modify: `apps/web/src/lib/storage.ts` (khoá `msg:`, `lastName`)
- Create: `apps/web/src/lib/clock.ts`
- Modify: `apps/web/src/main.tsx` (bỏ `QueryClientProvider`), `apps/web/package.json` (bỏ `@tanstack/react-query`), chạy `pnpm install`
- Test: `apps/web/src/lib/api.test.ts`, `storage.test.ts`, `clock.test.ts`

**Interfaces:**
- Produces:
  - `type MessageInput = { ornament: string; anonymous: boolean; authorName?: string; content: string }`
  - `type MyMessage = { messageId: string; slotIndex: number; ornament: string; anonymous: boolean; authorName: string | null; content: string; editUntil: string }`
  - `api.postMessage(treeId, body: MessageInput & { slotIndex: number; website: string }) → Promise<{ messageId: string; editToken: string; editUntil: string }>`
  - `api.getMine(mid, token) → Promise<MyMessage>` (header `x-edit-token`)
  - `api.editMessage(mid, token, body: MessageInput) → Promise<{ ok: true }>`
  - `api.deleteMessage(mid, token) → Promise<void>`
  - `type MineEntry = { messageId: string; editToken: string; editUntil: string }`
  - `storage.getMine(treeId, slot): MineEntry | null` (JSON hỏng hoặc thiếu trường → `null`)
  - `storage.setMine(treeId, slot, e: MineEntry)`, `storage.clearMine(treeId, slot)`
  - `storage.listMine(treeId): Record<number, MineEntry>` (quét khoá `msg:{treeId}:`)
  - `storage.getLastName(): string`, `storage.setLastName(n: string)`
  - `lib/clock.ts`: `syncClock(serverNowIso: string): void`, `serverNow(): number` (ms; độ lệch mặc định 0), `resetClock(): void` (cho test)

- [ ] **Step 1: Viết test hỏng**
  - `api.test.ts` › `getMine gửi x-edit-token và x-device-id`: `fetch` giả nhận header `x-edit-token: 'tok'`, URL `/api/messages/12/mine`.
  - `api.test.ts` › `postMessage gửi đúng body`: body JSON có `slotIndex`, `website: ''`.
  - `storage.test.ts` › `msg: lưu/đọc/xoá theo cây và điểm`; `listMine chỉ trả khoá của đúng cây` (đặt `msg:aaaaaaaa:1`, `msg:bbbbbbbb:2` → `listMine('aaaaaaaa')` có đúng khoá `1`); `getMine trả null khi JSON hỏng` (`localStorage.setItem('msg:aaaaaaaa:0','{x')`).
  - `storage.test.ts` › `lastName mặc định chuỗi rỗng`.
  - `clock.test.ts` › `serverNow cộng độ lệch`: `vi.setSystemTime('2026-12-01T00:00:00Z')`, `syncClock('2026-12-26T00:00:00Z')` → `serverNow() === Date.parse('2026-12-26T00:00:00Z')`; sau `resetClock()` bằng `Date.now()`.
- [ ] **Step 2:** `pnpm --filter @ctln/web test -- lib` → FAIL (hàm chưa có).
- [ ] **Step 3:** Cài đặt. `request` nhận thêm tham số `extraHeaders?: Record<string,string>`. Gỡ TanStack Query khỏi `main.tsx` và `package.json`, `pnpm install`.
- [ ] **Step 4:** `pnpm --filter @ctln/web test && pnpm --filter @ctln/web typecheck` → PASS; `grep -r tanstack apps/web/src apps/web/package.json` → không còn.
- [ ] **Step 5:** Commit `feat(web): API lời nhắn, khoá msg:, đồng hồ server; gỡ TanStack Query`.

---

### Task 2: Hình học — vị trí điểm nhắn và camera zoom

**Files:**
- Create: `apps/web/src/guest/geometry.ts`
- Test: `apps/web/src/guest/geometry.test.ts`

**Interfaces:**
- Consumes: `layoutSlots(shape, count)` từ `@ctln/shared` → `{ scale, slots: [{ i, x, y }] }` trong khung cây 400×600; `catalog.tree.frame` (`baseY 538`, `scaleInRoom 1.2`); `Fit` từ `room/fit.ts`.
- Produces:
  - `type SlotRect = { index: number; left: number; top: number; size: number }` (toạ độ phòng 720×1080)
  - `slotRects(room: Room): SlotRect[]` — cây = món `type === 'tree'` trong `room.items`
  - `type Camera = { x: number; y: number; scale: number }` (translate px trong vùng sân khấu + scale của khung 720×1080)
  - `zoomCamera(room: Room, areaW: number, areaH: number): Camera`

Công thức (giữ đúng canvas): `k = 1.2 · tree.scale`; góc khung cây `tl = tree.x − 200k`, `tt = tree.y − 538k`; với điểm `p` và `L.scale`: `px = flip ? 400 − p.x : p.x`, `size = 60 · L.scale · k`, `left = tl + px·k − size/2`, `top = tt + p.y·k − 6 · L.scale · k`. Zoom: `zf = 1.6 / max(0.8, tree.scale)`, tâm `(tree.x, tree.y − 300 · 1.2 · tree.scale)`, `base = fitRoom(areaW, areaH).scale`, `scale = base · zf`, `x = areaW/2 − cx·scale`, `y = areaH/2 − cy·scale`.

- [ ] **Step 1: Viết test hỏng**
  - `slotRects trả đúng số điểm = tree.slotCount` (phòng mặc định → 12).
  - `phòng mặc định: điểm 0 khớp công thức` (tính tay từ `layoutSlots('cloud3', 12).slots[0]`, cây x 492, y 912, scale 1; `toBeCloseTo`).
  - `cây lật: điểm đối xứng qua trục cây` — với `flip: true`, `left + size/2` của mỗi điểm bằng `2·tree.x − (left + size/2)` của bản không lật.
  - `cây scale 0.5: mọi điểm nằm trong hộp món cây` (hộp = `x − 240·s … x + 240·s`, `y − 645.6·s … y + 74.4·s`).
  - `zoomCamera: tâm cây ra giữa vùng` — `cx·scale + x === areaW/2` và tương tự trục y, với vùng 390×844; `scale === fitRoom(390,844).scale · 1.6`.
  - `zoomCamera: cây nhỏ 0.5 dùng max(0.8) → zf = 2`.
- [ ] **Step 2:** chạy `pnpm --filter @ctln/web test -- guest/geometry` → FAIL.
- [ ] **Step 3:** Cài đặt `geometry.ts`.
- [ ] **Step 4:** chạy lại → PASS.
- [ ] **Step 5:** Commit `feat(web): vị trí điểm nhắn và camera zoom vào cây`.

---

### Task 3: Trạng thái điểm nhắn (thuần)

**Files:**
- Create: `apps/web/src/guest/slots.ts`
- Test: `apps/web/src/guest/slots.test.ts`

**Interfaces:**
- Consumes: `PublicRoom['slots']`, `MineEntry`, `storage.listMine/clearMine`, `serverNow()` (Task 1).
- Produces:
  - `type SlotKind = 'empty' | 'taken' | 'mine' | 'mineExpired'`
  - `type SlotView = { index: number; kind: SlotKind; ornament?: string; mine?: MineEntry }`
  - `slotViews(slots: PublicRoom['slots'], slotCount: number, mine: Record<number, MineEntry>, nowMs: number): SlotView[]` — một phần tử cho mỗi `index` 0…slotCount−1; điểm không có trong `slots` coi là trống; `mine` chỉ áp khi điểm `occupied`; còn hạn (`nowMs < Date.parse(editUntil)`) → `mine`, hết → `mineExpired`.
  - `canWrite(phase: string): boolean` — `BUILD` | `OPEN`.
  - `isFull(views: SlotView[]): boolean`.
  - `pruneMine(treeId: string, slots: PublicRoom['slots'], nowMs: number): Record<number, MineEntry>` — xoá khoá hết hạn hoặc của điểm giờ không `occupied`, trả phần còn lại.
  - `minutesLeft(editUntil: string, nowMs: number): number` — `max(1, ceil((until − now)/60000))`.

- [ ] **Step 1: Viết test hỏng** — mỗi `SlotKind`; điểm thiếu trong `slots` → `empty`; `mine` trên điểm trống bị bỏ qua; `pruneMine` xoá khoá hết hạn và khoá của điểm trống, giữ khoá còn hạn (kiểm `localStorage`); `canWrite('NOTICE') === false`; `isFull` đúng khi không còn `empty`; `minutesLeft` với 14 phút 10 giây → 15, với 5 giây → 1.
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** chạy → PASS.
- [ ] **Step 5:** Commit `feat(web): trạng thái điểm nhắn của khách`.

---

### Task 4: Hiệu ứng chạm đồ vật (G6)

**Files:**
- Create: `apps/web/src/room/effects.ts`
- Modify: `apps/web/src/room/Scene.tsx` (bọc ảnh món thường bằng `<div className="hop">`, nhận `fx` để vẽ lớp hiệu ứng, burst, câu nói; prop `onItemTap`)
- Modify: `apps/web/src/routes/RoomPage.tsx` (chế độ Xem — cả khách lẫn chủ cây — truyền `onItemTap` gọi bộ đếm hiệu ứng; không áp ở chế độ Sửa)
- Test: `apps/web/src/room/effects.test.ts`, `apps/web/src/room/Scene.test.tsx`

**Interfaces:**
- Consumes: `catalog.items[type].tapEffects` (`'fire' | 'gift' | 'pet'`), `SOUND`/`GIFT_FX`/`PET_FX` chép nguyên từ canvas (`build-board-free.mjs` dòng ~327–343).
- Produces:
  - `type Fx = { cls: string; burst?: 'confetti' | 'spark' | 'heart' | 'snow' | 'star' | 'note'; say?: string }`
  - `GIFT_FX: Fx[]` (6), `PET_FX: Fx[]` (6, `say: '@'` thay bằng tiếng theo loài), `FIRE_FX: Fx = { cls: 'fx-fire', burst: 'spark' }`
  - `createFxCycler(): { next(item: RoomItem): Fx | null }` — đếm vòng **theo `clientId`**; món không có `tapEffects` → `null`
  - `type Particle = { dx: number; dy: number; r: number; d: string; c: string; cls: string }`
  - `parts(kind: NonNullable<Fx['burst']>, seed: number): Particle[]` — chép thuật toán `parts()` của canvas (16 hạt cho confetti, 10 cho loại khác)
  - `Scene` prop mới: `fx?: { clientId: string; fx: Fx; seed: number } | null`, `onItemTap?: (clientId: string) => void`
  - `RoomPage` giữ `fx` 1,8 giây rồi về `null`; "giảm chuyển động" (`matchMedia('(prefers-reduced-motion: reduce)')`) → bỏ `burst`.

- [ ] **Step 1: Viết test hỏng**
  - `effects.test.ts` › `quà: 6 lần chạm liên tiếp ra 6 class khác nhau, lần 7 quay lại g-hop`.
  - `effects.test.ts` › `đếm riêng từng món` — chạm quà A, quà B → cả hai ra `g-hop`.
  - `effects.test.ts` › `thú cưng mèo: p-talk nói 'Meo~'`.
  - `effects.test.ts` › `lò sưởi luôn fx-fire`; `cửa sổ/thảm/cây → null`.
  - `effects.test.ts` › `parts cùng seed cho cùng kết quả; confetti 16 hạt`.
  - `Scene.test.tsx` › `fx gắn class lên món và vẽ .burst với đúng số .pt` và `say hiện chữ`.
  - `RoomPage.test.tsx` › `khách chạm hộp quà hai lần thấy hai class khác nhau` (bắn `pointerDown` lên `[data-type="gift"]`).
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt. Đánh dấu burst theo canvas: `<div class="burst" style="top: 22% (thú) | 10%">` chứa `<span class="pt {cls}" style="--dx;--dy;--r;--d;--c">` (heart/star/spark/note có SVG nhỏ như canvas dòng ~58).
- [ ] **Step 4:** chạy → PASS; `styles.test.ts` vẫn qua.
- [ ] **Step 5:** Commit `feat(web): hiệu ứng chạm quà, thú cưng, lò sưởi`.

---

### Task 5: Sân khấu zoom + lớp điểm nhắn

**Files:**
- Modify: `apps/web/src/room/RoomStage.tsx` (prop `camera`, `overlay`)
- Create: `apps/web/src/guest/SlotsLayer.tsx`
- Modify: `apps/web/src/styles/app.css` (class mới cho lớp điểm: tiền tố `gs-`, ví dụ `.gs-slots`, `.gs-slot`, `.gs-slot.is-mine`, `.gs-slot.ring`, `.gs-slot.drop-in`)
- Test: `apps/web/src/room/RoomStage.test.tsx`, `apps/web/src/guest/SlotsLayer.test.tsx`

**Interfaces:**
- Consumes: `slotRects` (Task 2), `SlotView` (Task 3), `ornamentSVGSoft(kind, 'filled')`, `slotBubbleSVG()` từ `@ctln/art/ornaments`; `catalog.ornaments[k].name`.
- Produces:
  - `RoomStage` prop `camera?: Camera | null` — khác `null` thì khung phòng dùng `translate(x,y) scale(scale)` thay cho cách co mặc định, `transition: transform .9s ease` (không có khi giảm chuyển động); prop `overlay?: ReactNode` vẽ **bên trong** khung 720×1080 (cùng hệ toạ độ phòng), sau `Scene`.
  - `SlotsLayer({ rects, views, fx, onTap }: { rects: SlotRect[]; views: SlotView[]; fx: Record<number, 'ring' | 'drop-in'>; onTap: (index: number) => void })` — mỗi điểm một `<button>`; SVG `viewBox="-30 -6 60 60"`; `aria-label`: trống → "Điểm trống, chạm để treo lời nhắn", của người khác → "{tên phụ kiện} đã treo", của mình → "Lời nhắn của bạn: {tên phụ kiện}"; lớp có `z-index: 1000`, hiện dần 0,6 s sau 0,55 s (canvas `.slots-layer`).

- [ ] **Step 1: Viết test hỏng**
  - `RoomStage.test.tsx` › `camera đặt transform translate+scale` và `không camera giữ cách co cũ`; `overlay nằm trong khung phòng`.
  - `SlotsLayer.test.tsx` › `12 nút với đúng nhãn cho trống / đã treo / của bạn`; `bấm nút gọi onTap(index)`; `điểm của mình có class is-mine`.
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** chạy → PASS; `styles.test.ts` qua.
- [ ] **Step 5:** Commit `feat(web): zoom sân khấu và lớp điểm nhắn`.

---

### Task 6: Bảng viết / sửa lời nhắn

**Files:**
- Create: `apps/web/src/guest/Compose.tsx`
- Modify: `apps/web/src/styles/app.css` (nếu cần, tiền tố `gs-`; dùng sẵn `.compose`, `.orn-pick`, `.chip`, `.input`)
- Test: `apps/web/src/guest/Compose.test.tsx`

**Interfaces:**
- Consumes: `Sheet` (`ui/Sheet.tsx`), `catalog.ornaments`, `catalog.limits`, `MessageInput` (Task 1).
- Produces:
  - `type ComposeDraft = { ornament: string; anonymous: boolean; authorName: string; content: string }`
  - `newDraft(lastName: string): ComposeDraft` — `{ ornament: 'ball', anonymous: false, authorName: lastName, content: '' }`
  - `Compose(props: { mode: 'new' | 'edit'; draft: ComposeDraft; onChange(d: ComposeDraft): void; minutesLeft?: number; busy: boolean; error?: string | null; onSubmit(input: MessageInput, website: string): void; onDelete?(): void; onClose(): void })` — **có kiểm soát** (cha giữ `draft`, để giữ chữ khi đóng vì `slot_taken`).
  - Tiêu đề: "Treo lời nhắn" / "Sửa lời nhắn của bạn"; nút "Treo lên cây" / "Lưu thay đổi"; gợi ý: mới → "Chủ cây sẽ đọc được từ đêm 24/12. Sau khi treo, bạn có 15 phút để sửa trên thiết bị này."; sửa → "Còn {n} phút để sửa hoặc xoá lời nhắn này."
  - Nút "Xoá lời nhắn" (chỉ chế độ sửa) hỏi lại bằng `window.confirm('Xoá lời nhắn này?')`.
  - Ô honeypot: `<input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true">` ẩn bằng CSS (không `display:none` để bot vẫn điền), giá trị truyền vào `onSubmit`.
  - `onSubmit` nhận `content` đã `trim()`, `authorName` đã `trim()` (bỏ khi ẩn danh).

- [ ] **Step 1: Viết test hỏng**
  - `mặc định chọn Quả cầu (ball) và Để tên, tên điền lastName`.
  - `nút Treo khoá khi lời nhắn trống hoặc chỉ khoảng trắng`; `khoá khi Để tên mà tên trống`; `Ẩn danh thì ẩn ô tên và không gửi authorName`.
  - `bộ đếm 0/300; gõ quá 300 bị cắt ở 300` (`maxLength`).
  - `onSubmit nhận nội dung đã trim và website ''`.
  - `busy → nút bị disabled; bấm 2 lần chỉ gọi onSubmit 1 lần` (Review Focus 2).
  - `chế độ sửa: tiêu đề, "Còn 7 phút", nút Xoá hỏi confirm`.
  - `error hiện trong bảng (role="alert")`.
  - `Escape gọi onClose` (kế thừa `Sheet`).
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** chạy → PASS.
- [ ] **Step 5:** Commit `feat(web): bảng viết và sửa lời nhắn`.

---

### Task 7: Bộ điều khiển khách và nối vào trang phòng

**Files:**
- Create: `apps/web/src/guest/GuestTree.tsx`
- Modify: `apps/web/src/routes/RoomPage.tsx` (khách: dùng `GuestTree`; `syncClock` từ `api.getConfig()` khi mở trang khách, lỗi thì bỏ qua)
- Test: `apps/web/src/guest/GuestTree.test.tsx`, bổ sung `apps/web/src/routes/RoomPage.test.tsx`

**Interfaces:**
- Consumes: mọi thứ ở Task 1–6.
- Produces: `GuestTree({ treeId, meta, room, toast }: { treeId: string; meta: PublicRoom; room: Room; toast: (m: string) => void })` — dựng `RoomStage` (camera, overlay `SlotsLayer`), nút "‹ Về căn phòng", lời nhắc "Chạm vào cây thông để treo lời nhắn", khối "Tạo cây của bạn"/"Tôi là chủ cây" (ẩn khi zoom; nút "Tôi là chủ cây" giữ hành vi cũ qua prop `onOwnerLogin: () => void`), `Compose`.

Hành vi (đặc tả 6.6.1):
- Chạm cây (`onItemTap` với món `tree`) → `camera = zoomCamera(...)`, gọi lại `api.getTree` cập nhật `slots` + `phase`, `pruneMine`.
- Chạm điểm `empty` khi `canWrite(phase)` → mở `Compose` mới; nếu đang giữ `draft` từ lần `slot_taken` trước thì dùng lại draft đó, ngược lại `newDraft(storage.getLastName())`.
- Chạm `mine` → `api.getMine` → `Compose` sửa với `minutesLeft(editUntil, serverNow())`; `mineExpired` → toast "Lời nhắn này không sửa được nữa", `clearMine`; `taken` → hiệu ứng `ring`, không gọi API.
- Treo thành công → `setMine`, `setLastName` (nếu Để tên), xoá draft, đóng bảng, điểm thành `mine` + `drop-in` 0,95 s, toast "Đã treo! Còn 15 phút để sửa".
- Lỗi POST: `slot_taken` → toast thông báo server, **giữ draft**, đóng bảng, tải lại `slots`; `device_limit`, `blocked`, `rate_limited` (429), `paused` (503), 400 → hiện `error` trong bảng, giữ chữ; `write_closed` → đóng bảng, `phase` coi như `NOTICE`, toast "Đã hết thời gian treo lời nhắn"; mạng/5xx khác → `error` "Chưa gửi được, thử lại nhé".
- Sửa/xoá: thành công → `ring` / điểm thành trống + `clearMine`; 403 (`bad_token`, `already_opened`, `edit_expired`) / 404 → toast thông báo server, đóng bảng, `clearMine`; 409 `conflict` → `error` trong bảng, giữ khoá và chữ.
- Cây đầy (`isFull`) khi đang zoom → dòng "Cây đã đầy lời nhắn" + nút "Tạo cây của bạn" (`/?ref={id}`).
- `!canWrite(phase)` → `SlotsLayer` không có điểm `empty` bấm được (bong bóng không hiện), chạm phụ kiện của mình không mở sửa.

- [ ] **Step 1: Viết test hỏng** (`api` giả như `RoomPage.test.tsx`; đồng hồ giả)
  - `chạm cây → hiện 12 nút điểm và nút Về căn phòng; gọi lại getTree`.
  - `treo thành công lưu msg:{id}:{slot}, lastName, hiện toast "Còn 15 phút"`.
  - `slot_taken: toast, tải lại slots, chạm bong bóng khác thấy chữ cũ` (Review Focus 1).
  - `device_limit / blocked / 429 / 503: lỗi trong bảng, chữ còn nguyên` (một test `it.each`).
  - `write_closed: bảng đóng, không còn bong bóng`.
  - `lỗi mạng: "Chưa gửi được, thử lại nhé"`.
  - `phase NOTICE: zoom được, không có bong bóng`.
  - `cây đầy: hiện "Cây đã đầy lời nhắn"`.
  - `sửa trong hạn: getMine với token, "Còn N phút" theo giờ server` — `syncClock` lệch +1 ngày so với máy, `editUntil` = giờ server + 7 phút → hiện "Còn 7 phút" (Review Focus 4).
  - `sửa: already_opened → toast, khoá msg: bị xoá`; `conflict → lỗi trong bảng, khoá còn`.
  - `xoá: confirm → deleteMessage, điểm thành bong bóng`.
  - `khoá msg: hỏng không làm sập trang` (Review Focus 3).
  - `khách không gọi API nào ngoài getTree/getConfig/postMessage/getMine/editMessage/deleteMessage` (kiểm danh sách hàm mock được gọi).
  - `RoomPage.test.tsx` › các test khách cũ (nút "Tạo cây của bạn", "Tôi là chủ cây") vẫn qua.
- [ ] **Step 2:** chạy → FAIL.
- [ ] **Step 3:** Cài đặt `GuestTree.tsx`, nối vào `RoomPage` (khối khách hiện tại chuyển vào `GuestTree`).
- [ ] **Step 4:** `pnpm --filter @ctln/web test && pnpm --filter @ctln/web typecheck` → PASS.
- [ ] **Step 5:** Commit `feat(web): khách zoom cây, treo, sửa, gỡ lời nhắn`.

---

### Task 8: Kiểm toàn bộ, tài liệu, danh sách thử tay

**Files:**
- Modify: `docs/tien-do.md` (mục "Hiện tại", danh sách thử tay M3 phần 1, nhật ký, số test, cỡ build)
- Modify: `apps/web/src/README.md` (`guest/` có gì, `room/effects.ts`)

- [ ] **Step 1:** `pnpm test` (gốc: shared + server + web) → tất cả PASS; ghi số test.
- [ ] **Step 2:** `pnpm typecheck` → sạch.
- [ ] **Step 3:** `pnpm --filter @ctln/web build` → JS + CSS gzip ≤ 250 KB; ghi con số.
- [ ] **Step 4:** Chạy thật: `pnpm db:up`, `pnpm dev`; tạo cây qua giao diện, mở `/c/{id}` trong cửa sổ ẩn danh, treo một lời nhắn → `GET /api/trees/{id}` có điểm `occupied: true`, không có trường nội dung.
- [ ] **Step 5:** Cập nhật `docs/tien-do.md`: chép "Danh sách thử tay khi xong phần 1" từ đặc tả 6.6.1 thành các mục đánh số (kèm cách đặt `FAKE_NOW=2026-12-26T00:00:00+07:00` trong `.env` rồi khởi động lại `pnpm dev`); "Việc tiếp theo: chờ chủ dự án thử tay phần 1, sau đó thiết kế phần 2".
- [ ] **Step 6:** Commit `docs: tiến độ — xong M3 phần 1`. **Dừng, báo chủ dự án thử tay** (không làm phần 2).
