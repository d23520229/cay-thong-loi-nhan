// URL CSDL e2e — một chỗ duy nhất, dùng cho cả prepare.mjs (node thuần) và playwright.config.ts.

/** CSDL quản trị để tạo / xoá caythong_e2e (CI đặt E2E_ADMIN_DB_URL). */
export const ADMIN_DB_URL = process.env.E2E_ADMIN_DB_URL ?? 'postgres://ctln:ctln_dev@localhost:5432/caythong';
export const E2E_DB = 'caythong_e2e';

/** @returns {string} cùng máy chủ với ADMIN_DB_URL, đổi tên CSDL thành caythong_e2e. */
export function e2eDbUrl() {
  const u = new URL(ADMIN_DB_URL);
  u.pathname = `/${E2E_DB}`;
  return u.toString();
}
