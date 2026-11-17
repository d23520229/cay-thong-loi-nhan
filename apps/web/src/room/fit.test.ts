import { describe, expect, it } from 'vitest';
import { cameraShift, fitRoom } from './fit';

describe('fitRoom', () => {
  it('iPhone 390x844 chừa 56px phía trên', () => {
    const f = fitRoom(390, 844, 56);
    expect(f.scale).toBeCloseTo(0.5417, 4);
    expect(f.width).toBe(390);
    expect(f.height).toBe(585);
    expect(f.top).toBe(56);
    expect(f.left).toBe(0);
    expect(f.spareTop).toBe(56);
    expect(f.spareBottom).toBe(203);
  });

  it('máy nhỏ 360x640 vẫn nằm gọn trong màn hình', () => {
    const f = fitRoom(360, 640, 56);
    expect(f.width).toBe(360);
    expect(f.height).toBe(540);
    expect(f.top + f.height).toBeLessThanOrEqual(640);
  });

  it('màn rất nhỏ 320x568 không tràn', () => {
    const f = fitRoom(320, 568, 0);
    expect(f.width).toBeLessThanOrEqual(320);
    expect(f.height).toBeLessThanOrEqual(568);
  });

  it('màn ngang 844x390 căn giữa theo chiều ngang', () => {
    const f = fitRoom(844, 390, 0);
    expect(f.height).toBe(390);
    expect(f.width).toBe(260);
    expect(f.left).toBe(292);
  });

  it('chừa chỗ phía dưới (nút của khách): phòng nhỏ lại, không lọt xuống vùng chừa', () => {
    const f = fitRoom(360, 640, 56, 116);
    expect(f.top).toBe(56);
    expect(f.height).toBeCloseTo(468, 6);
    expect(f.top + f.height).toBeLessThanOrEqual(640 - 116);
    expect(f.spareBottom).toBeGreaterThanOrEqual(116 - 1e-9);
    expect(f.left).toBeCloseTo((360 - f.width) / 2, 6);
  });

  it('đã đủ chỗ phía dưới thì giữ nguyên cách co', () => {
    expect(fitRoom(390, 844, 56, 116)).toEqual(fitRoom(390, 844, 56));
  });
});

describe('cameraShift', () => {
  it('dời phòng lên khi đáy món bị che', () => {
    expect(cameraShift(1000, 56, 0.5, 500)).toBe(68);
  });
  it('không dời khi món đã thoáng', () => {
    expect(cameraShift(600, 56, 0.5, 500)).toBe(0);
  });
});
