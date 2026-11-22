import { describe, it, expect } from 'vitest';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { connectPglite } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';

describe('runMigrations', () => {
  it('chạy mọi migration lần đầu, lần hai không chạy lại', async () => {
    const h = await connectPglite();
    expect(await runMigrations(h)).toEqual(['0000_init.sql', '0001_show_message_count.sql', '0002_pin_failed_at.sql', '0003_pin_rate_counters.sql']);
    expect(await runMigrations(h)).toEqual([]);
    await h.close();
  });

  it('có 16 bảng public và bảng meta.migrations', async () => {
    const h = await connectPglite();
    await runMigrations(h);
    await h.transaction(async (c) => {
      const pub = await c.query<{ n: number }>(`select count(*)::int n from information_schema.tables where table_schema='public'`);
      expect(pub[0]!.n).toBe(16);
      const meta = await c.query(`select 1 from information_schema.tables where table_schema='meta' and table_name='migrations'`);
      expect(meta).toHaveLength(1);
    });
    await h.close();
  });

  it('schema.ts khớp bảng và cột thật trong CSDL', async () => {
    const h = await connectPglite();
    await runMigrations(h);
    await h.transaction(async (c) => {
      const tables = await c.query<{ table_name: string }>(`select table_name from information_schema.tables where table_schema='public'`);
      const defs = Object.values(schema).map((t) => getTableConfig(t as PgTable));
      expect(defs.map((d) => d.name).sort()).toEqual(tables.map((t) => t.table_name).sort());
      for (const d of defs) {
        const cols = await c.query<{ column_name: string }>(
          `select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [d.name]);
        expect(d.columns.map((x) => x.name).sort(), d.name).toEqual(cols.map((x) => x.column_name).sort());
      }
    });
    await h.close();
  });
});
