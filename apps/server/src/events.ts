import { events } from './db/schema.js';
import type { Db } from './db/client.js';

export type EventType =
  | 'tree_created' | 'room_saved' | 'tree_viewed_guest' | 'tree_zoomed'
  | 'compose_opened' | 'message_created' | 'message_edited' | 'message_deleted_by_author'
  | 'message_opened' | 'cta_clicked' | 'image_downloaded';

export async function logEvent(db: Db, type: EventType, treeId?: string): Promise<void> {
  await db.insert(events).values({ type, treeId: treeId ?? null });
}
