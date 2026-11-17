import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalog } from '../lib/catalog';
import { EditorLayout } from './EditorLayout';
import { cameraShift, fitRoom } from './fit';
import { defaultRoom } from './model';
import { createEditorStore } from './store';

function mockMedia(desktop: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 390 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 844 });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
});

const setup = () => {
  const store = createEditorStore(defaultRoom());
  const select = (type: string) =>
    act(() => store.getState().select(store.getState().room.items.find((i) => i.type === type)!.clientId));
  return { store, select };
};

describe('EditorLayout điện thoại (< 900px)', () => {
  beforeEach(() => mockMedia(false));

  it('không có cột trái/phải; có thanh trên và thanh công cụ khi chọn món', () => {
    const { store, select } = setup();
    render(<EditorLayout store={store} topBar={<div>thanh trên</div>} />);
    expect(screen.queryByTestId('col-left')).toBeNull();
    expect(screen.queryByTestId('col-right')).toBeNull();
    expect(screen.getByText('thanh trên')).toBeInTheDocument();
    expect(screen.queryByRole('toolbar')).toBeNull();
    select('gift');
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Kiểu sau')).toBeInTheDocument();
  });

  it('Đổi kiểu mở dải kiểu thay cho thanh công cụ', () => {
    const { store, select } = setup();
    render(<EditorLayout store={store} topBar={null} />);
    select('gift');
    act(() => store.getState().openPanel('variant'));
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.getByText('Xong')).toBeInTheDocument();
  });

  it('chạm nền phòng bỏ chọn', () => {
    const { store, select } = setup();
    const { container } = render(<EditorLayout store={store} topBar={null} />);
    select('gift');
    fireEvent.pointerDown(container.querySelector('[data-bg]')!);
    expect(store.getState().selectedId).toBeNull();
  });

  it('dải che món đang chọn thì dời phòng lên đúng số cameraShift', () => {
    const { store, select } = setup();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = this.dataset.dock !== undefined ? 500 : 0;
      return { top, bottom: top, left: 0, right: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) };
    });
    const { container } = render(<EditorLayout store={store} topBar={null} />);
    select('gift');
    const room = container.querySelector<HTMLElement>('[data-camera]')!;
    expect(room.style.transform).toBe('translateY(0px)');
    act(() => store.getState().openPanel('variant'));
    const it = store.getState().room.items.find((i) => i.type === 'gift')!;
    const v = catalog.items.gift!.variants[it.variant]!;
    const fit = fitRoom(390, 844, 56);
    const expected = cameraShift(it.y - v.ay * it.scale + v.h * it.scale, fit.top, fit.scale, 500);
    expect(expected).toBeGreaterThan(0);
    expect(room.style.transform).toBe(`translateY(-${expected}px)`);
    act(() => store.getState().openPanel(null));
    expect(room.style.transform).toBe('translateY(0px)');
  });
});

describe('EditorLayout máy tính (≥ 900px)', () => {
  beforeEach(() => mockMedia(true));

  it('cột trái có Thêm đồ và Phông nền; cột phải nhắc chạm một món', () => {
    const { store } = setup();
    render(<EditorLayout store={store} topBar={null} />);
    const left = screen.getByTestId('col-left');
    expect(within(left).getByText('Thêm đồ')).toBeInTheDocument();
    expect(within(left).getByText('Phông nền')).toBeInTheDocument();
    expect(within(screen.getByTestId('col-right')).getByText('Chạm một món để chỉnh')).toBeInTheDocument();
  });

  it('chọn món: cột phải có mũi tên, lưới kiểu và thanh công cụ; chọn cây có tab', () => {
    const { store, select } = setup();
    render(<EditorLayout store={store} topBar={null} />);
    select('gift');
    const right = screen.getByTestId('col-right');
    expect(within(right).getByLabelText('Kiểu sau')).toBeInTheDocument();
    expect(within(right).getByRole('toolbar')).toBeInTheDocument();
    expect(within(right).queryByText('Xong')).toBeNull();
    expect(within(right).queryByText('Chạm một món để chỉnh')).toBeNull();
    select('tree');
    expect(within(right).getByRole('tab', { name: 'Dáng' })).toBeInTheDocument();
  });

  it('chạm nền phòng bỏ chọn', () => {
    const { store, select } = setup();
    const { container } = render(<EditorLayout store={store} topBar={null} />);
    select('gift');
    fireEvent.pointerDown(container.querySelector('[data-bg]')!);
    expect(store.getState().selectedId).toBeNull();
  });
});
