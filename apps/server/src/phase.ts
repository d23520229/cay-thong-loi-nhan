// Giai đoạn dịch vụ do server quyết định theo giờ (không tin giờ của trình duyệt).
// BUILD → OPEN (0h 24/12) → NOTICE (0h 26/12) → ENDED (0h 01/01/2027)

export type Phase = 'BUILD' | 'OPEN' | 'NOTICE' | 'ENDED';

const env = (k: string, d: string) => new Date(process.env[k] || d);

export function milestones() {
  return {
    unlockAt: env('UNLOCK_AT', '2026-12-24T00:00:00+07:00').toISOString(),
    writeClosesAt: env('WRITE_CLOSES_AT', '2026-12-26T00:00:00+07:00').toISOString(),
    serviceEndsAt: env('SERVICE_ENDS_AT', '2027-01-01T00:00:00+07:00').toISOString(),
  };
}

export function now(): Date {
  // FAKE_NOW chỉ dùng khi phát triển / thử nghiệm
  return process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date();
}

export function currentPhase(at: Date = now()) {
  const m = milestones();
  let phase: Phase = 'BUILD';
  if (at >= new Date(m.serviceEndsAt)) phase = 'ENDED';
  else if (at >= new Date(m.writeClosesAt)) phase = 'NOTICE';
  else if (at >= new Date(m.unlockAt)) phase = 'OPEN';
  return {
    now: at,
    phase,
    milestones: m,
    canWrite: phase === 'BUILD' || phase === 'OPEN',
    canRead: phase === 'OPEN' || phase === 'NOTICE',
  };
}
