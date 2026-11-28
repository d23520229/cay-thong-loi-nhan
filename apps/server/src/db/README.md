# Cơ sở dữ liệu (PostgreSQL 16)

- `migrations/0000_init.sql` — lược đồ đầy đủ 16 bảng (giống `docs/schema.postgres.sql`).
- File SQL viết tay trong `migrations/` là gốc. Đổi CSDL = thêm file mới (`0001_...sql`), giữ `docs/schema.postgres.sql` khớp.
- `schema.ts` (Drizzle) chỉ để có kiểu khi truy vấn; có test đối chiếu với CSDL. Không dùng `drizzle-kit generate`.
- Chạy migration: `pnpm db:migrate` (script tự viết, ghi lại file đã chạy trong `meta.migrations`).
- Phát triển trên máy: `pnpm db:up` (Docker) rồi đặt `DATABASE_URL` trong `.env`.
- Kiểm thử tự động chạy trên PGlite (không cần cài PostgreSQL): `pnpm --filter @ctln/server test`.
- Dọn bảng mỗi giờ (`src/cleanup.ts`, bật ở `index.ts`): `rate_counters` quá 1 ngày, `auth_attempts` quá 7 ngày, `admin_sessions` hết hạn / bị thu hồi. Thêm khung giới hạn dài hơn 1 ngày thì phải sửa quy tắc (đặc tả 6.9.3).
