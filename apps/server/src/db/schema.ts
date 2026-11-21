// Khai báo kiểu cho truy vấn. Nguồn sự thật của lược đồ là migrations/*.sql (không cần CHECK ở đây).
import { pgTable, bigint, text, boolean, timestamp, smallint, integer, real, doublePrecision, primaryKey } from 'drizzle-orm/pg-core';

const id = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();

export const ownerAccounts = pgTable('owner_accounts', {
  id: id(),
  googleSub: text('google_sub').notNull().unique(),
  displayName: text('display_name'),
  createdAt: createdAt(),
  lastLoginAt: ts('last_login_at'),
});

export const trees = pgTable('trees', {
  id: text('id').primaryKey(),
  ownerAccountId: bigint('owner_account_id', { mode: 'number' }),
  ownerName: text('owner_name').notNull(),
  title: text('title'),
  privateKeyHash: text('private_key_hash').notNull(),
  pinHash: text('pin_hash'),
  background: text('background').notNull().default('night'),
  treeShape: text('tree_shape').notNull().default('cloud3'),
  treePalette: text('tree_palette').notNull().default('teal'),
  trunkShape: text('trunk_shape').notNull().default('straight'),
  trunkWood: text('trunk_wood').notNull().default('oak'),
  slotCount: smallint('slot_count').notNull().default(12),
  roomVersion: integer('room_version').notNull().default(1),
  catalogVersion: integer('catalog_version').notNull().default(1),
  refTreeId: text('ref_tree_id'),
  creatorIpHash: text('creator_ip_hash'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  lastOwnerVisitAt: ts('last_owner_visit_at'),
  showMessageCount: boolean('show_message_count').notNull().default(true),
});

export const roomItems = pgTable('room_items', {
  id: id(),
  treeId: text('tree_id').notNull(),
  clientId: text('client_id').notNull(),
  itemType: text('item_type').notNull(),
  variant: text('variant').notNull(),
  x: doublePrecision('x').notNull(),
  y: doublePrecision('y').notNull(),
  scale: real('scale').notNull().default(1),
  flip: boolean('flip').notNull().default(false),
});

export const ownerSessions = pgTable('owner_sessions', {
  id: id(),
  treeId: text('tree_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  method: text('method').notNull(),
  createdAt: createdAt(),
  lastSeenAt: ts('last_seen_at'),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
});

export const messages = pgTable('messages', {
  id: id(),
  treeId: text('tree_id').notNull(),
  slotIndex: smallint('slot_index').notNull(),
  ornament: text('ornament').notNull(),
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  authorName: text('author_name'),
  content: text('content').notNull(),
  editTokenHash: text('edit_token_hash').notNull(),
  editUntil: ts('edit_until').notNull(),
  deviceHash: text('device_hash').notNull(),
  ipHash: text('ip_hash'),
  createdAt: createdAt(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
  readAt: ts('read_at'),
});

export const blockedDevices = pgTable('blocked_devices', {
  treeId: text('tree_id').notNull(),
  deviceHash: text('device_hash').notNull(),
  createdAt: createdAt(),
}, (t) => [primaryKey({ columns: [t.treeId, t.deviceHash] })]);

export const authAttempts = pgTable('auth_attempts', {
  id: id(),
  treeId: text('tree_id'),
  ipHash: text('ip_hash').notNull(),
  method: text('method').notNull(),
  success: boolean('success').notNull(),
  createdAt: createdAt(),
});

export const rateCounters = pgTable('rate_counters', {
  bucket: text('bucket').notNull(),
  windowStart: ts('window_start').notNull(),
  hits: integer('hits').notNull().default(0),
}, (t) => [primaryKey({ columns: [t.bucket, t.windowStart] })]);

export const adminUsers = pgTable('admin_users', {
  id: id(),
  googleSub: text('google_sub').unique(),
  email: text('email').notNull(),
  role: text('role').notNull().default('moderator'),
  disabled: boolean('disabled').notNull().default(false),
  createdBy: bigint('created_by', { mode: 'number' }),
  createdAt: createdAt(),
  lastLoginAt: ts('last_login_at'),
});

export const adminSessions = pgTable('admin_sessions', {
  id: id(),
  adminId: bigint('admin_id', { mode: 'number' }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: createdAt(),
  expiresAt: ts('expires_at').notNull(),
  revokedAt: ts('revoked_at'),
});

export const reports = pgTable('reports', {
  id: id(),
  treeId: text('tree_id').notNull(),
  messageId: bigint('message_id', { mode: 'number' }),
  messageSnapshot: text('message_snapshot'),
  reason: text('reason'),
  reporter: text('reporter').notNull(),
  reporterHash: text('reporter_hash'),
  status: text('status').notNull().default('open'),
  resolution: text('resolution'),
  handledBy: bigint('handled_by', { mode: 'number' }),
  handledAt: ts('handled_at'),
  createdAt: createdAt(),
});

export const adminAudit = pgTable('admin_audit', {
  id: id(),
  adminId: bigint('admin_id', { mode: 'number' }),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  note: text('note'),
  createdAt: createdAt(),
});

export const globalBlocks = pgTable('global_blocks', {
  id: id(),
  kind: text('kind').notNull(),
  valueHash: text('value_hash').notNull(),
  reason: text('reason'),
  createdBy: bigint('created_by', { mode: 'number' }),
  createdAt: createdAt(),
  expiresAt: ts('expires_at'),
});

export const bannedWords = pgTable('banned_words', {
  id: id(),
  word: text('word').notNull().unique(),
  action: text('action').notNull().default('mask'),
  createdBy: bigint('created_by', { mode: 'number' }),
  createdAt: createdAt(),
});

export const siteSettings = pgTable('site_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedBy: bigint('updated_by', { mode: 'number' }),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const events = pgTable('events', {
  id: id(),
  type: text('type').notNull(),
  treeId: text('tree_id'),
  createdAt: createdAt(),
});
