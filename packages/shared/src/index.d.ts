// Kiểu cho @ctln/shared (nguồn là .mjs + JSDoc). Kiểu dữ liệu suy từ Zod.
import type { z } from 'zod';
import type { RoomItemSchema, TreeConfigSchema, RoomSchema, CreateTreeBodySchema, MessageBodySchema, MessageEditSchema } from './schemas.mjs';

export * from './schemas.mjs';
export * from './geometry.mjs';
export { layoutSlots, ornamentScale, SLOT_COUNTS } from './slots.mjs';
export const catalog: any;

export type RoomItem = z.infer<typeof RoomItemSchema>;
export type TreeConfig = z.infer<typeof TreeConfigSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type CreateTreeBody = z.infer<typeof CreateTreeBodySchema>;
export type MessageBody = z.infer<typeof MessageBodySchema>;
export type MessageEdit = z.infer<typeof MessageEditSchema>;
