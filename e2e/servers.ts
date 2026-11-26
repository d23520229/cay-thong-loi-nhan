// 4 server từ bản build, chung CSDL caythong_e2e, mỗi server một giai đoạn (đặc tả 6.9.4).
export const SERVERS = {
  build: { port: 4101, fakeNow: '2026-12-01T10:00:00+07:00' },
  open: { port: 4102, fakeNow: '2026-12-24T08:00:00+07:00' },
  notice: { port: 4103, fakeNow: '2026-12-27T10:00:00+07:00' },
  ended: { port: 4104, fakeNow: '2027-01-02T10:00:00+07:00' },
} as const;

export type Phase = keyof typeof SERVERS;

export const url = (phase: Phase, path: string): string => `http://localhost:${SERVERS[phase].port}${path}`;

export const ADMIN_DB_URL = process.env.E2E_ADMIN_DB_URL ?? 'postgres://ctln:ctln_dev@localhost:5432/caythong';
export const E2E_DB = 'caythong_e2e';
export const e2eDbUrl = (): string => {
  const u = new URL(ADMIN_DB_URL);
  u.pathname = `/${E2E_DB}`;
  return u.toString();
};
