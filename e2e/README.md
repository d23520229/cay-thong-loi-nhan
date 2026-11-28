# E2E (Playwright)

3 luồng chính chạy trên **bản build thật** (đặc tả 6.9.4), Chromium khung điện thoại 390×844.

## Chạy

```
pnpm db:up      # Postgres Docker ở localhost:5432
pnpm build      # apps/web/dist + apps/server/dist
pnpm e2e
```

`pnpm e2e` = `node e2e/prepare.mjs` (kiểm bản build, xoá và tạo lại CSDL `caythong_e2e`, dọn `e2e/.out/`) rồi `playwright test -c e2e`. Không nằm trong `pnpm test`.

Dựng CSDL ở `prepare.mjs` chứ không ở `globalSetup`, vì Playwright bật `webServer` **trước** `globalSetup`.

## 4 server, 4 giai đoạn

| Cổng | Giai đoạn | `FAKE_NOW` |
|---|---|---|
| 4101 | BUILD | 01/12 10:00 |
| 4102 | OPEN | 24/12 08:00 |
| 4103 | NOTICE | 27/12 10:00 |
| 4104 | ENDED | 02/01/2027 10:00 |

Cả 4 dùng chung CSDL; cookie không tách theo cổng nên phiên chủ cây tạo ở 4101 dùng được ở 4102. Cấu hình ở `servers.ts`, `playwright.config.ts`; URL CSDL ở `db.mjs`.

**Lưu ý dọn bảng:** mỗi server chạy `cleanup` lúc khởi động theo `FAKE_NOW` của nó, trên cùng một CSDL. Server ENDED (02/01) xoá `rate_counters` / `auth_attempts` mà server BUILD (01/12) ghi. Hiện vô hại vì chỉ dọn lúc khởi động, trước mọi test. Nếu thêm e2e thử khoá PIN / giới hạn tần suất, đừng dựa vào bộ đếm còn sau khi một server khác vừa bật.

## Luồng

1. BUILD: tạo cây bằng PIN → khách treo lời nhắn → khách khác chỉ thấy phụ kiện; `/c/{id}` có `og:image` và CSP `frame-ancestors`.
2. OPEN: chủ cây mở quà đọc được; khách vẫn không.
3. NOTICE: biểu ngữ, không còn lối tạo cây. ENDED: trang kết thúc, `/chinh-sach` vẫn mở.

Mọi trang có vi phạm CSP (console hoặc `securitypolicyviolation`) là trượt.

**Không thử Google** (không đặt `GOOGLE_CLIENT_ID`, không gọi mạng ngoài): CSP cho `accounts.google.com` thử tay sau khi lên Azure.

## CI (khối 2)

Dùng Postgres dạng service container, đặt `E2E_ADMIN_DB_URL` (mặc định `postgres://ctln:ctln_dev@localhost:5432/caythong`) — `prepare.mjs` nối vào đó để tạo `caythong_e2e`.

Kết quả lỗi (trace) ở `e2e/.out/results/`.
