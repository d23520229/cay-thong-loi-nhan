import { describe, expect, it } from 'vitest';
import appCss from './app.css?raw';
import animCss from './room-animations.css?raw';

const classes = (css: string) =>
  new Set([...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]!));

// Dùng chung có chủ đích: room-animations chỉ thêm thanh cuộn mảnh cho .sheet-body và biến thể .chip.sm (app không dùng).
const SHARED_ON_PURPOSE = ['chip', 'sheet-body'];

describe('CSS', () => {
  it('app.css không trùng tên lớp với room-animations.css (tránh phụ thuộc thứ tự nạp)', () => {
    const anim = classes(animCss);
    const clash = [...classes(appCss)].filter((c) => anim.has(c) && !SHARED_ON_PURPOSE.includes(c));
    expect(clash).toEqual([]);
  });

  it('bong bóng thoại của cây: đám mây kem, chữ nhỏ, hiện/ẩn lặp chu kỳ 3 giây', () => {
    const rule = /\.gs-bubble\s*\{([^}]*)\}/.exec(appCss)?.[1] ?? '';
    expect(rule).toMatch(/font-size:\s*15px/);
    expect(rule).toMatch(/background:\s*#FFF6E5/i);
    expect(rule).toMatch(/animation:\s*gs-bubble-blink 3s[^;]*infinite/);
    expect(rule).not.toMatch(/border:\s*\d/);
    expect(appCss).toMatch(/@keyframes gs-bubble-blink/);
  });
});
