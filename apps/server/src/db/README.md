# Cơ sở dữ liệu (PostgreSQL 16)

- `migrations/0000_init.sql` — lược đồ đầy đủ 16 bảng (giống `docs/schema.postgres.sql`).
- M1: viết lại thành schema Drizzle (`schema.ts`), sinh migration bằng `pnpm db:generate`, chạy bằng `pnpm db:migrate`.
- Phát triển trên máy: `pnpm db:up` (Docker) rồi đặt `DATABASE_URL` trong `.env`.
- Kiểm thử tự động chạy trên PGlite (không cần cài PostgreSQL): `pnpm --filter @ctln/server test`.
