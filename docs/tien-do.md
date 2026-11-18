# Tiến độ dự án

> Cập nhật file này mỗi khi xong một việc đáng kể hoặc chốt một quyết định. Mục mới nhất ở trên cùng của phần Nhật ký.

## Hiện tại

- **Ngày cập nhật:** 19/11/2026
- **Mốc đang ở:** M2 xong trên nhánh `m2-frontend` (tách từ `m1-backend`; cả hai chưa gộp vào `main`). M1 backend: 6 nhóm route, 118 test server + 40 test shared (M2 thêm 2 test `googleClientId`, nay 120 test server); đã chạy thử với PostgreSQL 16 thật trong Docker ngày 17/11 (mục 1–9 bên dưới đều đạt); mục 10 làm khi lên Azure.
- **M2 xong** trên nhánh `m2-frontend` (chưa gộp vào `main`): giao diện phòng tự do, 159 test web + 120 test server + 40 test shared (sau thay đổi mất mạng 19/11), typecheck sạch. Bản build JS + CSS ≈ 150 KB gzip (giới hạn 250 KB). Đã chạy thật qua proxy Vite với PostgreSQL trong Docker (18/11): `/` trả HTML, `/api/config` qua proxy, tạo cây 201 với `publicUrl` bắt đầu `http://localhost:5173/c/`, `GET /api/trees/{id}` 200.
- **Việc tiếp theo:** **M3 — bạn bè treo lời nhắn, chủ cây đọc/khoá/đếm ngược, chia sẻ, OG** — chờ chủ dự án duyệt.

### M2 — danh sách thử tay trên trình duyệt (chủ dự án)

Chuẩn bị: Docker Desktop đang chạy, `.env` có `BASE_URL=http://localhost:5173`, `pnpm db:up`, `pnpm dev`, mở http://localhost:5173.

1. Bấm "Bắt đầu tạo cây" → đặt tên, chọn PIN → tạo cây.
2. Trang trí: kéo, phóng to/thu nhỏ, lật, đổi kiểu, thêm/xoá đồ; thử trên điện thoại (hoặc DevTools thiết bị) để thấy dải chọn và mũi tên ‹ ›.
3. Bấm "Hoàn tất" → thấy link công khai và link riêng.
4. Mở link riêng trong tab ẩn danh → vào được phòng với quyền chủ cây.
5. Mở cùng cây ở hai tab, sửa ở cả hai → tab lưu sau thấy bảng xung đột (giữ bản nào).
6. DevTools → Network → Offline, sửa phòng → "Chưa lưu" + "Mất mạng — thay đổi chưa được lưu", không tự thử lại; bật mạng lại rồi sửa tiếp → lưu cả phòng (gồm thay đổi trước).
7. Tắt mạng, sửa rồi bấm "Xong" → vẫn về chế độ Xem, báo "Thay đổi chưa được lưu.", phòng hiện bản server đã lưu; tải lại trang không hỏi gì (không còn nháp).
8. Trang chủ: "Bạn đã có cây?" → mở lại bằng mã cây/link + PIN.

### M1 — đã xong (kế hoạch duyệt 16/11; chi tiết trong file kế hoạch)

Xem đặc tả mục 7, 8.1–8.5, 9.1–9.6 và `apps/server/src/routes/README.md`.

1. Thêm schema Zod vào `packages/shared` (giữ `.mjs`, kiểu qua JSDoc — đặc tả 6.1) → kiểm: 29 test slot vẫn qua, `pnpm typecheck` sạch.
2. Drizzle schema khớp `0000_init.sql` (SQL viết tay là gốc), script `db:migrate` tự viết → kiểm: test PGlite tạo đủ 16 bảng, `schema.ts` khớp CSDL.
3. Tạo phòng + xác thực chủ cây (cookie thiết bị, link riêng, PIN 6 số scrypt + giới hạn dò, Google) → kiểm: test API cho từng cách đăng nhập và khi dò sai PIN.
4. `GET` / `PUT` phòng có `room_version` chống ghi đè → kiểm: test xung đột phiên bản, vượt giới hạn số đồ.
5. Lời nhắn: treo, sửa trong 15 phút cùng thiết bị, gỡ, tối đa 3/thiết bị/phòng, khoá đến 0h 24/12 → kiểm: test với `FAKE_NOW` trước và sau mốc.
6. API chủ cây: đọc, mở, chặn, báo cáo → kiểm: test quyền (khách không đọc được, admin không đọc được).

**Danh sách thử với PostgreSQL thật** (test tự động dùng PGlite). **17/11/2026: mục 1–9 đều đạt** — 4 lời nhắn song song cùng thiết bị → 3 × 201 + 1 × `device_limit`; 10 thiết bị tranh một điểm → 1 × 201 + 9 × `slot_taken`; 2 lần lưu phòng song song → 200 + `version_conflict`; 2 migration cùng lúc trên CSDL trống → một bên chạy 3 file, bên kia "Không có migration mới"; log server không có IP khách hay nội dung lời nhắn. Lưu ý trên Windows: Docker Desktop phải đang chạy và `docker` phải có trong PATH.

1. `pnpm db:up`
2. Tạo `.env` từ `.env.example`; `PEPPER` và `BLOCK_IP_KEY` là chuỗi ngẫu nhiên ≥ 32 ký tự (ví dụ `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
3. `pnpm db:migrate` hai lần: lần 1 liệt kê `0000_init.sql`, `0001_show_message_count.sql`, `0002_pin_failed_at.sql`; lần 2 in "Không có migration mới".
4. `pnpm --filter @ctln/server dev` (server tự chạy migration khi khởi động; khởi động lại không chạy lại).
5. `curl localhost:3000/api/config` → JSON có `"phase":"BUILD"`.
6. Tạo phòng, mong đợi 201 (phòng phải có đúng một cây thông, thiếu cây sẽ trả 400 `tree_count`):
   ```bash
   curl -i -X POST localhost:3000/api/trees -H "content-type: application/json" -H "x-device-id: 11111111-1111-4111-8111-111111111111" -d '{"ownerName":"Thử","recovery":{"type":"pin","pin":"123456"},"room":{"background":"night","tree":{"shape":"cloud3","palette":"teal","trunkShape":"straight","wood":"oak","slotCount":12},"items":[{"clientId":"t","type":"tree","variant":"main","x":492,"y":912,"scale":1,"flip":false}]}}'
   ```
7. Chạy hai lệnh `pnpm db:migrate` cùng lúc trên CSDL trống (tạo database trống riêng rồi đặt `DATABASE_URL` tới nó, không cần xoá volume) để xác nhận khoá advisory: không lệnh nào lỗi, tổng cộng `0000_init.sql` chỉ chạy một lần.
8. **Song song** (cần Postgres thật): 4 lời nhắn đồng thời từ một thiết bị tới 4 điểm khác nhau → đúng 3 × 201 và 1 × 409 `device_limit`.
9. **Song song:** 2 `PUT /api/trees/:id/room` cùng `roomVersion` → một 200, một 409.
10. **Sau khi triển khai Azure:** xác nhận `req.ip` là IP khách thật (gửi một request từ máy biết IP, so băm `ipHash`/`ipBlockHash` trong log tạm hoặc bằng script) và xem định dạng `X-Forwarded-For` thật (có `ip:port` không, có đúng 1 bước proxy không); chỉnh `TRUST_PROXY_HOPS` nếu khác 1.

Chưa làm ở M1: giao diện web (M2–M3), trang quản trị (M3b), OG ảnh (M3), triển khai Azure (M4).

**Việc nhỏ còn lại từ các lượt duyệt M1** (không ảnh hưởng đúng/sai hay riêng tư):
- `clientIp` chưa bỏ cổng của IPv6 dạng `[2001:db8::1]:port` — kiểm ở mục 10 trên.
- M3b: nút "mở khoá PIN" của quản trị phải xoá cả `pin_last_failed_at`.
- Lưu phòng: nếu giao diện dùng lại cùng `clientId` cho món khác loại (cây ↔ món khác) có thể lỗi 500 — ở M2 sinh `clientId` ổn định cho từng món.
- Cửa sổ PIN tính từ lần sai **cuối** (chặt hơn "5 lần / 15 phút" của đặc tả một chút) — chấp nhận.
- Đặc tả mục 10 ghi khoá link riêng "base32", code dùng base64url — đề xuất sửa câu chữ đặc tả.
- Một số test còn có thể bổ sung (thứ tự kiểm tra honeypot, thử khi giai đoạn BUILD cho kiểm duyệt…).

## Lịch mốc

| Mốc | Thời gian | Nội dung | Trạng thái |
|---|---|---|---|
| M0 | 16–18/11 | Đặc tả v3, CSDL, đồ hoạ, khung repo | **Xong** |
| M1 | 18–25/11 | Backend: migration, giai đoạn, xác thực, API phòng + lời nhắn, test | **Xong** (17/11) |
| M2 | 25/11–02/12 | Frontend phòng tự do: kéo thả, xếp lớp, mũi tên ‹ ›, dải chọn, tự lưu | **Xong** (18/11, nhánh `m2-frontend`) |
| M3 | 02–07/12 | Bạn bè treo lời nhắn; chủ cây đọc, khoá, đếm ngược; chia sẻ, OG | |
| M3b | 05–08/12 | Trang quản trị P0 | |
| M4 | 07–10/12 | Hoàn thiện, triển khai Azure (kèm Blob cho ảnh, câu trung thực về riêng tư trong chính sách) | |
| M5 | 10–12/12 | Chạy thử kín | |
| M6 | 15/12 | Ra mắt công khai | |
| M7–M10 | 16/12–07/01/2027 | Theo dõi, mở quà 24/12, thông báo tải ảnh, kết thúc, xoá dữ liệu | |

## Quyết định đã chốt

Không tự thay đổi; muốn đổi thì đề xuất với chủ dự án.

**Sản phẩm**
- Tên: **Cây Thông Lời Nhắn**. Chỉ tiếng Việt. Không kiếm tiền.
- Mỗi điểm nhắn (slot) chứa đúng 1 lời nhắn. Số slot chọn trong 6/9/12/16/20/25/30, mặc định 12, rải đều khắp tán.
- Lời nhắn khoá đến **0h 24/12** (giờ Việt Nam). Người viết chọn ẩn danh hoặc ghi tên. Khách không thấy lời nhắn của nhau.
- Khách chọn 1 trong 20 phụ kiện treo khi viết. Sửa được trong 15 phút, chỉ trên cùng thiết bị. Tối đa 3 lời nhắn/thiết bị/phòng.
- Không bắt buộc đăng nhập. Chủ cây: nhớ thiết bị + **bắt buộc** chọn khôi phục bằng Google hoặc PIN 6 số; link riêng là dự phòng.
- **Phòng tự do:** chủ cây kéo, phóng to/thu nhỏ, lật, đổi kiểu, thêm/xoá đồ. Sửa phòng được đến hết 25/12.
- Phòng mặc định: phông "Đêm ấm", cửa sổ gỗ, lò cổ điển vòm gạch, thảm kẻ đỏ, cây 3 tầng mây xanh ngọc, chồng quà đỏ xanh, 1 hộp quà xanh dương, mèo cam.
- Sửa trên điện thoại: phương án C (mũi tên ‹ › + dải chọn mỏng, camera tự lia). Máy tính: bảng bên cạnh.
- Có trang quản trị `/quan-tri`: đăng nhập Google theo danh sách cho phép, vai trò admin/moderator, không đọc lời nhắn trừ bản chụp báo cáo, có nhật ký và nút tạm dừng khẩn cấp.
- Dịch vụ chạy đến hết 31/12; từ 26/12 hiện thông báo tải ảnh; xoá dữ liệu 07/01/2027.
- Chủ cây vào phòng: mặc định chế độ **"Xem"** (phòng như khách thấy + đếm ngược + số lời nhắn + nút chia sẻ), nút **"Sửa phòng"** mở khung chỉnh sửa.
- **M2 (chốt 18/11, chi tiết đặc tả 6.5):** trang chủ luôn hiện khung giới thiệu + "Bắt đầu tạo cây" + nút "Bạn đã có cây?" (mở lại bằng mã cây/link + PIN hoặc Google); không giới hạn số cây trên một máy; phòng luôn hiện trọn theo chiều rộng (sửa phương án C: camera chỉ dời khi dải chọn che món); lệch phiên bản khi đang sửa → hỏi chủ cây giữ bản nào (không còn hỏi khi mở lại vì không còn nháp); mất mạng: không cố lưu, không nháp cho phòng đã tạo (chốt 19/11) — không tự thử lại, thao tác tiếp theo lưu lại cả phòng, "Xong" chưa lưu được vẫn rời chế độ Sửa và hiện bản server; chỉ `/tao` giữ nháp `draft:new`; dựng theo phương án A (module phòng thuần có test).
- **Hiện số lời nhắn** cho chủ cây (O10): trong app, kèm số mới kể từ lần vào trước; bật/tắt được, mặc định hiện. Không làm thông báo đẩy.

**Đồ hoạ**
- Phong cách màu nước dễ thương (từ ảnh tham khảo của chủ dự án — chỉ học phong cách, không sao chép).
- Font: Amatic SC, Mynerve, Grape Nuts.
- Thân cây nhiều dáng và màu, **không** chậu, không bao tải. Lò sưởi **không** có cột ống khói, 8 dáng khác nhau. 9 phông nền.
- Thú cưng: 6 con của bộ cũ (đã làm mềm viền, thêm vân màu nước). **Đã bỏ mèo xám.**
- Hiệu ứng chạm vào quà và thú cưng phải đa dạng, không lặp một kiểu.

**Kỹ thuật**
- TypeScript, React 19 + Vite, Fastify 5, PostgreSQL 16 + Drizzle, pnpm monorepo.
- Azure: App Service B1 + PostgreSQL Flexible B1ms, credit ~50 USD, ước tính ~35 USD nếu chạy 01/12–07/01. Dev trên máy bằng Docker trước.
- Chạy thử kín 10–12/12, ra mắt 15/12. Tên miền `*.azurewebsites.net`.
- Migration: SQL viết tay là gốc, Drizzle chỉ để có kiểu. `packages/shared` giữ `.mjs` + JSDoc.
- Giới hạn tần suất bằng PostgreSQL, **không Redis**.
- Ảnh tĩnh: **Azure Blob Storage** cùng vùng (đã duyệt, < 1 USD), làm ở M4. Cloudflare không dùng được vì cần tên miền riêng.
- Kế hoạch M1: `docs/superpowers/plans/2026-11-16-m1-backend.md`, thực hiện mỗi bước một subagent.

**Còn mở:** email Google làm quản trị viên đầu tiên (`ADMIN_BOOTSTRAP_EMAIL`) — chủ dự án cung cấp khi triển khai.

## Bài học kỹ thuật (đừng lặp lại)

- **resvg** bị panic với `feDisplacementMap` khi xuất lớp phòng toàn khung ở tỉ lệ 1 hoặc 0.5 → xuất ở **1.5×** (fitTo 1080).
- **sharp:** phải `composite` ra buffer trước rồi mới `extract`, làm ngược sẽ lỗi.
- Lớp vân giấy (`paper`) trên lớp phòng gây **vết trắng loang** → đặt `lite = 0` cho lớp phòng.
- Lớp điểm nhắn (slots) bị đồ trong phòng che khi khách zoom → slots-layer cần `z-index: 1000`.
- Viền sóng tầng tán: các bướu phải **phồng xuống**; tán "puffy" phải vẽ từng quả bóng riêng, nếu không sẽ thủng.
- Slot dồn vào giữa cây là sai → xếp theo hàng trải hết đường bao tán (`canopyBounds`). Test so với đường bao, không so với khía tầng.
- Phụ kiện mặt trăng: vẽ bằng `mask`, không bằng ghép đường.
- **Bộ đếm PIN sai phải giữ chỗ nguyên tử trước khi băm scrypt** (UPDATE ... RETURNING rồi mới so PIN); đọc-rồi-ghi bộ đếm sẽ bị đua và cho dò PIN song song vượt giới hạn.
- **Khoá advisory phải đứng trước mọi DDL** (kể cả `CREATE SCHEMA/TABLE IF NOT EXISTS meta...`), nếu không hai instance khởi động cùng lúc trên DB trống vẫn va nhau.
- **Lưu phòng / đăng lời nhắn:** khoá dòng (`SELECT ... FOR UPDATE`) trong giao dịch trước khi kiểm `room_version` và đếm giới hạn; kiểm-rồi-ghi không khoá thì hai request đồng thời cùng qua.
- **Log request không được chứa IP:** Fastify mặc định ghi `remoteAddress`; đã đè serializer `req` (`reqSerializer` trong `app.ts`), chỉ giữ method + đường dẫn không query.
- **`trustProxy` phải là số bước proxy, không bao giờ là `true`:** `true` lấy mục trái nhất của `X-Forwarded-For` (do khách tự đặt) làm `req.ip`, một header là qua mặt mọi giới hạn theo IP và chặn IP. Dùng `TRUST_PROXY_HOPS` (mặc định 1 cho Azure App Service) và `clientIp(req)` (bỏ `:port`).
- **Không log nguyên `DrizzleQueryError`:** `message`, `query`, `params` chứa nội dung người dùng (lời nhắn, tên, băm). Chỉ log `{ name, code }`.
- **`tsc` không chép file `.sql`:** script `build` phải chép `src/db/migrations` sang `dist/db/migrations`, nếu không `pnpm start` không tìm thấy migration.
- Server dev/migrate nạp `.env` bằng `tsx --env-file-if-exists=../../.env` (Node ≥ 22.9); không có thư viện dotenv.
- **CSS:** class của app không được trùng tên với class trong `room-animations.css` (gom từ canvas thiết kế) — đã từng va chạm lớp panel; đặt tiền tố riêng.
- **jsdom** không có `ResizeObserver`, và sự kiện pointer không có `clientX` → test kéo thả qua controller (`drag.ts`) thay vì bắn sự kiện DOM.
- **React StrictMode** mount hai lần: tự lưu cần dừng trì hoãn (deferred stop), nếu không lần unmount giả sẽ huỷ bộ tự lưu đang chạy.
- "Xong" luôn rời chế độ Sửa; chưa lưu được thì dừng tự lưu trước khi rời (không thì lượt gửi khi gỡ trang vẫn lưu phần mà chế độ Xem đã bỏ) và hiện `lastSaved()` (sửa 19/11).
- `node --test` không nhận thư mục trên mọi máy → dùng glob `"test/*.test.mjs"`.

## Tài nguyên

- **Canvas thiết kế** (duyệt đồ hoạ, không dùng khi chạy): https://claude.ai/artifact/F3Xp3vGQisXLRZziocfvyX — các bảng Main, Bộ cây thông, Phụ kiện treo, Phòng tự do, Bộ phụ kiện. Mã sinh ở `tools/design-canvas/`.
- Đặc tả: `docs/dac-ta-v3.md` · Schema: `docs/schema.postgres.sql` · Bản v2 cũ: `docs/archive/dac-ta-v2.md`.

## Nhật ký

- **19/11/2026** — Mất mạng không cần lưu (chủ dự án chốt, đặc tả 6.5): bỏ nháp `draft:{treeId}`, bỏ hỏi xung đột khi mở lại, bỏ tự thử lại khi lỗi mạng/5xx (5 giây và sự kiện `online`); thao tác tiếp theo lưu lại cả phòng; "Xong" chưa lưu được vẫn về Xem với bản server; mở phòng thì xoá nháp cũ còn sót. Giữ nguyên bảng hỏi 409 khi đang sửa, 429 thử lại sau 60 giây, nháp `/tao`. 159 test web; build ≈ 149 KB gzip.
- **18/11/2026** — Xong M2 frontend (nhánh `m2-frontend`): trang chủ + "Bạn đã có cây?", tạo cây (`/tao`), trang phòng (`/c/:id`) cho chủ cây và khách, trình sửa phòng (kéo/zoom/lật, dải chọn, mũi tên ‹ ›, bảng bên), tự lưu + nháp cục bộ, bảng xung đột phiên bản. 141 test web, 120 test server, 40 test shared, typecheck sạch; build ≈ 145 KB gzip. Quyết định: dựng theo phương án A (module phòng thuần có test); phòng hiện trọn theo chiều rộng; "Bạn đã có cây?" mở lại bằng mã/link + PIN; lệch phiên bản thì hỏi chủ cây giữ bản nào; "Xong" chỉ rời chế độ Sửa khi đã lưu.
- **17/11/2026** — Xong M1 backend: config, trees (tạo/đọc/xoá), auth (thiết bị, link riêng, PIN, Google), room (PUT có `room_version`), messages (treo/sửa/gỡ trong 15 phút), owner (đọc, mở, chặn, báo cáo). 109 test server (Vitest + PGlite) + 40 test shared, typecheck sạch. Quyết định chính: giữ chỗ lượt thử PIN nguyên tử trước khi băm; khoá dòng khi lưu phòng và đăng lời nhắn; log request không chứa IP; migration có khoá advisory. `index.ts` nối thật (env → PostgreSQL → migration → listen), production bắt buộc `DATABASE_URL`. Chưa chạy với PostgreSQL thật vì máy chưa có Docker.
- **16/11/2026** — Chốt đặc tả v3 (phòng tự do, trang quản trị, stack TS/React/Fastify/PostgreSQL). Thiết kế 16 bảng, kiểm trên PGlite (7 test). Dựng monorepo, chuyển đồ hoạ + catalog + slots vào đúng gói (29 test slot). Ghi repo vào `D:\cay-thong-loi-nhan`. Thêm `CLAUDE.md` và file tiến độ này.
