# M4 khối 1 — hoàn thiện trước triển khai: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dọn bảng định kỳ ở server; biểu ngữ NOTICE, đóng lối tạo cây và trang kết thúc ENDED ở web; trang `/chinh-sach`; Playwright 3 luồng trên bản build thật.

**Architecture:** Server thêm `cleanup.ts` (hàm thuần + hẹn giờ bật ở `index.ts`) và `purgeAt` trong `/api/config`. Web thêm một layout route `AppShell` bọc các trang công khai: nó hiện `PhaseBanner` ở NOTICE và thay cả trang bằng `EndedPage` khi `phase === 'ENDED'` hoặc khi một API trả 410 `service_ended`. E2E ở thư mục `e2e/` gốc, bật 4 server từ `apps/server/dist` với 4 `FAKE_NOW`.

**Tech Stack:** Fastify 5 + Drizzle + PGlite (Vitest), React 19 + React Router + RTL, `@playwright/test` (Chromium).

**Spec:** `docs/dac-ta-v3.md` mục **6.9** (cả 6.9.1–6.9.5). Đọc kèm mục 7.8 (giữ dữ liệu) và 10 (riêng tư).

## Global Constraints

- Mọi kiểm tra giai đoạn ở server đi qua `phase.ts`; "bây giờ" của dọn bảng là `now()` của `phase.ts` (theo `FAKE_NOW`), không dùng `now()` của CSDL.
- Không log nguyên lỗi CSDL: chỉ `{ name, code }`.
- Gói JS chính ≤ 250 KB gzip; `/chinh-sach` là gói riêng (lazy, như `/quan-tri`).
- Ngày trong biểu ngữ / trang kết thúc lấy từ `/api/config` (`serviceEndsAt`, `purgeAt`), hiển thị theo giờ Việt Nam (`Asia/Ho_Chi_Minh`), không viết cứng.
- Không thêm dịch vụ trả phí; e2e không gọi mạng ngoài (không đặt `GOOGLE_CLIENT_ID`).
- `pnpm test` không chạy e2e. Chạy `pnpm test` + `pnpm typecheck` trước mỗi commit của task.
- Chữ tiếng Việt; câu trong spec 6.9 là chữ đã chốt (biểu ngữ, "Mùa Noel đã kết thúc, cảm ơn bạn!", "Đã ngừng tạo cây mới từ 26/12", câu trung thực ở 6.9.2).

## Review Focus

1. `/api/config` lỗi mạng (status 0) hoặc 5xx → **không** được hiện trang kết thúc; giữ hành vi cũ. → test ở Task 2.
2. Trang mở từ trước 0h 01/01 (config đã lưu `phase: 'NOTICE'`), sau đó một API trả 410 `service_ended` → chuyển sang trang kết thúc; một 410 có mã khác thì không. → test ở Task 2.
3. `/quan-tri` ở ENDED vẫn vào được (không nằm trong `AppShell`). → test ở Task 2.
4. `cleanup` ném lỗi (CSDL hỏng) → hẹn giờ vẫn chạy lần sau, log chỉ `{ name, code }`, server không dừng. → test ở Task 1.
5. Config chưa tải xong (`null`) → trang chủ vẫn hiện "Bắt đầu tạo cây" như hiện nay (không nhấp nháy mất nút ở BUILD/OPEN); chỉ ẩn khi biết chắc phase không cho ghi. → test ở Task 2.

---

### Task 1: Dọn bảng định kỳ (server)

**Files:**
- Create: `apps/server/src/cleanup.ts`
- Modify: `apps/server/src/index.ts` (bật hẹn giờ sau `app.listen`)
- Test: `apps/server/test/cleanup.test.ts`
- Docs: `apps/server/src/db/README.md` hoặc README gần nhất nếu có mục về bảng — thêm 1 dòng về dọn bảng.

**Interfaces:**
- Produces:
  - `export type CleanupResult = { rateCounters: number; authAttempts: number; adminSessions: number }`
  - `export async function cleanup(db: Db, at: Date): Promise<CleanupResult>` — `Db` từ `./db/client.js`.
  - `export function startCleanup(opts: { db: Db; now: () => Date; log: { info(o: object, m: string): void; error(o: object, m: string): void }; everyMs?: number }): () => void` — chạy ngay một lần rồi mỗi `everyMs` (mặc định `3_600_000`), timer `.unref()`, trả hàm dừng. Lỗi: `log.error({ name, code }, 'dọn bảng lỗi')`; có dòng bị xoá: `log.info(result, 'đã dọn bảng')`.

- [ ] **Step 1: Viết test thất bại** `apps/server/test/cleanup.test.ts` (PGlite: `connectPglite` + `runMigrations`, như `security.test.ts`; `at = new Date('2026-12-10T12:00:00Z')`):
  - `rate_counters`: chèn `('msg:ip:a', at−23h)`, `('msg:ip:a', at−25h)`, `('pin:tree:abcd2345', at−23h)`, `('pin:tree:abcd2345', at−25h)` → sau `cleanup` còn đúng 2 dòng 23h; kết quả `rateCounters === 2`.
  - `auth_attempts`: `created_at` = at−6 ngày và at−8 ngày (`tree_id` null, `method 'admin'`) → còn dòng 6 ngày; `authAttempts === 1`.
  - `admin_sessions`: một hết hạn (`expires_at = at−1m`), một bị thu hồi (`revoked_at` đặt, còn hạn), một còn hạn → còn đúng dòng còn hạn; `adminSessions === 2` (cần một dòng `admin_users` trước).
  - Không đổi: đếm dòng `events`, `error_counts`, `owner_sessions` trước/sau bằng nhau (chèn 1 dòng mỗi bảng, cũ hơn 30 ngày).
  - Gọi `cleanup` lần hai → mọi số `0`, không ném.
  - `startCleanup` với `db` giả có `delete` ném `Object.assign(new Error('boom'), { code: '57P01' })`, `everyMs: 20`, `log` giả: sau ~70 ms `log.error` được gọi ≥ 2 lần với đúng `{ name: 'Error', code: '57P01' }` (không có `message`); gọi hàm dừng rồi chờ thêm → không gọi thêm.
- [ ] **Step 2: Chạy** `pnpm --filter @ctln/server test -- cleanup` → FAIL (không có module).
- [ ] **Step 3: Cài `cleanup` và `startCleanup`** theo quy tắc 6.9.3: `rate_counters.window_start < at − 1 ngày`; `auth_attempts.created_at < at − 7 ngày`; `admin_sessions` có `expires_at < at` hoặc `revoked_at IS NOT NULL`. Đếm bằng `.returning()`. `startCleanup` không để lời hứa bị từ chối lọt ra ngoài (bắt trong hàm chạy mỗi lượt).
- [ ] **Step 4: Nối vào `index.ts`:** sau khi `app.listen` thành công gọi `startCleanup({ db: db.db, now, log: app.log })`. Không đụng `buildApp`.
- [ ] **Step 5: Chạy** `pnpm --filter @ctln/server test` và `pnpm typecheck` → PASS.
- [ ] **Step 6: Commit** `feat(server): dọn rate_counters, auth_attempts, admin_sessions mỗi giờ (đặc tả 6.9.3)`.

### Task 2: NOTICE / ENDED phía web (+ `purgeAt` ở server)

**Files:**
- Modify: `apps/server/src/routes/config.ts` (thêm `purgeAt`), test `apps/server/test/app.test.ts` (ca `/api/config ở BUILD` kiểm thêm `purgeAt`).
- Modify: `apps/web/src/lib/api.ts` (`AppConfig.purgeAt: string`; `request()` báo 410 `service_ended`).
- Create: `apps/web/src/lib/ended.ts`, `apps/web/src/ui/PhaseBanner.tsx`, `apps/web/src/routes/EndedPage.tsx`, `apps/web/src/lib/dates.ts` (nếu chưa có hàm định dạng ngày giờ VN — kiểm `lib/` trước, có thì dùng lại).
- Modify: `apps/web/src/App.tsx` (layout route `AppShell`), `apps/web/src/routes/Home.tsx`, `apps/web/src/routes/CreatePage.tsx`, `apps/web/src/guest/GuestTree.tsx` (2 chỗ `Tạo cây của bạn`, dòng ~286 và ~295), `apps/web/src/styles/app.css`.
- Test: `apps/web/src/App.test.tsx` (mới hoặc mở rộng nếu có), `Home.test.tsx`, `CreatePage.test.tsx`, `GuestTree.test.tsx`, `apps/web/src/lib/api.test.ts` (nếu có; không thì đặt ca 410 trong `App.test.tsx`).

**Interfaces:**
- Consumes: `useConfig()` (`lib/config.ts`), `canWrite(phase)` (`guest/slots.ts`).
- Produces:
  - Server `/api/config` thêm `purgeAt: string` (ISO, từ `milestones().purgeAt`).
  - `lib/ended.ts`: `markServiceEnded(): void`, `useServiceEnded(): boolean`, `resetServiceEndedForTest(): void`. `request()` gọi `markServiceEnded()` khi `res.status === 410 && code === 'service_ended'` rồi vẫn ném `ApiError` như cũ.
  - `PhaseBanner(): JSX.Element | null` — chỉ hiện khi `config?.phase === 'NOTICE'`; `role="status"`.
  - `EndedPage(): JSX.Element` — tiêu đề "Mùa Noel đã kết thúc, cảm ơn bạn!", ngày xoá từ `purgeAt` (nếu config có), `SupportHint`, link `/chinh-sach`.
  - `AppShell()` trong `App.tsx`: `ended = useServiceEnded() || config?.phase === 'ENDED'` → `<EndedPage />`, không thì `<PhaseBanner /><Outlet />`. Con của nó: `/`, `/tao`, `/c/:id`, `*`. `/quan-tri/*` và `/chinh-sach` (Task 3) nằm **ngoài** `AppShell`.

- [ ] **Step 1: Server — test + cài `purgeAt`** trong `/api/config` (giá trị mặc định `2027-01-06T17:00:00.000Z`). Chạy test server → PASS. (Một bước vì chỉ một dòng.)
- [ ] **Step 2: Viết test web thất bại:**
  - `App.test.tsx` (render `createMemoryRouter(routes, …)`, mock `fetch` / `api.getConfig`):
    - config `phase: 'NOTICE'` ở `/` → có `role=status` chứa "ngừng hoạt động hết 31/12" và "07/01/2027"; ở `BUILD`/`OPEN` → không có.
    - config `phase: 'ENDED'` ở `/` và `/c/abcd2345` → heading "Mùa Noel đã kết thúc, cảm ơn bạn!", có link `/chinh-sach`.
    - config `ENDED` ở `/quan-tri` → **không** có heading kết thúc (Review Focus 3).
    - `getConfig` ném `ApiError(0,'network',…)` → không có heading kết thúc (Review Focus 1).
    - config `NOTICE` ở `/`, rồi gọi `request('GET','/api/trees/x')` với fetch trả 410 `{error:{code:'service_ended'}}` → heading kết thúc xuất hiện; với 410 `code:'gone_other'` → không (Review Focus 2).
  - `Home.test.tsx`: config `NOTICE` → không có link "Bắt đầu tạo cây", vẫn có "Bạn đã có cây?"; config chưa trả (promise treo) → có link (Review Focus 5).
  - `CreatePage.test.tsx`: config `NOTICE` → có "Đã ngừng tạo cây mới từ 26/12" + link về `/`, không có nút "Tạo cây".
  - `GuestTree.test.tsx`: phase `NOTICE` → không có link "Tạo cây của bạn"; `OPEN` → có.
- [ ] **Step 3: Chạy** `pnpm --filter @ctln/web test` → các ca mới FAIL.
- [ ] **Step 4: Cài** theo Interfaces. Home / CreatePage dùng `useConfig()?.phase` và `canWrite`; `null` coi như được phép. Biểu ngữ không che phòng: nằm trong luồng trang, trên cùng; người làm chọn CSS (dùng biến màu sẵn có trong `base.css`).
- [ ] **Step 5: Chạy** `pnpm test` và `pnpm typecheck` → PASS. `pnpm --filter @ctln/web build` → gói chính ≤ 250 KB gzip (ghi số).
- [ ] **Step 6: Commit** `feat(web): biểu ngữ NOTICE, đóng lối tạo cây, trang kết thúc ENDED (đặc tả 6.9.1)`.

### Task 3: Trang chính sách `/chinh-sach`

**Files:**
- Create: `apps/web/src/routes/PolicyPage.tsx`, `apps/web/src/routes/PolicyPage.test.tsx`
- Modify: `apps/web/src/App.tsx` (route lazy, ngoài `AppShell`), `apps/web/src/routes/Home.tsx` (link chân trang), `apps/web/src/routes/EndedPage.tsx` (đã có link từ Task 2), `apps/web/src/styles/app.css`.

**Interfaces:**
- Consumes: `useConfig()` (`supportEmail`, `purgeAt`), `AppShell` từ Task 2.
- Produces: `export function PolicyPage(): JSX.Element`; route `{ path: '/chinh-sach', lazy: () => import('./routes/PolicyPage').then((m) => ({ Component: m.PolicyPage })) }`.

- [ ] **Step 1: Viết test thất bại** `PolicyPage.test.tsx`:
  - heading "Chính sách riêng tư"; có các mục "Lưu gì", "Ai thấy gì", "Giữ bao lâu", "Lưu trên trình duyệt", "Liên hệ".
  - chứa "không lưu email", "7 ngày", "07/01/2027", "không mã hoá đầu-cuối".
  - config có `supportEmail: 'hotro@x.vn'` → link `mailto:hotro@x.vn`.
  - `Home.test.tsx`: chân trang có link "Chính sách riêng tư" tới `/chinh-sach`.
- [ ] **Step 2: Chạy** test web → FAIL.
- [ ] **Step 3: Viết trang** với nội dung đúng 6.9.2 (từng gạch đầu dòng thành một đoạn ngắn; câu trung thực giữ nguyên ý: dữ liệu không mã hoá đầu-cuối, người vận hành có quyền truy cập máy chủ về kỹ thuật vẫn có thể xem CSDL, trang quản trị không có chức năng đọc lời nhắn, người vận hành cam kết không xem). Ngày xoá lấy từ `purgeAt`, có giá trị dự phòng "07/01/2027" khi config chưa tải. Nút "‹ Về trang chủ".
- [ ] **Step 4: Chạy** `pnpm test`, `pnpm typecheck`, `pnpm --filter @ctln/web build` → PASS, `PolicyPage` là file JS riêng trong `dist/assets`, gói chính vẫn ≤ 250 KB gzip.
- [ ] **Step 5: Commit** `feat(web): trang chính sách riêng tư /chinh-sach (đặc tả 6.9.2)`.

### Task 4: Playwright 3 luồng + CSP

**Files:**
- Create: `e2e/playwright.config.ts`, `e2e/global-setup.ts`, `e2e/servers.ts`, `e2e/flows.spec.ts`, `e2e/README.md`
- Modify: `package.json` gốc (`devDependencies`: `@playwright/test`, `postgres`; script `"e2e": "playwright test -c e2e"`), `.gitignore` (`e2e/.out/`, `test-results/`, `playwright-report/`), `README.md` (một dòng về `pnpm e2e`).

**Interfaces:**
- Consumes: `apps/server/dist/index.js` + `apps/web/dist` (bản build); route và chữ từ Task 2–3.
- Produces: `e2e/servers.ts` xuất `export const SERVERS = { build: { port: 4101, fakeNow: '2026-12-01T10:00:00+07:00' }, open: { port: 4102, fakeNow: '2026-12-24T08:00:00+07:00' }, notice: { port: 4103, fakeNow: '2026-12-27T10:00:00+07:00' }, ended: { port: 4104, fakeNow: '2027-01-02T10:00:00+07:00' } } as const` và `url(phase: keyof typeof SERVERS, path: string): string`.

- [ ] **Step 1: Cài** `pnpm add -Dw @playwright/test postgres` và `pnpm exec playwright install chromium`.
- [ ] **Step 2: `global-setup.ts`:**
  - Kiểm `apps/server/dist/index.js` và `apps/web/dist/index.html` tồn tại; thiếu → ném lỗi "Chạy `pnpm build` trước" (không tự build).
  - Nối `E2E_ADMIN_DB_URL` (mặc định `postgres://ctln:ctln_dev@localhost:5432/caythong`); không nối được → ném lỗi "Bật Postgres: `pnpm db:up`". `DROP DATABASE IF EXISTS caythong_e2e WITH (FORCE)` rồi `CREATE DATABASE caythong_e2e`.
  - Xoá và tạo `e2e/.out/photos`.
- [ ] **Step 3: `playwright.config.ts`:** `webServer` là mảng 4 phần tử, mỗi cái `command: 'node apps/server/dist/index.js'`, `cwd` gốc repo, `url: http://localhost:{port}/api/config`, `reuseExistingServer: false`, `env`: `PORT`, `FAKE_NOW`, `DATABASE_URL=…/caythong_e2e`, `WEB_DIST=apps/web/dist`, `BASE_URL=http://localhost:{port}`, `PHOTO_DIR=e2e/.out/photos`, `PEPPER` / `BLOCK_IP_KEY` là chuỗi thử ≥ 32 ký tự, **không** `NODE_ENV=production`, **không** `GOOGLE_CLIENT_ID`. `projects`: Chromium, `viewport 390×844`, `isMobile: true`, `hasTouch: true`. `workers: 1`, `fullyParallel: false` (các luồng nối tiếp nhau trên cùng dữ liệu). `globalSetup: './global-setup.ts'`.
- [ ] **Step 4: `flows.spec.ts`** (`test.describe.serial`), mỗi page gắn bộ thu `page.on('console')` lọc chữ "Content Security Policy" + `page.addInitScript` ghi `securitypolicyviolation` vào `window.__csp`; `afterEach` kiểm cả hai rỗng:
  1. **BUILD:** context chủ cây: `/tao` (cổng build) → điền tên, chọn PIN `123456` (nhập 2 lần nếu form yêu cầu) → "Tạo cây" → lấy mã cây từ URL/link. Context khách (mới): `/c/{id}` → chạm cây → bong bóng "+" → viết `"Chúc mừng Giáng sinh e2e"` → "Treo lên cây" (qua bước xem trước nếu có) → thấy "Đã treo!". Tải lại trang khách → có phụ kiện trên điểm nhắn, trang không chứa chữ lời nhắn. Response `GET /c/{id}` có `<meta property="og:image"` và header `content-security-policy` chứa `frame-ancestors`.
  2. **OPEN:** context chủ cây (cookie dùng chung giữa các cổng localhost) mở `/c/{id}` ở cổng open → mở quà/lời nhắn → thấy `"Chúc mừng Giáng sinh e2e"`. Context khách ở cổng open → trang không chứa chữ đó.
  3. **NOTICE + ENDED:** cổng notice: `/` có `role=status` chứa "ngừng hoạt động hết 31/12", không có link "Bắt đầu tạo cây"; `/tao` có "Đã ngừng tạo cây mới từ 26/12"; `/c/{id}` có biểu ngữ. Cổng ended: `/` và `/c/{id}` có heading "Mùa Noel đã kết thúc, cảm ơn bạn!"; `/chinh-sach` vẫn mở được.
  Chọn phần tử bằng role / chữ hiển thị; nếu một bước không có nhãn truy cập được (vd. chạm cây trên canvas), thêm `aria-label` vào component thay vì dùng toạ độ — ghi rõ trong commit.
- [ ] **Step 5: Chạy** `pnpm db:up && pnpm build && pnpm e2e` → 3 luồng PASS. Chạy lại lần hai → vẫn PASS (CSDL làm lại sạch).
- [ ] **Step 6: `e2e/README.md`:** cần gì (Docker Postgres, `pnpm build`), lệnh, 4 cổng và giai đoạn, vì sao không có Google; ghi rằng CI ở khối 2 sẽ dùng Postgres dạng service container với cùng `E2E_ADMIN_DB_URL`.
- [ ] **Step 7: Chạy** `pnpm test`, `pnpm typecheck` → PASS (e2e không lọt vào `pnpm test`: Vitest các gói không quét `e2e/`). Commit `test(e2e): Playwright 3 luồng trên bản build + kiểm CSP (đặc tả 6.9.4)`.

### Task 5: Cập nhật tiến độ + danh sách thử tay

**Files:** Modify `docs/tien-do.md`.

- [ ] **Step 1:** Mục "Hiện tại": M4 khối 1 xong trên `m4-khoi1`, số test mới (server / web / shared / art), kích thước gói chính, `pnpm e2e` qua. Thêm mục "M4 khối 1 — thử tay" (chủ dự án): (1) `FAKE_NOW=2026-12-27T10:00:00+07:00` → biểu ngữ ở `/`, `/c/{id}`, `/tao` báo đóng, khách không có "Tạo cây của bạn", vẫn tải được ảnh; (2) `FAKE_NOW=2027-01-02T10:00:00+07:00` → trang kết thúc, `/quan-tri` vẫn vào được; (3) mở trang ở NOTICE, đổi `FAKE_NOW` sang ENDED, khởi động lại server, bấm một thao tác → chuyển trang kết thúc; (4) `/chinh-sach` đọc trên điện thoại; (5) `pnpm e2e`. **Xoá `FAKE_NOW` sau khi thử.** Bài học kỹ thuật mới (nếu có) vào mục tương ứng.
- [ ] **Step 2: Commit** `docs: tiến độ M4 khối 1`.
