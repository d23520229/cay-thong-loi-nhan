# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Dự án: Cây Thông Lời Nhắn

## 5. Đọc gì trước khi làm

Theo thứ tự, mỗi phiên mới:

1. **`docs/tien-do.md`** — đang ở mốc nào, việc tiếp theo, quyết định đã chốt, bài học kỹ thuật. **Đọc file này trước tiên.**
2. **`docs/dac-ta-v3.md`** — đặc tả là nguồn sự thật. Mục 3 phạm vi, 7 CSDL, 8 API, 9 luồng, 15 mốc, 18 câu hỏi đã chốt.
3. `README.md` (cấu trúc, cách chạy) và README trong thư mục đang làm (ví dụ `apps/server/src/routes/README.md`).

Nếu code và đặc tả mâu thuẫn: dừng lại, nêu ra, hỏi — không tự chọn.

Khi dùng superpowers: thiết kế mới bổ sung thẳng vào `docs/dac-ta-v3.md`, không tạo file đặc tả riêng trong `docs/superpowers/specs/`. Plan tạm có thể để ở `docs/superpowers/plans/`, nhưng đặc tả vẫn là nguồn sự thật.



## 6. Kỹ thuật

- **Monorepo pnpm**, Node 22. `apps/web` (React 19 + Vite + TS), `apps/server` (Fastify 5 + TS + Drizzle + PostgreSQL 16), `packages/shared` (dùng chung), `packages/art` (nguồn đồ hoạ SVG → WebP), `tools/design-canvas` (chỉ để duyệt thiết kế, không dùng khi chạy).
- **Lệnh:** `pnpm install` · `pnpm db:up` (Postgres trong Docker) · `pnpm dev` · `pnpm test` · `pnpm typecheck` · `pnpm art:export`.
- **Kiểm thử là tiêu chí xong:** `packages/shared` dùng `node --test`; server dùng Vitest + PGlite (không cần Docker). Mọi API mới phải có test. Chạy `pnpm test` trước khi báo xong.
- **Một nguồn sự thật cho toạ độ:** hình tán cây ở `packages/shared/src/geometry.mjs`, xếp điểm nhắn ở `slots.mjs`, danh mục đồ ở `catalog.json` (sinh từ `packages/art`, **không sửa tay**). Web và server cùng import từ đây.
- **Thời gian:** mọi kiểm tra giai đoạn (BUILD / OPEN / NOTICE / ENDED) đi qua `apps/server/src/phase.ts`; không so sánh ngày trực tiếp ở chỗ khác. Thử bằng biến `FAKE_NOW`.
- **Schema:** đổi CSDL bằng migration mới trong `apps/server/src/db/migrations/`, không sửa `0000_init.sql` sau khi đã chạy trên Azure. Giữ `docs/schema.postgres.sql` khớp.
- **Quyền riêng tư:** quản trị viên không đọc được lời nhắn (trừ bản chụp trong báo cáo); khách không thấy lời nhắn của nhau; nội dung khoá đến 0h 24/12 (giờ Việt Nam, UTC+7) — kiểm tra ở server, không chỉ ở giao diện.
- **Ngân sách Azure ~50 USD:** không đề xuất dịch vụ trả phí ngoài App Service B1 + PostgreSQL Flexible B1ms nếu chưa hỏi.
