# Cây Thông Lời Nhắn

Mỗi người có một **căn phòng Noel vẽ màu nước**, tự sắp đồ (cây thông, lò sưởi, cửa sổ, quà, thú cưng). Gửi link cho bạn bè, bạn bè chạm vào cây để **treo lời nhắn** bằng một trong 20 phụ kiện. Đến **0h ngày 24/12** chủ cây mới mở được quà. Dịch vụ chạy đến hết 31/12/2026.

Đặc tả đầy đủ: [`docs/dac-ta-v3.md`](docs/dac-ta-v3.md) · Tiến độ và việc tiếp theo: [`docs/tien-do.md`](docs/tien-do.md)

## Cấu trúc

```
apps/
  web/        React + Vite + TypeScript — trang chính và trang quản trị (/quan-tri)
  server/     Fastify + TypeScript + PostgreSQL (Drizzle) — API, ảnh xem trước, phục vụ bản build web
packages/
  shared/     Dùng chung web + server: catalog.json, hình học tán cây, xếp điểm nhắn (slots), (sắp có) schema Zod
  art/        Mã nguồn đồ hoạ màu nước (SVG) + script xuất WebP và catalog
tools/
  design-canvas/   Mã sinh các bảng thiết kế trên canvas (chỉ để duyệt, không dùng khi chạy)
docs/         Đặc tả, lược đồ cơ sở dữ liệu
```

## Trạng thái hiện tại (16/11/2026)

| Phần | Trạng thái |
|---|---|
| Đặc tả v3 + thiết kế CSDL | Xong |
| Đồ hoạ: 4 dáng tán × 6 màu, 12 thân, 9 phông, 8 lò sưởi, 3 cửa sổ, 2 thảm, 10 quà, 6 thú cưng, 20 phụ kiện treo | Xong, đã xuất WebP trong `apps/web/public/assets` |
| `packages/shared`: catalog, hình học, xếp điểm nhắn | Xong (JS), có kiểm thử; sẽ chuyển TypeScript ở M1 |
| CSS chuyển động (cây, lửa, thú cưng, phụ kiện, hiệu ứng chạm) | Xong, `apps/web/src/styles/room-animations.css` |
| Lược đồ PostgreSQL + kiểm thử trên PGlite | Xong, `apps/server/src/db/migrations/0000_init.sql` |
| Server: khung Fastify, tính giai đoạn | Khung |
| Web: trang chủ, tạo cây, sửa phòng tự do, tự lưu (M2) | Xong (nhánh `m2-frontend`) |
| API, giao diện phòng, bạn bè, chủ cây, quản trị | Chưa làm (M1–M3) |

## Chạy trên máy

Yêu cầu: Node 22, pnpm 9, Docker (cho PostgreSQL).

```bash
pnpm install
cp .env.example .env         # điền PEPPER, GOOGLE_CLIENT_ID, ...
pnpm db:up                   # PostgreSQL 16 trong Docker
pnpm dev                     # web: http://localhost:5173  ·  server: http://localhost:3000
pnpm test                    # kiểm thử tất cả gói
```

Chạy giao diện M2 (tạo cây, trang trí phòng):

1. Mở Docker Desktop.
2. Trong `.env` đặt `BASE_URL=http://localhost:5173` (cổng Vite).
3. `pnpm db:up`, rồi `pnpm dev`.
4. Mở http://localhost:5173 (Vite chuyển `/api` và `/og` sang server cổng 3000).

Đồ hoạ: sửa trong `packages/art/src`, chạy `pnpm art:export` để xuất lại ảnh và `catalog.json`.
