import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitPhotoCard } from '../src/card.mjs';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/card');
const svg1 = fs.readFileSync(path.join(SRC, 'christmas_card.svg'), 'utf8');
const svg2 = fs.readFileSync(path.join(SRC, 'christmas_card_2.svg'), 'utf8');
// đếm thẻ <image ngoài <defs>
const imagesOutsideDefs = (s) => (s.replace(/<defs>[\s\S]*?<\/defs>/, '').match(/<image\b/g) || []).length;

test('splitPhotoCard tách đúng nhóm khung', () => {
  const { base, frame } = splitPhotoCard(svg2, svg1);
  for (const s of [base, frame]) {
    assert.ok(s.startsWith('<svg'), 'phải bắt đầu bằng <svg');
    assert.ok(s.trimEnd().endsWith('</svg>'), 'phải kết thúc bằng </svg>');
  }
  assert.equal(imagesOutsideDefs(frame), 1);
  // ảnh khung có mặt trong frame, không còn trong base
  const frameImg = frame.replace(/<defs>[\s\S]*?<\/defs>/, '').match(/base64,([A-Za-z0-9+/=]+)/)[1];
  assert.ok(!svg1.includes(frameImg), 'ảnh trong frame không được là ảnh có sẵn ở mẫu 1');
  assert.ok(!base.includes(frameImg), 'base vẫn còn nhóm khung');
  assert.equal(imagesOutsideDefs(base), imagesOutsideDefs(svg2) - 1);
});
