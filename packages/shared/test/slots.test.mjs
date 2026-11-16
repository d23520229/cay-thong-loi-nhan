import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutSlots, SLOT_COUNTS } from '../src/slots.mjs';
import { halfWidthAt, canopyBounds, CX } from '../src/geometry.mjs';

// bề rộng bao ngoài của tán (bỏ qua chỗ lõm giữa các tầng), giống cách slots.js dùng
const envelope = (shape, y) => { let m = 0; for (let t = canopyBounds(shape).top; t <= y; t++) m = Math.max(m, halfWidthAt(shape, t)); return m; };

for (const shape of ['cloud3', 'cloud4', 'puffy', 'snowy']) {
  for (const n of SLOT_COUNTS) {
    test(`${shape} – ${n} điểm: đủ số lượng, nằm trong tán, không trùng`, () => {
      const { slots } = layoutSlots(shape, n);
      assert.equal(slots.length, n);
      for (const p of slots) assert.ok(Math.abs(p.x - CX) <= envelope(shape, p.y + 20) + 1, `điểm (${p.x},${p.y}) ra ngoài tán`);
      const keys = new Set(slots.map((p) => `${p.x},${p.y}`));
      assert.equal(keys.size, n);
    });
  }
}

test('cùng đầu vào cho cùng kết quả', () => {
  assert.deepEqual(layoutSlots('cloud3', 20), layoutSlots('cloud3', 20));
});
