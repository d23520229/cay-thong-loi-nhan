// Điểm vào của @ctln/shared.
// Giữ JavaScript (.mjs), kiểu qua JSDoc (đặc tả 6.1). M1 thêm schemas.mjs (Zod).
export { default as catalog } from './catalog.json' with { type: 'json' };
export * from './geometry.mjs';
export { layoutSlots, ornamentScale, SLOT_COUNTS } from './slots.mjs';
export * from './schemas.mjs';
