# Tiến độ dự án

> Cập nhật file này mỗi khi xong một việc đáng kể hoặc chốt một quyết định. Mục mới nhất ở trên cùng của phần Nhật ký.

## Hiện tại

- **Ngày cập nhật:** 24/11/2026
- **Thiệp, ảnh kèm, tải ảnh (đặc tả 6.7):** xong, chủ dự án đã thử tay, đã gộp vào `main` (PR #5, #6). Nhánh `fix-luong-sau-m2` (rà soát luồng 22–23/11) đã gộp (PR #4). Số liệu lúc gộp: **413 test web + 207 test server + 42 test shared + 1 test art**, typecheck sạch, build JS + CSS ≈ 158 KB gzip (giới hạn 250 KB).
- **Mốc đang ở:** **M3 xong và đã gộp vào `main`** (PR #3; M1, M2 là PR #1, #2), cùng phần 6.7 thiệp/ảnh. M3 gồm 3 phần (đặc tả 6.6): (1) khách treo lời nhắn, (2) chủ cây đọc & quản lý, (3) chia sẻ + OG.
- **Số liệu lúc xong M3 (21/11):** 290 test web + 136 test server + 40 test shared, typecheck sạch, build JS + CSS ≈ 155 KB gzip (giới hạn 250 KB). Đã chạy thật (21/11): qua Vite + PostgreSQL khách treo → 201, `GET /api/trees/{id}` không có nội dung; server từ bản build (`WEB_DIST=apps/web/dist`, cổng 3001) trả `/c/{id}` có đủ thẻ OG, `/og/{id}.png` PNG 1200×630, `/tao` trả trang, file tĩnh và API chạy. Kế hoạch: `docs/superpowers/plans/2026-11-21-m3-p1-khach-treo-loi-nhan.md`, `docs/superpowers/plans/2026-11-21-m3-p2-p3-chu-cay-chia-se-og.md`.
- **Việc tiếp theo:** **M3b xong trên nhánh `m3b`, chờ duyệt cả nhánh + chủ dự án thử tay** theo danh sách "M3b — thử tay" bên dưới → sửa lỗi nếu có → PR `m3b` vào `main` → M4. Số liệu (24/11): **249 test server + 465 test web + 42 test shared + 1 test art**, typecheck sạch, gói JS chính ≈ 158 KB gzip, gói quản trị tách riêng ≈ 5,7 KB gzip. Kế hoạch + quyết định khi làm: `docs/superpowers/plans/2026-11-24-m3b-quan-tri-google.md`.

### M3b — thử tay (chủ dự án, nhánh `m3b`)

Chuẩn bị: **tắt `pnpm dev` cũ rồi bật lại** (bản đang chạy được bật trước khi `.env` có `GOOGLE_CLIENT_ID` nên chưa có Google và `/api/admin`). `pnpm db:up`, `pnpm dev`, mở http://localhost:5173. Migration `0005_admin_metrics.sql` đã áp dụng sạch trên CSDL Docker có dữ liệu thật (24/11).

1. `/quan-tri`: đăng nhập Google bằng email `ADMIN_BOOTSTRAP_EMAIL` → vào được, thấy Tổng quan. Đăng nhập bằng tài khoản Google khác (phải là *Test user* trong Google Cloud) → "Tài khoản này không có quyền quản trị".
2. Tổng quan: số phòng / lời nhắn / lượt xem khớp dữ liệu; khối Máy chủ có dung lượng CSDL, kho ảnh; p95 hiện sau vài thao tác; để tab mở 1 phút thấy số tự cập nhật.
3. Báo cáo: dùng một cây có lời nhắn đã mở (cần `FAKE_NOW` sau 24/12), chủ cây báo cáo lời nhắn có ảnh → thấy trong hàng đợi kèm chữ và ảnh; thử "Bỏ qua", "Xoá lời nhắn", "Xoá phòng" (mỗi cái trên một báo cáo khác); xem tab "Đã xử lý". **Xoá `FAKE_NOW` sau khi thử.**
4. Tra cứu phòng: dán link riêng (có `#k=`) → chỉ tra theo mã, thanh địa chỉ không có `#k=`; nhập sai PIN 6 lần ở máy khác rồi "Mở khoá PIN"; "Thu hồi mọi phiên" → máy chủ cây phải đăng nhập lại; "Xoá phòng" bắt ghi chú.
5. Nhật ký: thấy đăng nhập, các thao tác ở bước 3–4, "Xem thêm" khi > 50 dòng.
6. Google cho chủ cây: tạo cây chọn "Google" → tạo được, trang xong ghi "Mở cây trên máy khác bằng Google hoặc link riêng"; "Bạn đã có cây?" → Google → vào cây (nhiều cây thì chọn); trong phòng của mình ở máy khác, "Tôi là chủ cây" → Google → vào được; tài khoản Google khác → "Tài khoản này không phải chủ cây." kèm email hỗ trợ.
7. Email hỗ trợ: chân trang chủ có "Cần giúp? …"; bấm mở ứng dụng thư.
8. Điện thoại: `/quan-tri` dùng được (thanh tab trên cùng, bảng thành thẻ).

**Lượt duyệt M3b (24/11):** không có lỗi nặng; đã sửa hết 10 điểm (4 điểm ngay sau duyệt, 6 điểm nhỏ theo yêu cầu chủ dự án): tải lại báo cáo sau xoá phòng / khi lời nhắn đã bị xoá / khi báo cáo không còn; `Cache-Control: no-store` cho API quản trị; Google hết hạn khi chọn cây; xoá lời nhắn từ báo cáo khoá dòng cây trước (tránh deadlock với chủ cây xoá cây — không viết được test vì PGlite một kết nối); phiên quản trị tạo cùng giao dịch với nhật ký login; ảnh phòng ở Tra cứu phòng dùng `/api/admin/trees/:id/room.png` (không tính lượt tải, chạy sau ENDED); đổi tab Báo cáo nhanh không bị phản hồi cũ ghi đè; đăng xuất lỗi mạng thì ở lại và báo lỗi.

**Việc cho M4 (thêm từ M3b):** Google Cloud: thêm địa chỉ Azure vào *Authorized JavaScript origins* và bấm *Publish app*; App Service đặt `GOOGLE_CLIENT_ID`, `ADMIN_BOOTSTRAP_EMAIL`, `SUPPORT_EMAIL`, `ADMIN_AZURE_URL` (link resource group), `DB_QUOTA_GB` đúng dung lượng đã chọn; dọn `error_counts` cùng các bảng khác ngày 07/01/2027.
**Để cuối, nếu chủ dự án muốn:** chặn thiết bị người viết từ báo cáo; đổi link riêng / PIN (O8) — đặc tả 6.8.

### Thiệp, ảnh kèm, tải ảnh — thử tay và việc còn lại (đã gộp vào `main`)

**Thử tay (chủ dự án)** — đã thử xong (24/11).
1. Viết lời nhắn, bấm xem trước: thấy thiệp đúng chữ, tên người gửi, ngày; "Sửa lại" giữ chữ; "Treo lên cây" mới gửi.
2. Gõ quá 9 dòng: hiện cảnh báo, nút xem trước khoá.
3. Chọn ảnh 20 MB: thu nhỏ được, treo được; ảnh lớn hơn 20 MB bị từ chối rõ ràng.
4. Chọn ảnh HEIC trên Chrome Android: chuyển được hoặc báo lỗi dễ hiểu, không treo trang.
5. Xem thiệp toàn màn hình xoay trên điện thoại thật: không tràn màn hình, chạm một lần chỉ đóng một lần.
6. Tải thiệp trên iPhone (bảng chia sẻ, Lưu ảnh) và Android (tải về thư mục Tải xuống).
7. Tải ảnh phòng (chủ cây và khách): file `cay-thong-{mã}.png` có đủ phụ kiện.
8. `FAKE_NOW=2026-12-24T08:00:00+07:00`: chủ cây mở thiệp có ảnh, thấy ảnh; trước 0h 24/12 không có đường nào lấy được ảnh. **Xoá `FAKE_NOW` sau khi thử.**

**Việc cho M4:** tạo Storage Account + vùng chứa `photos` (riêng tư); đặt `AZURE_STORAGE_CONNECTION_STRING` trong App Service (production thiếu biến này thì server không khởi động); thử `azureStore` thật (ghi, đọc, xoá, chép, kể cả thử lại khi tạo vùng chứa lần đầu).
**Việc cho M10:** xoá Storage Account ngày 07/01/2027.

**Cần chủ dự án quyết / đo (để lại)**
- ~~**CẦN QUYẾT:** tải ảnh cũ lỗi khi tác giả mở bảng sửa~~ — **chốt 24/11:** vẫn mở bảng sửa, không có ảnh, kèm thông báo "Chưa tải được ảnh cũ — ảnh vẫn giữ nguyên nếu bạn không đổi"; lưu mà không đổi ảnh thì server giữ ảnh cũ (đã làm ở `2bb556d`). Chấp nhận: lúc đó xem trước hiện thiệp không ảnh, và không bỏ được ảnh cũ (muốn bỏ thì xoá lời nhắn rồi viết lại).
- Đo `GUEST_BOTTOM_RESERVE` (144, ước lượng) và nút tải 28px của khách trên Chrome thật.
- Kiểm thiệp toàn màn hình xoay trên điện thoại thật.
- `schema.test.ts` từng hỏng cả file khi máy bận (chạy riêng thì qua): để ý có chập chờn không.

### M3 — danh sách thử tay (chủ dự án)

Chuẩn bị: thư mục gốc `D:\cay-thong-loi-nhan`, Docker Desktop đang chạy, `pnpm db:up`, `pnpm dev`, mở http://localhost:5173 và tạo một cây. Mở link gửi bạn bè `/c/{mã cây}` trong **cửa sổ ẩn danh** để vào như khách.

**Khách (phần 1)**
1. Cây "nói" bằng bong bóng thoại "Chạm vào cây thông để treo lời nhắn" (cao 2/3 cây, nằm phía không có cây). Chạm cây → phòng zoom mượt (~0,9 giây) cho **thấy trọn cây từ gốc tới ngọn**, khung phòng giữ nguyên cỡ (phần ngoài khung bị che), hiện bong bóng "+" và nút "‹ Về căn phòng".
2. Ở tab chủ cây: "Sửa phòng", kéo cây lệch sang một bên, thu nhỏ (50%) rồi phóng to (160%), lật ngang → "Xong" → tải lại tab khách: bong bóng thoại đổi phía theo cây; zoom lại vẫn thấy trọn cây, bong bóng "+" nằm trên tán.
3. Chạm bong bóng → bảng viết: 20 phụ kiện (mặc định Quả châu), Để tên / Ẩn danh, bộ đếm 0/300. "Treo lên cây" → phụ kiện rơi vào chỗ, báo "Đã treo! Còn 15 phút để sửa".
4. Viết dở rồi bấm ✕ (hoặc Escape) → hỏi "Huỷ lời nhắn đang viết?": "Viết tiếp" giữ chữ, "Huỷ lời nhắn" đóng bảng. Bảng chưa viết gì thì đóng luôn.
5. Chạm lại phụ kiện vừa treo → tiêu đề "Sửa lời nhắn của bạn (còn N phút)"; sửa chữ → "Lưu thay đổi"; mở lại thấy chữ mới; "Xoá lời nhắn" → hộp hỏi lại → điểm thành bong bóng.
6. Treo đủ 3 lời nhắn; lời thứ 4 báo "Mỗi người chỉ treo được 3 lời nhắn trên một cây." trong bảng, chữ còn nguyên.
7. Hai cửa sổ ẩn danh **khác trình duyệt** (vd. Chrome ẩn danh + Edge InPrivate) cùng mở một bong bóng, viết chữ; bên gửi sau thấy "Chỗ này vừa có người treo, chọn chỗ khác nhé", chạm bong bóng khác thì chữ cũ vẫn còn.
8. Chạm hộp quà, chồng quà, thú cưng nhiều lần → mỗi lần một hiệu ứng khác; chạm lò sưởi → bùng lửa (cả khách lẫn chủ cây ở chế độ Xem).
9. Tắt mạng (DevTools → Network → Offline) rồi treo → "Chưa gửi được, thử lại nhé", chữ còn nguyên; bật mạng, bấm lại → treo được.

**Chủ cây (phần 2)** — ở tab chủ cây, chế độ Xem
10. Vào phòng: phòng hiện thẳng (không phóng to từ góc). Góc trên bên phải có "Còn … ngày … giờ"; khối dưới có "N lời nhắn · K mới", nút "🔗 Chia sẻ" và "⋯ Tuỳ chọn" — mở hai bảng này phòng không nảy. Tải lại trang: số "mới" về 0 (đã xem).
11. Cây nói "Chạm vào cây để xem lời nhắn". Chạm cây → phụ kiện hiện bình thường như khách thấy (không nhạt, không nơ); chạm → "Quà còn gói — mở được từ 0h 24/12".
12. "⋯ Tuỳ chọn" → tắt "Hiện số lời nhắn" → số biến mất (tải lại vẫn tắt); bật lại.
13. Đặt `FAKE_NOW=2026-12-24T08:00:00+07:00` trong `.env`, khởi động lại `pnpm dev`: góc trên bên phải "Đã mở quà"; chạm cây → phụ kiện chưa đọc lấp lánh; chạm → thẻ "Lời nhắn từ …" (hoặc "Lời nhắn ẩn danh") có nội dung, giờ treo; "Sau ›" / "‹ Trước" chuyển thẻ; phụ kiện đã đọc hết lấp lánh.
14. Trong thẻ: "Báo cáo" (lý do tuỳ ý) → "Đã gửi báo cáo, cảm ơn bạn"; "Chặn người gửi" → hỏi lại → điểm trống, và cửa sổ khách đó gửi lại bị từ chối; "Xoá" → hỏi lại → điểm trống.
15. Đặt `FAKE_NOW=2026-12-26T00:00:00+07:00`: khách zoom cây vẫn thấy phụ kiện, không còn bong bóng, lời nhắc đổi thành "…xem các lời nhắn đã treo"; chủ cây vẫn đọc được, không còn "Sửa phòng". **Xoá `FAKE_NOW` sau khi thử.**
16. "⋯ Tuỳ chọn" → "Xoá cây này" → hỏi lại → về trang chủ; mở lại link cây → "Không tìm thấy cây này." (thử trên một cây phụ).

**Chia sẻ + OG (phần 3)**
17. "🔗 Chia sẻ" → bảng "Gửi cây cho bạn bè": "Sao chép" → dán ra chỗ khác đúng link; trên điện thoại có "Chia sẻ…" (bảng chia sẻ của máy), "Messenger" mở app Messenger; "Zalo" sao chép link và nhắc dán vào Zalo.
18. Thẻ OG (cần bản build): dừng `pnpm dev`; chạy `pnpm build`; rồi trong PowerShell ở thư mục gốc chạy `$env:WEB_DIST="D:\cay-thong-loi-nhan\apps\web\dist"; $env:BASE_URL="http://localhost:3000"; node apps/server/dist/index.js` (lệnh `start` không đọc `.env`, nên đặt biến trực tiếp). Mở http://localhost:3000/c/{mã cây} → trang chạy như bình thường; mở http://localhost:3000/og/{mã cây}.png → ảnh căn phòng 1200×630; xem mã nguồn trang (Ctrl+U) thấy các thẻ `og:`. Xong bấm `Ctrl+C`, đóng cửa sổ PowerShell đó (biến chỉ có trong cửa sổ đó). (Thử với Zalo/Messenger thật làm khi lên Azure ở M4.)

**Màn hình**
19. DevTools chế độ thiết bị 360×640 và 390×844 (và điện thoại thật nếu được): lời nhắc và khối nút không che phòng nhiều, bảng viết / thẻ lời nhắn cuộn được, bong bóng đủ lớn để chạm.

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
3. `pnpm db:migrate` hai lần: lần 1 liệt kê `0000_init.sql`, `0001_show_message_count.sql`, `0002_pin_failed_at.sql`, `0003_pin_rate_counters.sql`; lần 2 in "Không có migration mới".
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
- ~~`clientIp` chưa bỏ cổng của IPv6 dạng `[2001:db8::1]:port`~~ — đã sửa 19/11 (vẫn xem định dạng thật ở mục 10).
- M3b: nút "mở khoá PIN" của quản trị = xoá các bucket `pin:tree:{id}…` trong `rate_counters` (cột PIN cũ đã bỏ ở 0003, sửa 22/11).
- ~~Lưu phòng: dùng lại `clientId` cho món khác loại (cây ↔ món khác) lỗi 500~~ — đã sửa 19/11: xoá dòng cây cũ mang mã khác trước khi upsert.
- ~~Cửa sổ PIN tính từ lần sai cuối~~ — thay bằng khung 15 phút cố định trong `rate_counters` (22/11).
- ~~Đặc tả mục 10 ghi khoá link riêng "base32"~~ — đã sửa 17/11.
- ~~Thứ tự kiểm tra honeypot~~ — chốt 19/11: honeypot trước chặn theo cây / tần suất / ≤3 thiết bị; đã sửa sơ đồ đặc tả 9.4 + test. Kiểm duyệt ở BUILD đã có test (xoá/chặn chạy ở giờ mặc định BUILD).

**Việc nhỏ còn lại sau rà soát 22/11** (xem `docs/luong-hoat-dong.md` mục 9):
- ~~Người lạ khoá được PIN của chủ cây~~ — đã sửa 22/11: khoá theo phòng + IP (5 / 15 phút) + trần 50 lần sai / phòng / ngày, đếm trong `rate_counters`; migration 0003 bỏ 3 cột PIN cũ.
- ~~CSP mặc định chặn Google~~ — đã sửa 22/11: helmet cho `https://accounts.google.com` ở script/frame/connect/style.
- ~~Trigger `touch_updated_at`~~ — đã bỏ ở migration 0003; `updated_at` chỉ đổi khi lưu phòng / sửa lời nhắn.
- ~~`deviceId` đổi khi trình duyệt chặn storage~~ — đã sửa 22/11: dự phòng cookie `ctln_did`. Còn: `editToken` (M3) cũng sẽ cần chỗ dự phòng tương tự.
- ~~`/mine` trả 403 khi không có lời nhắn~~ — đã sửa 22/11 (404 / 403, so token timing-safe).
- Tạo cây mà mất phản hồi giữa chừng → bấm lại tạo cây thứ hai, cây đầu mồ côi — **chấp nhận** (chủ dự án chốt 22/11).
- ~~`pagehide` lúc đang lưu ra 409 giả~~ — đã sửa 22/11: 409 mà phòng server giống hệt phòng trên máy thì nhận version, không hỏi; 409 thiếu phòng → "Không mở được cây này." thay vì treo.
- Dọn `rate_counters` (M4/M10): chỉ xoá khung đã kết thúc — bucket `pin:tree:` giữ đến khi `window_start` quá 1 ngày, bucket khác quá 1 giờ; dọn thô hằng giờ sẽ xoá khung ngày và đặt lại trần 50 lần sai / phòng / ngày. (Hoặc lưu độ dài khung khi ghi.)
- M4/M5: khi Fastify phục vụ HTML của web, thử header CSP trên `/` và `/c/:id`, gồm cả mặc định của helmet như `frame-ancestors`.
- ~~Trước Azure: chạy `pnpm db:migrate` trên Postgres Docker đã có 0000–0002 để kiểm tra 0003 áp dụng sạch~~ — đã chạy 23/11 trên CSDL Docker có dữ liệu thật (5 cây, 7 lời nhắn): lần 1 chỉ chạy `0003_pin_rate_counters.sql`, lần 2 "Không có migration mới"; còn mỗi cột `pin_hash`, hết trigger và hàm `touch_updated_at`, dữ liệu giữ nguyên; server đọc được cây cũ, PIN sai ghi vào `rate_counters`.
- Rủi ro chấp nhận: một IP có thể dùng hết trần 50 lần sai / ngày của một cây trong khoảng 3 giờ. Chủ cây vẫn còn cookie, link riêng và Google; cách gỡ là nút mở khoá M3b.
- Khi bật IPv6: cân nhắc gom IPv6 theo /64; trần ngày theo cây vẫn chặn lạm dụng.
- Cân nhắc thêm `Secure` cho cookie `ctln_did` khi chạy production.

**Việc nhỏ còn lại từ các lượt duyệt M2** (không ảnh hưởng đúng/sai hay riêng tư):
- ~~Giới hạn lưu phòng~~ — chốt 19/11: nâng **600 lần/giờ/phòng** (đặc tả 6.5, 10); trình duyệt giãn nhịp 60 giây từ lần thứ 540.
- ~~Đã cài TanStack Query nhưng chưa dùng~~ — **gỡ 21/11** (đặc tả 6.6); `/api/config` nay được gọi ở trang khách để lấy giờ server.
- ~~Sheet thiếu `aria-modal`, Escape, giữ tiêu điểm~~ — đã sửa 19/11.
- ~~Lớp trùng giữa `app.css` và `room-animations.css`~~ — đã sửa 19/11: `.strip` → `.ed-strip`, `.field` → `.ed-field` (ô nhập về đúng kiểu tối `.input`; trước đó `.field input` của room-animations đè thành nền kem). Test `styles.test.ts` chặn trùng mới (trừ `.chip`, `.sheet-body` dùng chung có chủ đích).
- ~~Camera dời khi vừa chạm chọn món rồi kéo~~ — đã sửa 19/11: camera đứng yên khi còn giữ món, thả ra mới dời.
- ~~7 test trang phòng chờ thật 1,5 giây~~ — đã chuyển sang đồng hồ giả (file test 15 s → 3,5 s).
- Cần thử tay trên máy thật ở 360×640 và 390×844: viền món đang chọn, thanh trên một hàng, nút khách không che phòng, camera dời khi kéo.

## Lịch mốc

| Mốc | Thời gian | Nội dung | Trạng thái |
|---|---|---|---|
| M0 | 16–18/11 | Đặc tả v3, CSDL, đồ hoạ, khung repo | **Xong** |
| M1 | 18–25/11 | Backend: migration, giai đoạn, xác thực, API phòng + lời nhắn, test | **Xong** (17/11) |
| M2 | 25/11–02/12 | Frontend phòng tự do: kéo thả, xếp lớp, mũi tên ‹ ›, dải chọn, tự lưu | **Xong** (18/11, nhánh `m2-frontend`) |
| M3 | 02–07/12 | Bạn bè treo lời nhắn; chủ cây đọc, khoá, đếm ngược; chia sẻ, OG | **Xong** (21/11, PR #3; thiệp/ảnh PR #5, #6 ngày 24/11) |
| M3b | 05–08/12 | Trang quản trị P0 + Google cho chủ cây | **Xong** (24/11, nhánh `m3b`), chờ thử tay |
| M4 | 07–10/12 | Hoàn thiện, triển khai Azure (kèm Blob cho ảnh, câu trung thực về riêng tư trong chính sách; bật IPv6 inbound cho App Service nếu gói B1 cho phép — kiểm chi phí) | |
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
- **M3 (chốt 21/11, đặc tả 6.6):** chia 3 phần; OG do server ghép bằng `sharp` (ảnh tĩnh, không chữ); server phục vụ bản build + thẻ OG ngay từ M3 (`WEB_DIST`); gỡ TanStack Query; Zalo chưa có nút chia sẻ chính thức (cần Zalo OA) nên sao chép link; huỷ bảng viết có chữ thì hỏi lại.
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

- **Trigger `BEFORE UPDATE` đặt `updated_at := now()`** ghi đè giá trị code đặt, không theo `FAKE_NOW` và chạm cả những UPDATE không phải "sửa" (đếm PIN, giờ ghé thăm) — đã bỏ ở migration 0003; code tự đặt `updated_at`.
- **Khoá theo đối tượng công khai (mã cây) cho phép người lạ khoá chủ:** khoá dò PIN phải theo phòng + IP, trần theo phòng đặt đủ cao (50/ngày).
- **Dữ liệu trong `error.extra` của 409 có thể thiếu** (cây bị xoá giữa chừng) — kiểm hình dạng trước khi dùng.

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
- **Chỉ mục duy nhất một phần** (`uq_one_tree_per_room`) kiểm từng dòng trong `INSERT ... ON CONFLICT` nhiều dòng: xoá dòng cũ có thể va trước khi upsert, đừng trông vào thứ tự dòng.
- **`pnpm test` ở gốc chạy lần lượt từng gói** (`--workspace-concurrency=1`): chạy song song thì test web (jsdom) và server (PGlite, sharp) tranh CPU, vài test web vượt 5 giây.
- **Heredoc trong Git Bash của Claude Code gộp `\\` thành `\`** (đã làm `\a`, `\b` thành ký tự điều khiển BEL/backspace): sửa file có dấu gạch ngược thì dùng công cụ Edit/Write, hoặc `chr(92)` trong script.
- `node --test` không nhận thư mục trên mọi máy → dùng glob `"test/*.test.mjs"`.
- **Chủ dự án gộp PR trên GitHub:** `main` trên máy không tự cập nhật — `git fetch` rồi `git merge --ff-only origin/main` trước khi tách nhánh mới.
- **Lớp hiệu ứng điểm nhắn** không được tên `.ring`/`.drop-in`/`.ornament` trong `app.css` (trùng `room-animations.css`, test chặn) → dùng `gs-ring`/`gs-drop` và đặt hoạt ảnh trên `<svg>` con.

## Tài nguyên

- **Canvas thiết kế** (duyệt đồ hoạ, không dùng khi chạy): https://claude.ai/artifact/F3Xp3vGQisXLRZziocfvyX — các bảng Main, Bộ cây thông, Phụ kiện treo, Phòng tự do, Bộ phụ kiện. Mã sinh ở `tools/design-canvas/`.
- Đặc tả: `docs/dac-ta-v3.md` · Schema: `docs/schema.postgres.sql` · Bản v2 cũ: `docs/archive/dac-ta-v2.md`.

## Nhật ký

- **24/11/2026 (lượt 3)** — M3b xong (nhánh `m3b`): giao diện `/quan-tri` (tải riêng, đăng nhập Google, Tổng quan tự cập nhật 60 giây, Báo cáo, Tra cứu phòng, Nhật ký) và email hỗ trợ (`SUPPORT_EMAIL`: chân trang chủ, khi PIN khoá đến hết ngày, Google không phải chủ cây / chưa có cây, "Không mở được cây này."). 247 test server, 460 test web.
- **24/11/2026 (lượt 2)** — M3b (nhánh `m3b`): xong server quản trị (đăng nhập Google + phiên 12 giờ + CSRF + nhật ký, Tổng quan có khối máy chủ, migration 0005 `photo_bytes` + `error_counts`, báo cáo, tra cứu phòng, nhật ký) và nút Google thật cho chủ cây. Dừng trước Task 7 (web quản trị) để chủ dự án kiểm tra.
- **24/11/2026** — Chủ dự án thử tay xong phần thiệp, ảnh kèm, tải ảnh; đã gộp vào `main` (PR #4 `fix-luong-sau-m2`, PR #5, #6 `thiep-anh-kem`). Chốt: tải ảnh cũ lỗi vẫn mở bảng sửa (không ảnh, có thông báo). Tiếp theo: M3b.
- **23/11/2026** — Xong thiệp lời nhắn, ảnh kèm, tải ảnh (đặc tả 6.7, nhánh `thiep-anh-kem`): lời nhắn 400 ký tự / ≤ 9 dòng (migration 0004), thiệp canvas + xem trước + xem toàn màn hình, ảnh kèm qua `PhotoStore` (fs/Azure/bộ nhớ, EXIF bị bỏ, giới hạn điểm ảnh), chủ cây đọc ảnh sau 0h 24/12, dọn ảnh khi xoá lời nhắn/cây (báo cáo giữ bản chụp), `GET /api/trees/:id/image.png`, phụ kiện hiện khi xem toàn phòng. 413 test web, 207 test server, 42 test shared, 1 test art; build ≈ 158 KB gzip. Chạy thật (Postgres Docker, cổng 3098): treo lời nhắn kèm ảnh → `.data/photos/m/{cây}/{id}-….webp` xuất hiện, xoá lời nhắn → file mất; `curl -I image.png` → 200, `image/png`, `content-disposition: attachment`.
- **22/11/2026** — Rà soát toàn bộ luồng (`docs/luong-hoat-dong.md`) và sửa (nhánh `fix-luong-sau-m2`): `GET /owner` chỉ đọc + `POST /owner/visit` (số lời nhắn mới không còn về 0); giới hạn tạo phòng 20/giờ/IP, lời nhắn 100/giờ/IP, chỉ đếm khi dữ liệu hợp lệ (chủ dự án chấp nhận rủi ro bot, đặc tả 10); "Xong" gặp 409 ở lại chế độ Sửa và hỏi; `pagehide` gửi lưu bằng `keepalive` (nhận version mới nếu thành công, tránh xung đột giả khi quay lại bằng Back); "Bạn đã có cây?" chỉ tự thử khi nhớ đúng 1 cây; bấm lại lựa chọn đang có không lưu; `fitRoom` không ra tỉ lệ âm; `pnpm install` cho typecheck web. 187 test web, 125 test server, 40 test shared.
- **22/11/2026 (lượt 2)** — Sửa nốt: khoá PIN theo phòng + IP trong `rate_counters` (5 / 15 phút, trần 50 lần sai / phòng / ngày) + migration 0003 (bỏ 3 cột PIN và trigger `touch_updated_at`); CSP helmet cho Google Identity; `/mine` 404/403 + so token timing-safe; `deviceId` dự phòng cookie `ctln_did`; thông báo khoá theo giờ khi > 60 phút; 409 mà phòng giống hệt thì không hỏi, 409 thiếu phòng thì báo lỗi rõ. Cây mồ côi khi mất phản hồi: chấp nhận. 198 test web, 131 test server, 40 test shared.
- **21/11/2026** — Sửa hết việc nhỏ từ lượt soát phần 1 + hỏi lại khi huỷ bảng viết (chủ dự án yêu cầu). Xong **M3 phần 2** (chủ cây: đếm ngược theo giờ server, số lời nhắn + số mới, zoom xem quà còn gói / chưa đọc / đã đọc, thẻ lời nhắn có trước/sau, xoá / chặn / báo cáo, tuỳ chọn bật-tắt số lời nhắn, xoá cây; vào trang chỉ gọi `/owner` một lần kể cả StrictMode) và **phần 3** (bảng chia sẻ: sao chép, Web Share, Messenger, Zalo; server ghép ảnh OG 1200×630 bằng `sharp`, lưu đệm; có `WEB_DIST` thì phục vụ bản build, `/c/:id` chèn thẻ OG đã thoát HTML). Thiết kế ở đặc tả 6.6.2, 6.6.3 (người làm tự chốt theo yêu cầu chủ dự án). Lượt soát cuối (agent độc lập): 0 nghiêm trọng, 3 quan trọng + 7 nhỏ — đã sửa hết (giữ trạng thái chủ cây qua Sửa phòng, tự chuyển sang mở quà lúc 0h 24/12, CSP cho phép thử qua http LAN, cảnh báo `WEB_DIST` sai, Tab trong hộp xác nhận, tiêu điểm sau khi xoá, ảnh OG nhẹ hơn ~3 lần + gộp lượt vẽ trùng, trang SPA không nuốt file thiếu, nhận HEAD, bỏ món lạ khi vẽ). Sửa thêm test Scene có `\b` bị ghi thành ký tự backspace từ M2. `pnpm test` nay chạy lần lượt từng gói. 290 test web, 136 test server.

- **21/11/2026** — Thiết kế M3 (đặc tả 6.6): 3 phần nối tiếp, OG do server ghép bằng `sharp`, HTML `/c/:id` có thẻ OG làm ngay ở M3, gỡ TanStack Query. Xong **phần 1 — khách treo lời nhắn** (nhánh `m3`): zoom vào cây, bong bóng "+", bảng viết 20 phụ kiện, treo / sửa / gỡ trong 15 phút (hạn tính theo giờ server), xử lý từng mã lỗi (giữ chữ khi `slot_taken`), giai đoạn không cho ghi thì ẩn bong bóng, cây đầy, hiệu ứng chạm quà / thú cưng / lò sưởi (khách và chủ cây ở chế độ Xem). Không sửa server. 241 test web; build ≈ 151 KB gzip. Lượt soát cuối: sửa 2 lỗi (dọn khoá msg: trước khi có giờ server; đóng bảng khi đang gửi), 6 việc nhỏ để sau (xem dưới).

- **19/11/2026** — Sửa việc nhỏ M1/M2: lưu phòng không còn 500 khi đổi loại món cùng `clientId`; `clientIp` bỏ cổng `[IPv6]:port`; honeypot giữ trước các kiểm tra khác (sửa đặc tả 9.4); giới hạn lưu 600/giờ; Sheet modal có Escape + giữ tiêu điểm; camera không dời khi đang giữ món; bỏ trùng lớp CSS (`.ed-strip`, `.ed-field`); test trang phòng dùng đồng hồ giả. 167 test web, 122 test server, 40 test shared; build ≈ 150 KB gzip.
- **19/11/2026** — Mất mạng không cần lưu (chủ dự án chốt, đặc tả 6.5): bỏ nháp `draft:{treeId}`, bỏ hỏi xung đột khi mở lại, bỏ tự thử lại khi lỗi mạng/5xx (5 giây và sự kiện `online`); thao tác tiếp theo lưu lại cả phòng; "Xong" chưa lưu được vẫn về Xem với bản server; mở phòng thì xoá nháp cũ còn sót. Giữ nguyên bảng hỏi 409 khi đang sửa, 429 thử lại sau 60 giây, nháp `/tao`. 159 test web; build ≈ 149 KB gzip.
- **18/11/2026** — Xong M2 frontend (nhánh `m2-frontend`): trang chủ + "Bạn đã có cây?", tạo cây (`/tao`), trang phòng (`/c/:id`) cho chủ cây và khách, trình sửa phòng (kéo/zoom/lật, dải chọn, mũi tên ‹ ›, bảng bên), tự lưu + nháp cục bộ, bảng xung đột phiên bản. 141 test web, 120 test server, 40 test shared, typecheck sạch; build ≈ 145 KB gzip. Quyết định: dựng theo phương án A (module phòng thuần có test); phòng hiện trọn theo chiều rộng; "Bạn đã có cây?" mở lại bằng mã/link + PIN; lệch phiên bản thì hỏi chủ cây giữ bản nào; "Xong" chỉ rời chế độ Sửa khi đã lưu.
- **17/11/2026** — Xong M1 backend: config, trees (tạo/đọc/xoá), auth (thiết bị, link riêng, PIN, Google), room (PUT có `room_version`), messages (treo/sửa/gỡ trong 15 phút), owner (đọc, mở, chặn, báo cáo). 109 test server (Vitest + PGlite) + 40 test shared, typecheck sạch. Quyết định chính: giữ chỗ lượt thử PIN nguyên tử trước khi băm; khoá dòng khi lưu phòng và đăng lời nhắn; log request không chứa IP; migration có khoá advisory. `index.ts` nối thật (env → PostgreSQL → migration → listen), production bắt buộc `DATABASE_URL`. Chưa chạy với PostgreSQL thật vì máy chưa có Docker.
- **16/11/2026** — Chốt đặc tả v3 (phòng tự do, trang quản trị, stack TS/React/Fastify/PostgreSQL). Thiết kế 16 bảng, kiểm trên PGlite (7 test). Dựng monorepo, chuyển đồ hoạ + catalog + slots vào đúng gói (29 test slot). Ghi repo vào `D:\cay-thong-loi-nhan`. Thêm `CLAUDE.md` và file tiến độ này.
