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

  it('bong bóng thoại của cây: đám mây kem, chữ nhỏ, hiện/ẩn lặp chu kỳ 6 giây', () => {
    const rule = /\.gs-bubble\s*\{([^}]*)\}/.exec(appCss)?.[1] ?? '';
    expect(rule).toMatch(/font-size:\s*20px/);
    expect(rule).toMatch(/background:\s*#FFF6E5/i);
    expect(rule).toMatch(/animation:\s*gs-bubble-blink 6s[^;]*infinite/);
    expect(rule).not.toMatch(/border:\s*\d/);
    expect(appCss).toMatch(/@keyframes gs-bubble-blink/);
  });

  it('phụ kiện của mình không có vòng viền vàng (chủ dự án bỏ 21/11)', () => {
    expect(appCss).not.toMatch(/\.is-mine\s*\{/);
  });

  it('bong bóng phóng to từ mép tán và thu về mép tán; thời gian ẩn bằng thời gian hiện', () => {
    const right = /\.gs-bubble--right\s*\{([^}]*)\}/.exec(appCss)?.[1] ?? '';
    const left = /\.gs-bubble--left\s*\{([^}]*)\}/.exec(appCss)?.[1] ?? '';
    expect(right).toMatch(/transform-origin:\s*-29px 50%/);
    expect(left).toMatch(/transform-origin:\s*calc\(100% \+ 29px\) 50%/);
    const kf = /@keyframes gs-bubble-blink\s*\{([\s\S]*?)\n\}/.exec(appCss)?.[1] ?? '';
    // 0–12% phóng ra, 12–50% hiện đủ, 50–62% thu lại, 62–100% ẩn: hiện 38% = ẩn 38%.
    expect(kf).toMatch(/0%,\s*62%,\s*100%\s*\{[^}]*opacity:\s*0[^}]*scale\(0\)/);
    expect(kf).toMatch(/12%,\s*50%\s*\{[^}]*opacity:\s*1[^}]*scale\(1\)/);
  });
});
