import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { rateCounters } from './db/schema.js';
import type { Db } from './db/client.js';
import type { Env } from './env.js';

export type HmacPurpose = 'link' | 'session' | 'edit' | 'device' | 'ip' | 'admin' | 'csrf';

export function hmac(env: Env, purpose: HmacPurpose, value: string): string {
  return createHmac('sha256', `${env.pepper}:${purpose}`).update(value).digest('hex');
}

export function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

const TREE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export function newTreeId(): string {
  let id = '';
  for (let i = 0; i < 8; i++) id += TREE_ALPHABET[randomInt(TREE_ALPHABET.length)];
  return id;
}

function scryptAsync(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(pin, salt, 32, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(pin, salt);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(pin, Buffer.from(saltB64, 'base64'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function deviceHash(env: Env, deviceId: string): string {
  return hmac(env, 'device', deviceId);
}

/** Ngày theo giờ Việt Nam (UTC+7, không DST), dạng YYYY-MM-DD. */
function ngayVN(at: Date): string {
  return new Date(at.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function ipHash(env: Env, ip: string, at: Date): string {
  const salt = hmac(env, 'ip', ngayVN(at));
  return createHmac('sha256', salt).update(ip).digest('hex');
}

export function ipBlockHash(env: Env, ip: string): string {
  return createHmac('sha256', env.blockIpKey).update(ip).digest('hex');
}

/** Đầu khung chứa `at` (bội của `windowMs`, tính theo UTC). */
export const windowStart = (at: Date, windowMs: number) => new Date(Math.floor(at.getTime() / windowMs) * windowMs);

/** true = còn được phép. Khung = bội của `windowMs` (mặc định 1 giờ, tính theo UTC) chứa `at`. */
export async function rateLimit(db: Db, bucket: string, limit: number, at: Date, windowMs = 3_600_000): Promise<boolean> {
  const rows = await db
    .insert(rateCounters)
    .values({ bucket, windowStart: windowStart(at, windowMs), hits: 1 })
    .onConflictDoUpdate({
      target: [rateCounters.bucket, rateCounters.windowStart],
      set: { hits: sql`${rateCounters.hits} + 1` },
    })
    .returning({ hits: rateCounters.hits });
  return rows[0]!.hits <= limit;
}

/** Trả lại một lượt đã giữ bằng `rateLimit` (cùng `at`, `windowMs`); không xuống dưới 0. */
export async function refundRate(db: Db, bucket: string, at: Date, windowMs = 3_600_000): Promise<void> {
  await db
    .update(rateCounters)
    .set({ hits: sql`greatest(${rateCounters.hits} - 1, 0)` })
    .where(and(eq(rateCounters.bucket, bucket), eq(rateCounters.windowStart, windowStart(at, windowMs))));
}

/** Đầu khung kế tiếp (lúc lượt bị chặn được thử lại). */
export const windowEnd = (at: Date, windowMs: number) => new Date(windowStart(at, windowMs).getTime() + windowMs);
