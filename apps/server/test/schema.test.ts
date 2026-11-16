// Chạy lược đồ PostgreSQL trên PGlite (PostgreSQL trong tiến trình) và kiểm tra các ràng buộc chính.
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(fileURLToPath(new URL('../src/db/migrations/0000_init.sql', import.meta.url)), 'utf8');
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sql);
  await db.exec(`insert into trees(id,owner_name,private_key_hash,pin_hash) values('k7m2xq4a','Minh','h','p')`);
  await db.exec(`insert into room_items(tree_id,client_id,item_type,variant,x,y) values('k7m2xq4a','a','tree','main',492,912)`);
});

const rejects = (q: string) => expect(db.exec(q)).rejects.toThrow();

describe('lược đồ', () => {
  it('có 16 bảng', async () => {
    const r = await db.query(`select count(*)::int n from information_schema.tables where table_schema='public'`);
    expect((r.rows[0] as { n: number }).n).toBe(16);
  });
  it('phòng phải có PIN hoặc Google', () => rejects(`insert into trees(id,owner_name,private_key_hash) values('abcdefgh','A','h')`));
  it('mỗi phòng đúng một cây', () => rejects(`insert into room_items(tree_id,client_id,item_type,variant,x,y) values('k7m2xq4a','b','tree','main',1,900)`));
  it('toạ độ trong khung 720x1080', () => rejects(`insert into room_items(tree_id,client_id,item_type,variant,x,y) values('k7m2xq4a','c','gift','red',800,900)`));
  it('một điểm nhắn chỉ một lời nhắn', async () => {
    await db.exec(`insert into messages(tree_id,slot_index,ornament,is_anonymous,content,edit_token_hash,edit_until,device_hash) values('k7m2xq4a',0,'moon',true,'Chúc mừng','t',now(),'d')`);
    await rejects(`insert into messages(tree_id,slot_index,ornament,is_anonymous,content,edit_token_hash,edit_until,device_hash) values('k7m2xq4a',0,'star',true,'hi','t',now(),'d')`);
  });
  it('ẩn danh thì không có tên', () => rejects(`insert into messages(tree_id,slot_index,ornament,is_anonymous,author_name,content,edit_token_hash,edit_until,device_hash) values('k7m2xq4a',1,'star',true,'An','hi','t',now(),'d')`));
  it('xoá phòng xoá sạch dữ liệu con', async () => {
    await db.exec(`delete from trees where id='k7m2xq4a'`);
    const r = await db.query(`select (select count(*) from messages)::int m, (select count(*) from room_items)::int i`);
    expect(r.rows[0]).toEqual({ m: 0, i: 0 });
  });
});
