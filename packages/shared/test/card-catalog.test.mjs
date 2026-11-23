import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from '../src/catalog.json' with { type: 'json' };

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../apps/web/public/assets');
const near = (got, want, msg) => assert.ok(Math.abs(got - want) <= 0.3, `${msg}: ${got} ≠ ${want} (±0,3)`);

test('catalog.card khớp đặc tả', () => {
  const c = catalog.card;
  assert.ok(c, 'thiếu catalog.card');
  assert.equal(c.w, 2100);
  assert.equal(c.h, 1500);
  assert.equal(c.lines.length, 11);
  near(c.lines[0], 27.0, 'lines[0]');
  near(c.lines[1], 32.0, 'lines[1]');
  near(c.lines[10], 77.2, 'lines[10]');
  const photo = { left: 0.64, top: 54.66, width: 27.75, height: 37.42, angle: -12.19 };
  for (const [k, v] of Object.entries(photo)) near(c.photo[k], v, `photo.${k}`);
  const edge = { x1: 28.52, y1: 38.0, x2: 37.12, y2: 93.71 };
  for (const [k, v] of Object.entries(edge)) near(c.frameEdge[k], v, `frameEdge.${k}`);
  assert.equal(c.frameEdge.gap, 0.4);
  assert.deepEqual(c.text, { left: 29.8, width: 52, fontSize: 2.3, color: '#7a1f2a', firstLine: 1, maxLines: 9 });
  assert.deepEqual(c.date, { left: 79.3, top: 20.1, width: 8.8, height: 5, fontSize: 1.45, color: '#fff6e5' });
  assert.deepEqual(Object.keys(c.assets).sort(), ['photoBg', 'photoFrame', 'plain']);
  for (const a of Object.values(c.assets)) assert.ok(fs.existsSync(path.join(ASSETS, a)), `thiếu file ${a}`);
});
