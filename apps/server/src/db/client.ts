import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema.js';

/** Kết nối thô, dùng chung cho cả hai driver (chủ yếu để chạy migration). */
export type RawConn = {
  exec(sql: string): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
};
export type Db = PgDatabase<any, typeof schema>;
export type DbHandle = {
  db: Db;
  transaction<T>(fn: (c: RawConn) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

export function connectPostgres(url: string): DbHandle {
  const sql = postgres(url, { max: 10, ssl: process.env.NODE_ENV === 'production' ? 'require' : false, onnotice: () => {} }); // bỏ NOTICE kiểu "already exists, skipping"
  const wrap = (s: postgres.Sql | postgres.TransactionSql): RawConn => ({
    async exec(text) { await s.unsafe(text); },
    async query<T>(text: string, params: unknown[] = []) {
      return (await s.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as T[];
    },
  });
  return {
    db: drizzlePostgres(sql, { schema }) as unknown as Db,
    transaction: (fn) => sql.begin((tx) => fn(wrap(tx))) as Promise<never>,
    close: () => sql.end(),
  };
}

export async function connectPglite(): Promise<DbHandle> {
  const { PGlite } = await import('@electric-sql/pglite'); // devDependency: chỉ nạp khi dùng trong test
  const pg = new PGlite();
  await pg.waitReady;
  const wrap = (c: { exec(s: string): Promise<unknown>; query<T>(s: string, p?: unknown[]): Promise<{ rows: T[] }> }): RawConn => ({
    async exec(text) { await c.exec(text); },
    async query<T>(text: string, params: unknown[] = []) { return (await c.query<T>(text, params)).rows; },
  });
  return {
    db: drizzlePglite(pg, { schema }) as unknown as Db,
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx as never))),
    close: () => pg.close(),
  };
}
