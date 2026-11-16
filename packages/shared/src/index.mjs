// Điểm vào của @ctln/shared.
// M1 sẽ chuyển sang TypeScript và thêm: schemas.ts (Zod), types.ts, phases.ts.
export { default as catalog } from './catalog.json' with { type: 'json' };
export * from './geometry.mjs';
export { layoutSlots, ornamentScale, SLOT_COUNTS } from './slots.mjs';
