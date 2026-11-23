# Thiệp lời nhắn, ảnh kèm và tải ảnh: kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phụ kiện hiện trên cây cả khi xem toàn phòng. Lời nhắn nâng lên 400 ký tự (≤ 9 dòng thiệp) và hiện thành tấm thiệp do chủ dự án vẽ, có xem trước khi treo. Người viết kèm được 1 ảnh (lưu Blob riêng tư). Chủ cây tải được ảnh phòng và ảnh thiệp.

**Architecture:**
- **Web:** module thuần `card/layout.ts` (xếp chữ, có test) và `card/draw.ts` (vẽ canvas). Một bộ vẽ dùng chung cho bảng viết (`guest/Compose.tsx`), thẻ chủ cây (`owner/MessageCard.tsx`), xem toàn màn hình (`card/CardViewer.tsx`) và tải ảnh.
- **Server:** `storage/` (Blob / thư mục / bộ nhớ), `photo.ts` (kiểm và mã hoá lại ảnh bằng `sharp`). Ảnh đi kèm trong JSON của `POST/PUT` lời nhắn. `og/render.ts` tách phần vẽ phòng để có thêm `GET /api/trees/:id/image.png`.
- **Art:** `export.mjs` tách hai mẫu thiệp thành lớp WebP và sinh mục `card` trong `catalog.json`.

**Tech Stack:** React 19, Vitest + RTL, Fastify 5, Drizzle + PGlite, `sharp` (đã có), `@azure/storage-blob` (thêm vào server), Canvas 2D, `node --test` cho `packages/shared`.

**Spec:** `docs/dac-ta-v3.md` mục **6.7** (cùng 3.2 G3/G9, 3.3 O7, 6.6.1–6.6.3, 7.3, 8.4–8.6).

## Global Constraints

- **Giới hạn:** `limits.messageMax` = **400** ký tự (đếm theo ký tự Unicode như `text()`); không quá **9 dòng chữ** trên thiệp; server chặn thô **> 8 lần xuống dòng** (`invalid_body`).
- **Ảnh:**
  - Tệp chọn ở trình duyệt **≤ 20 MB**. Trình duyệt thu cạnh dài ≤ **1600 px**, mã hoá WebP (không được thì JPEG) chất lượng **0,85**.
  - Ảnh gửi lên ≤ **3 MB** sau giải mã base64. Server mã hoá lại **WebP q80**, cạnh dài ≤ 1600, không giữ metadata.
  - `bodyLimit` **4,5 MB** (4 718 592 byte) chỉ cho `POST /api/trees/:id/messages` và `PUT /api/messages/:mid`; mọi route khác giữ 64 KB.
  - Giới hạn tần suất `photo:ip:` **30/giờ**, chỉ đếm khi có ảnh.
- **Riêng tư:**
  - Vùng chứa Blob riêng tư `photos`; mọi lượt đọc ảnh đi qua server, `Cache-Control: private, no-store`.
  - `GET /api/trees/:id` và `/owner` không cho biết lời nhắn nào có ảnh. Chủ cây chỉ đọc ảnh khi `canRead` và `read_at` khác NULL.
  - Không log nội dung hay ảnh của người dùng.
- **Khoá Blob:** `m/{treeId}/{messageId}-{ngẫu nhiên base64url 9 byte}.webp`; bản chụp báo cáo `r/{reportId}.webp`.
- **Thiệp:**
  - Mẫu 1 (không ảnh) `card/card-plain.webp`; mẫu 2 (có ảnh) `card/card-photo-bg.webp` + `card/card-photo-frame.webp`. Khổ xuất **2100 × 1500**.
  - Chữ Mynerve cỡ **2,3 %W**, màu `#7a1f2a`. Giờ treo Grape Nuts **1,45 %W**, màu `#fff6e5`, dạng `24/12 · 20:05` (giờ Việt Nam).
  - Ký tên `— {tên}`; ẩn danh thì `— Một người bạn`.
- **Toạ độ thiệp** chỉ lấy từ `catalog.card` (sinh bởi `pnpm art:export`, không sửa tay `catalog.json`).
- **Chữ giao diện (đúng nguyên văn):**
  - "Lời nhắn dài quá khung thiệp, bớt vài dòng nhé"
  - "Ảnh lớn quá, chọn ảnh dưới 20 MB nhé"
  - "Ảnh này chưa đọc được, chọn ảnh JPG hoặc PNG nhé"
  - "Xem trước thiệp", "‹ Sửa lại", "Treo lên cây", "⬇ Tải ảnh", "⬇ Tải ảnh phòng"
- **CSS mới:** tiền tố `cd-` (thiệp), không trùng `room-animations.css` (`styles.test.ts` chặn).
- **Thời gian** kiểm qua `phaseOf(app)` / `app.deps.now()`; dòng mới tự đặt `createdAt`/`updatedAt` theo `now()`.
- **Mỗi task:**
  - Test + `pnpm typecheck` của gói bị sửa phải sạch trước khi commit.
  - Commit kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Route mới có test server; bảng API trong đặc tả (8.4–8.6) cập nhật cùng task thêm route.
- **Nhánh:** làm trên nhánh mới `thiep-anh-kem` tách từ `main`, không commit thẳng lên `main`.

## Review Focus

1. **Ảnh rất dài hoặc rất nhỏ** (panorama 4000×500, ảnh 40×40): phải cắt vừa ô (cover), không méo, không phóng quá cỡ gốc khi xử lý ở server. Test: `coverRect` ở Task 4, `processPhoto` ảnh nhỏ ở Task 9.
2. **Emoji / chữ phông Mynerve không có** (rộng hơn): thiệp tự thu chữ tới 80% chứ không cắt; bảng viết vẫn chặn khi quá 9 dòng ở cỡ 100%. Test: `fitCard` ở Task 4.
3. **Phông chưa tải xong lúc vẽ lần đầu:** đo chữ sai sẽ làm luật 9 dòng sai. `ensureCardFonts()` phải được chờ trước khi đo hoặc vẽ. Test ở Task 5.
4. **Lời nhắn có dòng trống liên tiếp hoặc một từ siêu dài không dấu cách** (URL): dòng trống vẫn chiếm dòng, từ dài bị bẻ theo ký tự. Test ở Task 4.
5. **Tải thiệp trên iPhone** (không hỗ trợ tải blob): dùng `navigator.share({ files })` khi `canShare`, không thì mở ảnh ở tab mới. Test ở Task 6.

---

### Task 1: Phụ kiện hiện trên cây khi xem toàn phòng

**Files:**
- Modify: `apps/web/src/guest/SlotsLayer.tsx`, `apps/web/src/guest/GuestTree.tsx`, `apps/web/src/owner/OwnerTree.tsx`
- Test: `apps/web/src/guest/SlotsLayer.test.tsx`, `apps/web/src/guest/GuestTree.test.tsx`, `apps/web/src/owner/OwnerTree.test.tsx`

**Interfaces — Produces:** `SlotsLayer` thêm prop `interactive?: boolean` (mặc định `true`). Khi `false`:
- chỉ vẽ điểm có phụ kiện (bỏ bong bóng trống);
- mỗi điểm là `<span>` (không phải `button`), `aria-hidden`;
- lớp ngoài có `pointer-events: none`, không gọi `onTap`.

- [ ] **Step 1: Viết test hỏng**
  - `SlotsLayer.test.tsx` › "interactive=false: chỉ vẽ phụ kiện, không có nút, không bắt chạm": 3 điểm (`taken`, `mine`, `empty`) → `queryAllByRole('button')` rỗng, 2 phần tử `.gs-slot`, lớp ngoài có style `pointer-events: none`.
  - `GuestTree.test.tsx` › "toàn phòng: phụ kiện đã treo hiện trên cây trước khi zoom": dữ liệu có slot 0 `occupied: true` → trước khi chạm cây `container.querySelectorAll('.gs-slot')` có 1 phần tử và không có nút "Chỗ trống…".
  - `OwnerTree.test.tsx` › "toàn phòng: quà hiện trước khi zoom, không mở được": chạm vào phụ kiện ở toàn phòng không gọi `api.openMessage`.
- [ ] **Step 2: Chạy, xác nhận hỏng** — `pnpm --filter @ctln/web test -- SlotsLayer GuestTree OwnerTree` → 3 test FAIL.
- [ ] **Step 3: Sửa.** `SlotsLayer` thêm `interactive`. `GuestTree` / `OwnerTree` luôn vẽ `SlotsLayer`: khi `zoomed` như cũ; khi chưa zoom thì `interactive={false}`. Chạm cây vẫn zoom như cũ (`onItemTap`).
- [ ] **Step 4: Chạy lại** `pnpm --filter @ctln/web test` và `pnpm --filter @ctln/web typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(web): phụ kiện hiện trên cây khi xem toàn phòng`

---

### Task 2: 400 ký tự, chặn xuống dòng, migration 0004

**Files:**
- Modify: `packages/art/scripts/export.mjs` (`limits.messageMax: 400`), `packages/shared/src/catalog.json` (sinh lại bằng `pnpm art:export -- --only=catalog`), `packages/shared/src/schemas.mjs`, `apps/server/src/db/schema.ts`, `docs/schema.postgres.sql`, `docs/dac-ta-v3.md` (7.3)
- Create: `apps/server/src/db/migrations/0004_card_photo.sql`
- Test: `packages/shared/test/schemas.test.mjs`, `apps/server/test/messages.test.ts`, `apps/server/test/migrate.test.ts`

**Interfaces — Produces:**
- `messages.photo_key text NULL` → Drizzle `messages.photoKey`.
- `reports.photo_snapshot_key text NULL` → `reports.photoSnapshotKey`.
- `MessageBodySchema` / `MessageEditSchema`: `content` có thêm kiểm tra số lần `\n` ≤ 8.

- [ ] **Step 1: Viết test hỏng**
  - **Shared:** `content` 400 ký tự (có emoji, đếm theo ký tự) hợp lệ; 401 → lỗi; 8 lần `\n` hợp lệ; 9 lần → lỗi.
  - **Server** `messages.test.ts` › "400 ký tự treo được, 401 → 400 invalid_body, 9 lần xuống dòng → 400".
  - **Server** `migrate.test.ts` › "0004: content ≤ 400, có photo_key và photo_snapshot_key". Kiểm `information_schema.columns`, và chèn thẳng một dòng 401 ký tự thì CSDL từ chối (ràng buộc CHECK).
- [ ] **Step 2: Chạy, xác nhận hỏng.**
- [ ] **Step 3: Viết migration.** `0004_card_photo.sql`:

```sql
-- Lời nhắn 400 ký tự + ảnh kèm (đặc tả 6.7)
ALTER TABLE messages DROP CONSTRAINT messages_content_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_check CHECK (char_length(content) BETWEEN 1 AND 400);
ALTER TABLE messages ADD COLUMN photo_key text;
ALTER TABLE reports ADD COLUMN photo_snapshot_key text;
```

  Trước khi viết, xác nhận tên ràng buộc thật bằng `\d messages` trên Postgres Docker; nếu khác `messages_content_check` thì dùng tên thật. Cập nhật `schema.ts`, `docs/schema.postgres.sql` và mục 7.3 của đặc tả cho khớp.
- [ ] **Step 4: Sửa phần còn lại.** `export.mjs`: `messageMax: 400`, chạy `pnpm art:export -- --only=catalog`. `schemas.mjs`: thêm `.refine((s) => (s.match(/\n/g)?.length ?? 0) <= 8, { message: 'Lời nhắn dài quá khung thiệp, bớt vài dòng nhé' })` cho `content`.
- [ ] **Step 5: Chạy** `pnpm test` và `pnpm typecheck` → PASS. Thêm: `pnpm db:migrate` trên Postgres Docker chỉ chạy `0004_card_photo.sql`, lần hai in "Không có migration mới".
- [ ] **Step 6: Commit** `feat: lời nhắn 400 ký tự, chặn quá 8 lần xuống dòng, migration 0004`

---

### Task 3: Tách mẫu thiệp thành lớp ảnh + mục `card` trong catalog

**Files:**
- Create: `packages/art/src/card/christmas_card.svg`, `packages/art/src/card/christmas_card_2.svg` (chép từ `images/`, giữ nguyên `images/` của chủ dự án), `packages/art/src/card.mjs`
- Modify: `packages/art/scripts/export.mjs` (thêm `--only=card`; `buildCatalog` thêm `card`), `packages/shared/src/catalog.json` (sinh lại)
- Output: `apps/web/public/assets/card/card-plain.webp`, `card-photo-bg.webp`, `card-photo-frame.webp`
- Test: `packages/shared/test/card-catalog.test.mjs`, `packages/art/test/card.test.mjs`

**Interfaces — Produces** `catalog.card`. Đơn vị: x và rộng tính theo %W, y và cao theo %H, cỡ chữ theo %W:

```ts
card: {
  w: 2100, h: 1500,
  assets: { plain: 'card/card-plain.webp', photoBg: 'card/card-photo-bg.webp', photoFrame: 'card/card-photo-frame.webp' },
  lines: number[],          // 11 dòng kẻ, y (%H), đo từ ảnh
  text: { left: 29.8, width: 52, fontSize: 2.3, color: '#7a1f2a', firstLine: 1, maxLines: 9 },
  date: { left: 79.3, top: 20.1, width: 8.8, height: 5, fontSize: 1.45, color: '#fff6e5' },
  photo: { left: number, top: number, width: number, height: number, angle: number },  // đo từ mặt nạ khung
  frameEdge: { x1: number, y1: number, x2: number, y2: number, gap: 0.4 },             // mép phải khung
}
```

`packages/art/src/card.mjs` export `splitPhotoCard(svg2: string, svg1: string): { base: string; frame: string }` và `measureCard(...)` (dùng ở bước xuất).

- [ ] **Step 1: Viết test hỏng**
  - `card.test.mjs` › "splitPhotoCard tách đúng nhóm khung": `frame` chứa đúng 1 `<image` (ngoài `<defs>`), `base` không còn nhóm đó, cả hai là SVG hợp lệ (bắt đầu `<svg`, kết thúc `</svg>`).
  - `card-catalog.test.mjs` › "catalog.card khớp đặc tả" (sai số ±0,3):
    - `lines.length === 11`, `lines[0] ≈ 27.0`, `lines[1] ≈ 32.0`, `lines[10] ≈ 77.2`;
    - `photo ≈ { left: 0.64, top: 54.66, width: 27.75, height: 37.42, angle: -12.19 }`;
    - `frameEdge ≈ { x1: 28.52, y1: 38.0, x2: 37.12, y2: 93.71 }`;
    - ba file trong `assets` tồn tại dưới `apps/web/public/assets/`.
- [ ] **Step 2: Chạy, xác nhận hỏng** — `pnpm --filter @ctln/shared test`, `node --test packages/art/test/` (gói art chưa có script test: thêm `"test": "node --test \"test/*.test.mjs\""` vào `packages/art/package.json` để `pnpm test` chạy cả gói này).
- [ ] **Step 3: Viết `card.mjs`.** Quy tắc nhận ra nhóm khung trong mẫu 2: **nhóm con cấp cao nhất của `<svg>` có chứa `<image>` mà dữ liệu base64 của ảnh đó không xuất hiện trong mẫu 1**. Mã id trong file bị sinh ngẫu nhiên, không được dựa vào id.

  Đo đạc:
  - **(a) Dòng kẻ:** quét cột `x = 0,6W` của `card-plain` (ảnh 1600 rộng). Điểm ảnh có `r − g > 45 && r > 170 && b < 175` là màu dòng kẻ; gom các hàng liền nhau (cách ≤ 3 px), lấy tâm cụm. Giữ 11 cụm đầu nằm trong khoảng 25–80 %H.
  - **(b) Ô ảnh:** giải mã ảnh mặt nạ (luminance) của nhóm khung (khổ `width × height` theo thẻ `<image>`). Quét từ tâm hàng `0,45·H` sang hai bên tới khi gặp điểm sáng ≥ 128, được `l`, `r`. Quét cột `l + 150` lên và xuống, được `t`, `b`. Đổi bốn góc qua `matrix(a b c d e f)` của nhóm sang toạ độ viewBox, rồi sang %. `angle = atan2(b, a)` (độ).
  - **(c) Mép khung:** đổi hai điểm `(width, 0)` và `(width, height)` của ảnh khung qua cùng ma trận.
- [ ] **Step 4: Viết bước xuất.** `export.mjs` thêm `exportCard()`: render bằng `sharp(Buffer.from(svg), { limitInputPixels: false }).resize(2100, 1500)`.
  - mẫu 1 → `card-plain.webp` (q 85);
  - `base` → `card-photo-bg.webp` (q 85);
  - `frame` → `card-photo-frame.webp` (`alphaQuality: 90`).

  Composite thì ra buffer trước rồi mới resize hoặc extract (bài học trong `tien-do.md`). `buildCatalog` ghi `card` từ kết quả đo, lưu số đo vào `packages/art/card-meta.json` (giống `room-meta.json`). Chạy `pnpm art:export -- --only=card` rồi `--only=catalog`.
- [ ] **Step 5: Chạy test** → PASS. Ba file WebP tổng < 700 KB.
- [ ] **Step 6: Commit** `feat(art): tách hai mẫu thiệp thành lớp WebP, sinh catalog.card`

---

### Task 4: Bộ xếp chữ thiệp `card/layout.ts`

**Files:**
- Create: `apps/web/src/card/layout.ts`
- Test: `apps/web/src/card/layout.test.ts`

**Interfaces:**
- Consumes: `catalog.card` (Task 3).
- Produces:

```ts
export type Measure = (text: string, fontPx: number) => number;      // bề rộng px
export type CardLine = { text: string; x: number; baseline: number }; // px trong khung W×H
export type CardLayout = { lines: CardLine[]; sign: CardLine; fontPx: number; fits: boolean };
export function signText(anonymous: boolean, authorName: string | null): string;   // '— Minh' | '— Một người bạn'
export function cardDate(iso: string): string;                                      // '24/12 · 20:05' (UTC+7)
export function layoutCard(o: { text: string; sign: string; hasPhoto: boolean; W: number; measure: Measure; fontScale?: number }): CardLayout;
export function fitCard(o: Omit<Parameters<typeof layoutCard>[0], 'fontScale'>): CardLayout;  // thử fontScale 1, 0.95, 0.9, 0.85, 0.8
export function coverRect(srcW: number, srcH: number, boxW: number, boxH: number): { sx: number; sy: number; sw: number; sh: number };
```

**Quy tắc** (`H = W·1500/2100`):
- `fontPx = text.fontSize/100·W·fontScale`.
- Dòng chữ thứ `i` (từ 0) nằm trên dòng kẻ `k = firstLine + i`; `baseline = lines[k]/100·H − 0,15·fontPx`.
- Lề lùi (mẫu có ảnh): lấy `yb = lines[k]` (đáy hộp dòng), `edge = x1 + (yb − y1)/(y2 − y1)·(x2 − x1)`, `indent = max(0, edge + gap − text.left)` (%W).
  - Nhờ vậy dòng chữ 1–3 có `indent = 0`, dòng 4 có `indent ≈ 0,51`.
- Ngắt dòng: chia đoạn theo `\n` (dòng trống vẫn chiếm một dòng). Trong mỗi đoạn, ngắt tham lam theo từ, bề rộng tối đa `(text.width − indent)%W`. Từ dài hơn cả dòng thì bẻ theo ký tự (đếm ký tự bằng `[...s]`).
- Ký tên ở dòng kế tiếp sau dòng chữ cuối, căn phải tại `(text.left + text.width)%W` (`x` là mép phải).
- `fits = số dòng chữ ≤ maxLines`.

- [ ] **Step 1: Viết test hỏng.** `measure = (s, px) => [...s].length * px * 0.5`, `W = 2100`. Các test:
  - "dòng chữ đầu nằm trên dòng kẻ 2": `lines[0].baseline ≈ catalog.card.lines[1]/100·1500 − 0,15·fontPx`.
  - "ký tên ở dòng ngay dưới dòng chữ cuối": 2 dòng chữ → `sign.baseline` dùng dòng kẻ `firstLine + 2`.
  - "mẫu có ảnh: dòng 1–3 sát lề, dòng 4 lùi": các `x` của dòng 0–2 bằng `29,8%·W`, dòng 3 lớn hơn.
  - "quá 9 dòng → fits false": 10 đoạn ngắn.
  - "dòng trống giữ chỗ": `'a\n\nb'` → 3 dòng, dòng giữa rỗng.
  - "từ dài bị bẻ": 300 ký tự liền nhau → nhiều dòng, mỗi dòng không vượt bề rộng.
  - "fitCard thu chữ khi chữ rộng": `measure` ×1,2 cho văn bản vừa 9 dòng ở cỡ 100% → `fitCard(...).fits === true` và `fontPx < cỡ gốc`.
  - "signText / cardDate": `cardDate('2026-12-24T13:05:00Z') === '24/12 · 20:05'`.
  - "coverRect cắt giữa, không méo": `(4000, 500, 100, 100)` → `sh = 500`, `sw = 500`, `sx = 1750`.
- [ ] **Step 2: Chạy, xác nhận hỏng** — `pnpm --filter @ctln/web test -- card/layout`.
- [ ] **Step 3: Viết code** theo đúng quy tắc trên.
- [ ] **Step 4: Chạy** → PASS. Chạy `typecheck`.
- [ ] **Step 5: Commit** `feat(web): bộ xếp chữ thiệp (layoutCard, fitCard)`

---

### Task 5: Vẽ thiệp, `CardCanvas` và `CardViewer` toàn màn hình

**Files:**
- Create: `apps/web/src/card/draw.ts`, `apps/web/src/card/CardCanvas.tsx`, `apps/web/src/card/CardViewer.tsx`, `apps/web/src/card/card.css` (tiền tố `cd-`)
- Test: `apps/web/src/card/draw.test.ts`, `apps/web/src/card/CardCanvas.test.tsx`, `apps/web/src/card/CardViewer.test.tsx`

**Interfaces:**
- Consumes: Task 4.
- Produces:

```ts
export type CardData = { content: string; sign: string; sentAt: string; photo?: CanvasImageSource & { width: number; height: number } | null };
export function ensureCardFonts(): Promise<void>;   // document.fonts.load('16px Mynerve', 'Ểữ') + Grape Nuts
export function loadCardAssets(): Promise<{ plain: HTMLImageElement; photoBg: HTMLImageElement; photoFrame: HTMLImageElement }>;
export function drawCard(ctx: CanvasRenderingContext2D, W: number, d: CardData, a: Awaited<ReturnType<typeof loadCardAssets>>): CardLayout;
export function renderCardBlob(d: CardData): Promise<Blob>;     // canvas 2100×1500 → PNG
// <CardCanvas data={CardData} onTap?={() => void} />   canvas role="img", aria-label = content + ' ' + sign
// <CardViewer data={CardData} onClose={() => void} />  toàn màn hình
```

**Thứ tự vẽ:**
1. Có ảnh: nền `photoBg` → ảnh (`coverRect`, `translate` tới góc trên trái ô, `rotate(angle)`, clip ô) → `photoFrame`.
2. Không ảnh: `plain`.
3. Giờ: căn giữa ô `date`.
4. Các dòng chữ (`fitCard`), rồi ký tên căn phải.

`CardViewer`:
- phủ kín màn hình, `role="dialog"` `aria-modal`;
- trên màn dọc (`matchMedia('(orientation: portrait)')`) thiệp xoay 90°;
- `touch-action: pinch-zoom`;
- đóng bằng chạm, nút ✕ hoặc Escape.

- [ ] **Step 1: Viết test hỏng.**
  - `draw.test.ts`: dùng `ctx` giả ghi lại các lệnh gọi.
    - "không ảnh: vẽ plain, không vẽ frame";
    - "có ảnh: thứ tự photoBg → ảnh → photoFrame, có rotate(angle·π/180)";
    - "vẽ giờ `24/12 · 20:05` và ký tên".
  - `CardCanvas.test.tsx`: mock `draw.ts`.
    - "chờ ensureCardFonts trước khi drawCard";
    - "aria-label chứa nội dung và ký tên";
    - "chạm gọi onTap".
  - `CardViewer.test.tsx`:
    - "Escape và ✕ gọi onClose";
    - "màn dọc có lớp xoay `cd-rotated`".
- [ ] **Step 2: Chạy, xác nhận hỏng.**
- [ ] **Step 3: Viết code.** `CardCanvas` vẽ ở `W = clientWidth · devicePixelRatio` và vẽ lại khi đổi cỡ (`ResizeObserver`).
- [ ] **Step 4: Chạy** test và typecheck web → PASS.
- [ ] **Step 5: Commit** `feat(web): vẽ thiệp canvas, xem toàn màn hình`

---

### Task 6: Thẻ chủ cây hiện thiệp + nút "⬇ Tải ảnh"

**Files:**
- Modify: `apps/web/src/owner/MessageCard.tsx`, `apps/web/src/owner/OwnerTree.tsx`
- Create: `apps/web/src/card/download.ts`
- Test: `apps/web/src/owner/MessageCard.test.tsx`, `apps/web/src/card/download.test.ts`

**Interfaces:**
- Consumes: `CardCanvas`, `CardViewer`, `renderCardBlob`, `signText`.
- Produces: `downloadCard(blob: Blob, filename: string): Promise<'downloaded' | 'shared' | 'opened'>`.
  - `navigator.canShare?.({ files: [file] })` → `navigator.share({ files })` → `'shared'`.
  - iOS Safari (không hỗ trợ thuộc tính `download`) → `window.open(objectURL)` → `'opened'`.
  - Còn lại: thẻ `<a download>` → `'downloaded'`.
- `MessageCard` thêm prop `slotIndex: number`. Tên file tải về `loi-nhan-{slotIndex+1}.png`.

- [ ] **Step 1: Viết test hỏng.**
  - `MessageCard.test.tsx`:
    - "hiện thiệp (role img có nội dung) thay khối chữ cũ";
    - "nút ⬇ Tải ảnh gọi renderCardBlob + downloadCard với 'loi-nhan-3.png' khi slotIndex=2";
    - "chạm thiệp mở CardViewer";
    - các nút cũ (Trước/Sau, Xoá, Chặn, Báo cáo) vẫn chạy.
  - `download.test.ts`:
    - "canShare có files → share";
    - "không canShare → thẻ a download";
    - "iOS (userAgent iPhone, không canShare) → window.open".
- [ ] **Step 2: Chạy, xác nhận hỏng.**
- [ ] **Step 3: Viết code.** `MessageCard` hiện `CardCanvas` với `{ content, sign: signText(anonymous, authorName), sentAt: createdAt }`. Bỏ `.ow-content` nếu không còn dùng.
- [ ] **Step 4: Chạy** test và typecheck web → PASS.
- [ ] **Step 5: Commit** `feat(web): thẻ lời nhắn hiện thiệp, tải ảnh thiệp`

---

### Task 7: Bảng viết: 0/400, luật 9 dòng, bước "Xem trước thiệp"

**Files:**
- Modify: `apps/web/src/guest/Compose.tsx`, `apps/web/src/guest/GuestTree.tsx`
- Test: `apps/web/src/guest/Compose.test.tsx`, `apps/web/src/guest/GuestTree.test.tsx`

**Interfaces:**
- Consumes: `layoutCard` (fontScale 1), `CardCanvas`, `signText`, `ensureCardFonts`.
- Produces: `Compose` có hai bước `'write' | 'preview'`. Nút chính ở bước viết là **"Xem trước thiệp"**. Bước xem trước có **"‹ Sửa lại"** và nút gửi ("Treo lên cây"; chế độ sửa thì "Lưu thay đổi"). `onSubmit` chỉ gọi từ bước xem trước.

- [ ] **Step 1: Viết test hỏng** (mock `measure` để kết quả xác định).
  - "đếm ký tự theo ký tự Unicode: `x/400`";
  - "quá 9 dòng → hiện 'Lời nhắn dài quá khung thiệp, bớt vài dòng nhé', khoá Xem trước thiệp";
  - "Xem trước thiệp → thấy thiệp; ‹ Sửa lại giữ nguyên chữ; Treo lên cây gọi onSubmit đúng input";
  - "chế độ sửa cũng qua xem trước, nút Lưu thay đổi";
  - `GuestTree.test` › "slot_taken từ bước xem trước: bảng đóng, chữ giữ, mở bong bóng khác thấy chữ cũ".
- [ ] **Step 2: Chạy, xác nhận hỏng.**
- [ ] **Step 3: Viết code.** Bỏ `maxLength` của textarea, thay bằng kiểm `[...content].length ≤ messageMax`. Ngày trên thiệp xem trước = `serverNow()`.
- [ ] **Step 4: Chạy** test và typecheck web → PASS.
- [ ] **Step 5: Commit** `feat(web): bảng viết 400 ký tự, luật 9 dòng, xem trước thiệp`

---

### Task 8: Ảnh phòng `GET /api/trees/:id/image.png` + nút tải

**Files:**
- Modify: `apps/server/src/og/render.ts`, `apps/server/src/routes/og.ts`, `apps/server/src/app.ts` (`AppDeps.renderRoomImage?`), `apps/server/test/helpers.ts`, `apps/web/src/lib/api.ts`, `apps/web/src/owner/ShareSheet.tsx`, `apps/web/src/guest/GuestTree.tsx`, `docs/dac-ta-v3.md` (8.6)
- Test: `apps/server/test/og.test.ts`, `apps/web/src/owner/ShareSheet.test.tsx`, `apps/web/src/guest/GuestTree.test.tsx`

**Interfaces — Produces:**
- `render.ts`:
  - `renderRoomLayer(room: OgRoom, assetDir: string, scale: number): Promise<Buffer>` (PNG `720·scale × 1080·scale`, đúng phần ghép phòng hiện có trong `renderOg`);
  - `renderOg` gọi lại hàm này với `scale = 1`;
  - `renderRoomImage(room, assetDir) = renderRoomLayer(room, assetDir, 1.5)`.
- Route `GET /api/trees/:id/image.png`:
  - `content-type: image/png`, `content-disposition: attachment; filename="cay-thong-{id}.png"`, `cache-control: public, max-age=300`;
  - dùng lại bộ đệm LRU của `/og` (khoá thêm tiền tố `img:`);
  - `logEvent(db, 'image_downloaded', id)`.
- Web: `api.roomImageUrl(id: string): string`.

- [ ] **Step 1: Viết test hỏng.**
  - `og.test.ts`:
    - "image.png: PNG 1080×1620 (sharp metadata), có content-disposition, ghi event image_downloaded";
    - "404 khi không có cây";
    - "OG vẫn 1200×630 sau khi tách renderRoomLayer".
  - `ShareSheet.test.tsx`: "có link ⬇ Tải ảnh phòng với href /api/trees/{id}/image.png và thuộc tính download".
  - `GuestTree.test.tsx`: "khối dưới của khách có nút ⬇ Tải ảnh phòng".
- [ ] **Step 2: Chạy, xác nhận hỏng.**
- [ ] **Step 3: Viết code.** Khách: thêm `linkbtn` dưới "Tôi là chủ cây", tăng `GUEST_BOTTOM_RESERVE` (`apps/web/src/guest/GuestTree.tsx:30`) từ 116 lên 144. Cập nhật bảng 8.6 trong đặc tả.
- [ ] **Step 4: Chạy** `pnpm test`, `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `feat: tải ảnh phòng (image.png), nút cho chủ cây và khách`

---

### Task 9: Nơi lưu ảnh và xử lý ảnh ở server

**Files:**
- Create: `apps/server/src/storage/index.ts`, `apps/server/src/storage/memory.ts`, `apps/server/src/storage/fs.ts`, `apps/server/src/storage/azure.ts`, `apps/server/src/photo.ts`
- Modify: `apps/server/src/env.ts`, `apps/server/src/app.ts` (`AppDeps.photos`), `apps/server/src/index.ts`, `apps/server/test/helpers.ts`, `apps/server/package.json` (`@azure/storage-blob`), `.env.example`, `.gitignore` (`.data/`)
- Test: `apps/server/test/storage.test.ts`, `apps/server/test/photo.test.ts`

**Interfaces — Produces:**

```ts
export interface PhotoStore {
  put(key: string, data: Buffer): Promise<void>;        // content-type image/webp
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;                   // không có thì thôi, không ném lỗi
  copy(from: string, to: string): Promise<void>;
}
export function memoryStore(): PhotoStore & { keys(): string[] };
export function fsStore(dir: string): PhotoStore;
export function azureStore(connectionString: string, container = 'photos'): PhotoStore;   // createIfNotExists, không public
export function makePhotoStore(env: Env): PhotoStore;   // có AZURE_STORAGE_CONNECTION_STRING → azure, không thì fs(env.photoDir)
// photo.ts
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export async function processPhoto(base64: string): Promise<Buffer>;   // ném HttpError(400,'bad_photo') ; WebP q80, ≤1600, không metadata
export function photoKey(treeId: string, messageId: number): string;   // m/{treeId}/{id}-{randomToken(9)}.webp
```

- `Env` thêm `photoDir: string` (mặc định `<repo>/.data/photos`) và `azureStorageConnectionString?: string`.
- `makeTestApp` dùng `memoryStore()` và trả về `photos` để test kiểm tra.

- [ ] **Step 1: Viết test hỏng.**
  - `storage.test.ts`: cùng một bộ test chạy cho `memoryStore()` và `fsStore(tmpdir)`: put/get, get không có → null, delete hai lần không lỗi, copy.
  - `photo.test.ts`:
    - "JPEG có EXIF (GPS) → WebP, `metadata().exif` undefined";
    - "ảnh 4000×500 → cạnh dài 1600, giữ tỉ lệ";
    - "ảnh 40×40 không bị phóng to";
    - "base64 rác → bad_photo";
    - "PNG/GIF → bad_photo (chỉ nhận jpeg, webp)";
    - "> 3 MB sau giải mã → bad_photo".
    - Ảnh mẫu tạo bằng `sharp({ create })…withExif({ IFD3: { GPSLatitudeRef: 'N' } })`.
- [ ] **Step 2: Chạy, xác nhận hỏng.**
- [ ] **Step 3: Viết code.** `processPhoto`: `sharp(buf, { failOn: 'error' })`, đọc `metadata().format` ∈ {jpeg, webp}, `.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 })` (sharp mặc định không chép metadata). `azureStore` không có test tự động; ghi vào `tien-do.md` mục thử tay khi lên Azure (M4).
- [ ] **Step 4: Chạy** test và typecheck server → PASS.
- [ ] **Step 5: Commit** `feat(server): nơi lưu ảnh (Blob/thư mục/bộ nhớ) và xử lý ảnh`

---

### Task 10: Treo / sửa lời nhắn kèm ảnh; người viết đọc ảnh

**Files:**
- Modify: `packages/shared/src/schemas.mjs`, `apps/server/src/routes/messages.ts`, `apps/server/src/app.ts` (CSP `img-src` thêm `blob:`), `docs/dac-ta-v3.md` (8.4)
- Test: `apps/server/test/messages.test.ts`, `apps/server/test/app.test.ts`

**Interfaces:**
- Consumes: Task 9.
- Produces:
  - `MessageBodySchema.photo?: string` (base64, `max(4_200_000)`); `MessageEditSchema.photo?: string | null`.
  - `POST /api/trees/:id/messages` và `PUT /api/messages/:mid` đặt `bodyLimit: 4_718_592`.
  - `GET /api/messages/:mid/photo` (`X-Edit-Token`) → `image/webp`, `cache-control: private, no-store`; không có ảnh → 404.
  - `/mine` trả thêm `hasPhoto: boolean`.

**Luồng POST:**
1. Honeypot → trả giả, không xử lý ảnh.
2. Có `photo` → `rateLimit('photo:ip:'+iHash, 30)` → `processPhoto`.
3. Chèn dòng.
4. `photos.put(photoKey(treeId, id))` và `UPDATE messages SET photo_key` **trong cùng giao dịch**. Lấy `id` từ `insert … returning` rồi put; put lỗi thì giao dịch lỗi.
5. Giao dịch lỗi (`slot_taken`, `device_limit`, lỗi khác) → `photos.delete(key)` nếu đã put.

**Luồng PUT:**
- `photo` là chuỗi → xử lý ảnh rồi put khoá mới → `UPDATE … SET photo_key = mới WHERE editable(...) RETURNING` khoá cũ (đọc trong cùng câu bằng CTE hoặc `SELECT … FOR UPDATE` trong giao dịch).
  - Thành công → xoá khoá cũ.
  - 0 dòng → xoá khoá mới rồi `denyReason`.
- `photo: null` → đặt NULL, xoá khoá cũ.
- Không có trường `photo` → giữ nguyên.

- [ ] **Step 1: Viết test hỏng** (`makeTestApp` trả `photos`).
  - "treo kèm ảnh → 201, photo_key có, `photos.keys()` có đúng 1 khoá dạng `m/{treeId}/{id}-…webp`";
  - "treo kèm ảnh mà slot_taken → 409, `photos.keys()` rỗng";
  - "… mà device_limit → 409, rỗng";
  - "ảnh hỏng → 400 bad_photo, không có dòng nào";
  - "body > 4,5 MB → 413 body_too_large";
  - "route khác vẫn giới hạn 64 KB";
  - "honeypot kèm ảnh → 201 giả, không có khoá";
  - "photo:ip vượt 30/giờ → 429";
  - "PUT thay ảnh → khoá cũ bị xoá, khoá mới có; PUT photo:null → không còn khoá; PUT không gửi photo → giữ khoá";
  - "PUT sai token / hết 15 phút / đã mở kèm ảnh → lỗi như cũ và không sót khoá mới";
  - "GET /api/messages/:mid/photo: đúng token → image/webp + private,no-store; sai token → 403; không ảnh → 404";
  - `app.test.ts` › "CSP img-src có blob:".
- [ ] **Step 2: Chạy, xác nhận hỏng.**
- [ ] **Step 3: Viết code** theo luồng trên. Cập nhật bảng 8.4 trong đặc tả.
- [ ] **Step 4: Chạy** `pnpm test`, `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(server): treo và sửa lời nhắn kèm ảnh`

---

### Task 11: Chủ cây đọc ảnh, dọn ảnh khi xoá, báo cáo chép ảnh

**Files:**
- Modify: `apps/server/src/routes/owner.ts`, `apps/server/src/routes/messages.ts` (người viết xoá), `apps/server/src/routes/room.ts` (xoá cây), `docs/dac-ta-v3.md` (8.5)
- Test: `apps/server/test/owner.test.ts`, `apps/server/test/room.test.ts`, `apps/server/test/messages.test.ts`

**Interfaces — Produces:**
- `POST …/open` trả thêm `hasPhoto: boolean`.
- `GET /api/trees/:id/messages/:mid/photo`:
  - cần `requireOwner`;
  - `!canRead` → 423 `locked`;
  - `read_at` NULL → 403 `not_opened`;
  - không ảnh → 404;
  - có ảnh → `image/webp`, `private, no-store`.
- Dọn ảnh: sau khi xoá dòng thành công, gọi `photos.delete(key)`; lỗi chỉ `req.log.warn({ code })`, không trả lỗi.
  - Người viết xoá: `returning photoKey`.
  - Chủ cây xoá, chặn: `returning photoKey`.
  - Xoá cây: `SELECT photo_key` trước khi `DELETE trees`.
- Báo cáo của chủ cây cho lời nhắn có ảnh: sau khi chèn báo cáo, `photos.copy(m.photoKey, 'r/'+reportId+'.webp')` và `UPDATE reports SET photo_snapshot_key`.

- [ ] **Step 1: Viết test hỏng.**
  - "khách không có đường đọc ảnh: `GET /api/trees/:id` và `/owner` không có trường nào lộ ảnh (JSON không chứa 'photo')";
  - "chủ cây trước 24/12 → 423; sau 24/12 chưa mở → 403 not_opened; mở rồi → 200 image/webp";
  - "open trả hasPhoto đúng";
  - "người viết xoá / chủ cây xoá / chặn / xoá cây → `photos.keys()` không còn khoá của lời nhắn đó";
  - "store.delete ném lỗi → thao tác xoá vẫn 204";
  - "báo cáo lời nhắn có ảnh → reports.photo_snapshot_key = 'r/{id}.webp' và khoá đó tồn tại; xoá lời nhắn sau đó, bản chụp vẫn còn".
- [ ] **Step 2: Chạy, xác nhận hỏng.**
- [ ] **Step 3: Viết code.** Cập nhật bảng 8.5 trong đặc tả.
- [ ] **Step 4: Chạy** `pnpm test`, `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(server): chủ cây đọc ảnh, dọn ảnh khi xoá, báo cáo chép ảnh`

---

### Task 12: Web: chọn ảnh trong bảng viết, ảnh trên thiệp chủ cây

**Files:**
- Create: `apps/web/src/card/photo.ts`
- Modify: `apps/web/src/lib/api.ts`, `apps/web/src/guest/Compose.tsx`, `apps/web/src/guest/GuestTree.tsx`, `apps/web/src/owner/MessageCard.tsx`, `apps/web/src/owner/OwnerTree.tsx`
- Test: `apps/web/src/card/photo.test.ts`, `apps/web/src/guest/Compose.test.tsx`, `apps/web/src/guest/GuestTree.test.tsx`, `apps/web/src/owner/MessageCard.test.tsx`, `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Consumes: API Task 10–11, `CardData.photo`.
- Produces:

```ts
// card/photo.ts
export const PICK_MAX_BYTES = 20 * 1024 * 1024;
export type PreparedPhoto = { bitmap: ImageBitmap; base64: string };
export async function preparePhoto(file: File): Promise<PreparedPhoto>;
// ném PhotoError('too_big' | 'unreadable'); createImageBitmap → canvas ≤1600 → toBlob('image/webp',0.85), rỗng/không phải webp thì 'image/jpeg'
export async function bitmapFromBlob(b: Blob): Promise<ImageBitmap>;
// lib/api.ts
type MessageInput = { …; photo?: string | null };
api.getMyPhoto(mid: string, token: string): Promise<Blob | null>;        // 404 → null
api.getOwnerPhoto(id: string, mid: string): Promise<Blob | null>;
OpenedMessage.hasPhoto: boolean; MyMessage.hasPhoto: boolean;
```

- `request()` cần đọc phản hồi dạng Blob cho hai hàm ảnh: thêm `opts.as?: 'blob'`.
- `ComposeDraft` thêm `photo: PreparedPhoto | null` và `photoChanged: boolean` (sửa: chỉ gửi `photo` khi đổi; gỡ ảnh → `null`). Bản nháp `held` giữ cả ảnh.

- [ ] **Step 1: Viết test hỏng.**
  - `photo.test.ts` (mock `createImageBitmap`, canvas):
    - "file > 20 MB → too_big";
    - "createImageBitmap ném lỗi (HEIC) → unreadable";
    - "ảnh 4000×3000 → canvas 1600×1200";
    - "toBlob webp rỗng → dùng jpeg".
  - `Compose.test.tsx`:
    - "chọn ảnh quá 20 MB → 'Ảnh lớn quá, chọn ảnh dưới 20 MB nhé'";
    - "không đọc được → 'Ảnh này chưa đọc được, chọn ảnh JPG hoặc PNG nhé'";
    - "có ảnh → xem trước dùng mẫu có ảnh (CardCanvas nhận photo)";
    - "Treo lên cây gửi photo base64";
    - "gỡ ảnh khi sửa → gửi photo: null; không đổi ảnh → không có trường photo";
    - "đang gửi có ảnh → 'Đang gửi…'".
  - `GuestTree.test.tsx`:
    - "slot_taken giữ cả ảnh: mở bong bóng khác, xem trước vẫn có ảnh";
    - "sửa lời nhắn có ảnh → gọi getMyPhoto".
  - `MessageCard.test.tsx`:
    - "hasPhoto → gọi getOwnerPhoto, thiệp nhận photo; tải ảnh có ảnh";
    - "getOwnerPhoto lỗi → vẫn hiện thiệp không ảnh, không vỡ".
  - `api.test.ts`:
    - "getMyPhoto gửi x-edit-token, 404 → null";
    - "getOwnerPhoto trả Blob".
- [ ] **Step 2: Chạy, xác nhận hỏng.**
- [ ] **Step 3: Viết code.** Nút chọn ảnh dùng `<input type="file" accept="image/*">` cùng nút "Gỡ ảnh", và ảnh nhỏ xem trước đặt dưới ô lời nhắn. Tên lớp CSS dùng tiền tố `cd-`.
- [ ] **Step 4: Chạy** `pnpm test`, `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(web): kèm ảnh khi viết lời nhắn, ảnh trên thiệp của chủ cây`

---

### Task 13: Hoàn tất: kiểm tra chung, tài liệu, danh sách thử tay

**Files:** Modify `docs/tien-do.md`, `apps/web/src/README.md`, `apps/server/src/routes/README.md`.

- [ ] **Step 1:** `pnpm test` (cả 3 gói) và `pnpm typecheck` → sạch; ghi lại số test.
- [ ] **Step 2:** `pnpm build` → bản build JS + CSS gzip ≤ 250 KB (đặc tả); ghi con số.
- [ ] **Step 3:** Chạy thật với Postgres Docker và `pnpm dev`:
  - treo lời nhắn kèm ảnh → file xuất hiện trong `.data/photos/m/…`;
  - xoá lời nhắn → file mất;
  - `curl -I localhost:3000/api/trees/{id}/image.png` → 200 `image/png` có `content-disposition`.
- [ ] **Step 4:** `tien-do.md`:
  - cập nhật "Hiện tại" và Nhật ký;
  - danh sách thử tay: xem trước thiệp, 9 dòng, ảnh 20 MB, ảnh HEIC trên Chrome Android, xem toàn màn hình xoay trên điện thoại, tải thiệp trên iPhone và Android, tải ảnh phòng, `FAKE_NOW=2026-12-24T08:00:00+07:00` chủ cây mở thiệp có ảnh;
  - việc cho M4: tạo Storage Account + vùng chứa `photos`, đặt `AZURE_STORAGE_CONNECTION_STRING`, thử `azureStore` thật;
  - việc cho M10: xoá Storage Account ngày 07/01/2027.
- [ ] **Step 5: Commit** `docs: tiến độ — thiệp, ảnh kèm, tải ảnh`
