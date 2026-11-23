// Schema Zod dùng chung cho web và server (đặc tả 8). Danh sách enum lấy từ catalog.json.
// Giữ JavaScript, kiểu suy ra bằng z.infer (xem JSDoc bên dưới).
import { z } from 'zod';
import catalog from './catalog.json' with { type: 'json' };

const { limits } = catalog;
const keys = (o) => /** @type {[string, ...string[]]} */ (Object.keys(o));

/** Chuỗi đã trim, độ dài đếm theo ký tự Unicode (emoji = 1). */
export const text = (min, max) =>
  z
    .string()
    .trim()
    .refine((s) => [...s].length >= min, { message: min === 1 ? 'Không được để trống.' : `Cần ít nhất ${min} ký tự.` })
    .refine((s) => [...s].length <= max, { message: `Tối đa ${max} ký tự.` });

export const RoomItemSchema = z.object({
  clientId: z.string().min(1).max(24),
  type: z.enum(keys(catalog.items)),
  variant: z.string().min(1).max(24),
  x: z.number().min(0).max(catalog.room.w),
  y: z.number().min(0).max(catalog.room.h),
  scale: z.number().min(limits.scaleMin).max(limits.scaleMax),
  flip: z.boolean(),
});

export const TreeConfigSchema = z.object({
  shape: z.enum(keys(catalog.tree.shapes)),
  palette: z.enum(keys(catalog.tree.palettes)),
  trunkShape: z.enum(keys(catalog.tree.trunkShapes)),
  wood: z.enum(keys(catalog.tree.woods)),
  slotCount: z.number().refine((n) => catalog.tree.slotCounts.includes(n), { message: 'Số điểm nhắn không hợp lệ.' }),
});

export const RoomSchema = z.object({
  background: z.enum(keys(catalog.backgrounds)),
  tree: TreeConfigSchema,
  items: z.array(RoomItemSchema),
});

export const CreateTreeBodySchema = z.object({
  ownerName: text(1, limits.nameMax),
  title: text(0, limits.titleMax).optional(),
  recovery: z.discriminatedUnion('type', [
    z.object({ type: z.literal('pin'), pin: z.string().regex(/^\d{6}$/, 'PIN gồm đúng 6 chữ số.') }),
    z.object({ type: z.literal('google'), idToken: z.string().min(1) }),
  ]),
  room: RoomSchema,
  ref: z.string().regex(/^[a-z2-9]{8}$/).optional(),
});

const messageFields = {
  ornament: z.enum(keys(catalog.ornaments)),
  anonymous: z.boolean(),
  authorName: text(1, limits.nameMax).optional(),
  content: text(1, limits.messageMax).refine((s) => (s.match(/\n/g)?.length ?? 0) <= 8, {
    message: 'Lời nhắn dài quá khung thiệp, bớt vài dòng nhé',
  }),
};

/** Ảnh ≤ 3 MB sau giải mã → base64 ~4 MB. */
const photoField = z.string().max(4_200_000);

const checkAuthor = (v, ctx) => {
  if (v.anonymous && v.authorName !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['authorName'], message: 'Lời nhắn ẩn danh không có tên.' });
  }
  if (!v.anonymous && v.authorName === undefined) {
    ctx.addIssue({ code: 'custom', path: ['authorName'], message: 'Vui lòng nhập tên người nhắn.' });
  }
};

export const MessageBodySchema = z
  .object({
    slotIndex: z.number().int().min(0).max(Math.max(...catalog.tree.slotCounts) - 1),
    ...messageFields,
    website: z.string().optional(), // ô bẫy bot (honeypot)
    photo: photoField.optional(), // base64 ảnh WebP/JPEG đã thu nhỏ; server kiểm thật bằng sharp
  })
  .superRefine(checkAuthor);

// photo: chuỗi = thay ảnh, null = gỡ ảnh, không có trường = giữ nguyên.
export const MessageEditSchema = z
  .object({ ...messageFields, photo: photoField.nullable().optional() })
  .superRefine(checkAuthor);

/**
 * Kiểm tra ràng buộc cấp phòng mà schema từng món không diễn tả được.
 * @param {z.infer<typeof RoomSchema>} room
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function validateRoom(room) {
  const fail = (code, message) => ({ ok: false, code, message });
  if (room.items.length > limits.maxItems) {
    return fail('too_many_items', `Phòng chỉ có tối đa ${limits.maxItems} món đồ.`);
  }
  if (room.items.filter((i) => i.type === 'tree').length !== 1) {
    return fail('tree_count', 'Phòng phải có đúng một cây thông.');
  }
  const ids = new Set();
  for (const it of room.items) {
    if (ids.has(it.clientId)) return fail('duplicate_client_id', 'Mã món đồ bị trùng.');
    ids.add(it.clientId);
    if (!Object.hasOwn(catalog.items, it.type)) return fail('unknown_type', 'Loại đồ không hợp lệ.');
    const def = catalog.items[it.type];
    if (!Object.hasOwn(def.variants, it.variant)) return fail('unknown_variant', `Kiểu "${it.variant}" không có cho ${def.name}.`);
    if (def.layer === 'wall' && it.y >= catalog.room.floorY) {
      return fail('wall_only', `${def.name} chỉ đặt được trên tường.`);
    }
    if (def.layer !== 'wall' && it.y < catalog.room.floorY) {
      return fail('floor_only', `${def.name} chỉ đặt được trên sàn.`);
    }
  }
  return { ok: true };
}
