import { describe, expect, it } from 'vitest';
import { parseTreeRef } from './treeRef';

describe('parseTreeRef', () => {
  it('mã trần, bỏ khoảng trắng và chữ hoa', () => {
    expect(parseTreeRef('  K7M2XQ4A ')).toEqual({ id: 'k7m2xq4a' });
  });
  it('link gửi bạn bè', () => {
    expect(parseTreeRef('https://x.azurewebsites.net/c/k7m2xq4a')).toEqual({ id: 'k7m2xq4a' });
  });
  it('link riêng không có https', () => {
    expect(parseTreeRef('localhost:5173/c/k7m2xq4a#k=AbC_d-1')).toEqual({ id: 'k7m2xq4a', key: 'AbC_d-1' });
  });
  it('không khớp thì null', () => {
    expect(parseTreeRef('k7m2xq4')).toBeNull();
    expect(parseTreeRef('k7m2xq4l')).toBeNull();
    expect(parseTreeRef('')).toBeNull();
  });
});
