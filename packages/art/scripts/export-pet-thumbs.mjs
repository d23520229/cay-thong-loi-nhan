// Ảnh thu nhỏ thú cưng cho khay "Thêm đồ" (thú cưng trong phòng vẽ bằng SVG động, không dùng ảnh này)
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { petSVGSoft, PETS } from '../src/animated/pets.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../../../apps/web/public/assets/room');
for (const k of Object.keys(PETS)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-70 -180 140 195" width="280" height="390">${petSVGSoft(k).replace('class="pet-hearts"', 'class="pet-hearts" opacity="0"')}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 280 } }).render().asPng();
  await sharp(png).trim({ threshold: 1 }).webp({ quality: 85 }).toFile(path.join(OUT, `pet-${k}.webp`));
}
console.log('pet thumbs ok');
