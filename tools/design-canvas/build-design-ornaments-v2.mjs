import { ornamentSVGSoft as ornamentSVG, slotBubbleSVG, ORNAMENTS } from '../../packages/art/src/animated/ornaments.mjs';
import { canopySVG, trunkSVG, groundShadow, CANOPIES } from './legacy/tree.js';
import { backgroundSVG } from './legacy/background.js';
import { scenesBoard, page, OUT } from './design-common.mjs';
import fs from 'fs';

// ---------- Bảng A: 8 phụ kiện + trạng thái ----------
const bg = `<rect x="-30" y="-6" width="60" height="60" fill="#5DC3C0"/><rect x="-30" y="-6" width="60" height="60" fill="#3E8FB3" opacity=".25"/>`;
const scenes = Object.entries(ORNAMENTS).map(([k, v]) => ({ label: v.name, viewBox: '-30 -6 60 60', svg: bg + ornamentSVG(k, 'filled', 0) }));
const states = [
  ['Điểm trống (khách thấy)', 'Bong bóng trong suốt có dấu +, thở nhẹ. Chạm để treo lời nhắn.', slotBubbleSVG(0)],
  ['Đã có lời nhắn (khách thấy)', 'Chỉ thấy phụ kiện, không thấy nội dung hay tên.', ornamentSVG('ball', 'filled', 0)],
  ['Quà còn gói (chủ cây, trước 24/12)', 'Nhạt màu, có nơ đỏ trên móc. Chưa đọc được.', ornamentSVG('heart', 'locked', 0)],
  ['Chưa đọc (chủ cây, từ 24/12)', 'Sáng lên và lấp lánh, mời bấm vào.', ornamentSVG('star', 'unread', 0)],
  ['Đã đọc', 'Trở lại bình thường.', ornamentSVG('bell', 'read', 0)],
  ['Điểm trống (chủ cây)', 'Mờ hơn, chủ cây không tự nhắn lên cây mình.', slotBubbleSVG(0, true)],
].map(([label, note, svg]) => ({ label, note, viewBox: '-30 -6 60 60', w: 200, h: 200, svg: bg + svg }));
const htmlA = scenesBoard({
  title: 'Phụ kiện treo', heading: 'Phụ kiện treo lời nhắn', color: '#D94B4B',
  intro: 'Người viết chọn 1 trong 20 phụ kiện để treo lời nhắn. Tất cả đều đung đưa nhẹ quanh móc. Chạm vào (chế độ Play) để phụ kiện lắc mạnh. Hàng dưới là các trạng thái của một điểm nhắn.',
  scenes: [...scenes, ...states], w: 1720, sceneW: 140, sceneH: 140,
});
fs.writeFileSync(OUT + 'Phu-kien-treo.dc.html', htmlA);

console.log('ok', htmlA.length);
