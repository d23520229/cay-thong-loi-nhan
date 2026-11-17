import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { catalog } from '../lib/catalog';
import {
  AddTray, BackgroundStrip, EditorTopBar, ItemToolbar, TreeStrip, VariantArrows, VariantStrip,
} from './Editor';
import { defaultRoom } from './model';
import { createEditorStore } from './store';

const setup = () => {
  const store = createEditorStore(defaultRoom());
  const idOf = (t: string) => store.getState().room.items.find((i) => i.type === t)!.clientId;
  const select = (t: string) => act(() => store.getState().select(idOf(t)));
  return { store, select };
};

afterEach(cleanup);

describe('Editor controls', () => {
  it('mũi tên kiểu: chỉ hiện khi có món chọn, đổi nhãn khi bấm', async () => {
    const { store, select } = setup();
    render(<VariantArrows store={store} />);
    expect(screen.queryByLabelText('Kiểu sau')).toBeNull();
    select('fireplace');
    expect(screen.getByText('Cổ điển vòm gạch · 1/8')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Kiểu sau'));
    expect(screen.getByText(`${catalog.items.fireplace!.variants.stove!.name} · 2/8`)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Kiểu trước'));
    expect(screen.getByText('Cổ điển vòm gạch · 1/8')).toBeInTheDocument();
  });

  it('thanh công cụ: cây không có Xoá, Đổi kiểu mở tab cây; món khác đổi cỡ, lật, xoá', async () => {
    const { store, select } = setup();
    render(<ItemToolbar store={store} />);
    select('tree');
    expect(screen.queryByLabelText('Xoá')).toBeNull();
    await userEvent.click(screen.getByLabelText('Đổi kiểu'));
    expect(store.getState().panel).toBe('tree');

    select('gift');
    const g = () => store.getState().room.items.find((i) => i.type === 'gift')!;
    const s0 = g().scale;
    await userEvent.click(screen.getByLabelText('To hơn'));
    expect(g().scale).toBeGreaterThan(s0);
    await userEvent.click(screen.getByLabelText('Nhỏ hơn'));
    expect(g().scale).toBeCloseTo(s0);
    const f0 = g().flip;
    await userEvent.click(screen.getByLabelText('Lật'));
    expect(g().flip).toBe(!f0);
    await userEvent.click(screen.getByLabelText('Đổi kiểu'));
    expect(store.getState().panel).toBe('variant');
    await userEvent.click(screen.getByLabelText('Xoá'));
    expect(store.getState().room.items.some((i) => i.type === 'gift')).toBe(false);
  });

  it('dải kiểu: kiểu đang dùng aria-pressed, chạm đổi kiểu, Xong đóng', async () => {
    const { store, select } = setup();
    select('fireplace');
    act(() => store.getState().openPanel('variant'));
    render(<VariantStrip store={store} />);
    const names = Object.values(catalog.items.fireplace!.variants).map((v) => v.name);
    const btns = screen.getAllByRole('button', { name: (n) => names.includes(n) });
    expect(btns).toHaveLength(8);
    expect(btns[0]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(btns[2]!);
    expect(btns[2]).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Xong' }));
    expect(store.getState().panel).toBeNull();
  });

  it('dải kiểu của thú cưng dùng SVG', () => {
    const { store, select } = setup();
    select('pet');
    const { container } = render(<VariantStrip store={store} />);
    expect(container.querySelectorAll('button svg .pet').length).toBeGreaterThan(0);
    expect(container.querySelector('button img')).toBeNull();
  });

  it('dải cây: tab Điểm nhắn chọn 16, tab Màu chọn bảng màu', async () => {
    const { store, select } = setup();
    select('tree');
    render(<TreeStrip store={store} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Điểm nhắn' }));
    await userEvent.click(screen.getByRole('button', { name: '16' }));
    expect(store.getState().room.tree.slotCount).toBe(16);
    expect(screen.getByRole('button', { name: '16' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Màu' }));
    const [key, def] = Object.entries(catalog.tree.palettes)[1]!;
    await userEvent.click(screen.getByRole('button', { name: def.name }));
    expect(store.getState().room.tree.palette).toBe(key);
    await userEvent.click(screen.getByRole('tab', { name: 'Dáng' }));
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  it('phông nền: 9 phông, chọn wood', async () => {
    const { store } = setup();
    render(<BackgroundStrip store={store} />);
    const names = Object.values(catalog.backgrounds).map((b) => b.name);
    expect(screen.getAllByRole('button', { name: (n) => names.includes(n) })).toHaveLength(9);
    await userEvent.click(screen.getByRole('button', { name: catalog.backgrounds.wood!.name }));
    expect(store.getState().room.background).toBe('wood');
    await userEvent.click(screen.getByRole('button', { name: 'Xong' }));
    expect(store.getState().panel).toBeNull();
  });

  it('khay thêm đồ: nhóm theo loại, thêm quà vàng → 8 món', async () => {
    const { store } = setup();
    act(() => store.getState().openPanel('add'));
    render(<AddTray store={store} />);
    expect(screen.getByText('Thêm đồ vào phòng')).toBeInTheDocument();
    for (const t of ['window', 'fireplace', 'rug', 'stack', 'gift', 'pet']) {
      expect(screen.getByRole('heading', { name: catalog.items[t]!.name })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: catalog.items.gift!.variants.gold!.name }));
    expect(store.getState().room.items).toHaveLength(8);
    expect(store.getState().room.items.at(-1)!.variant).toBe('gold');
  });

  it('khay thêm đồ báo "Phòng đã đủ 25 món"', async () => {
    const { store } = setup();
    for (let i = 0; i < 18; i++) act(() => void store.getState().add('gift', 'gold'));
    expect(store.getState().room.items).toHaveLength(25);
    act(() => store.getState().openPanel('add'));
    render(<AddTray store={store} />);
    await userEvent.click(screen.getByRole('button', { name: catalog.items.gift!.variants.gold!.name }));
    expect(screen.getByRole('alert')).toHaveTextContent('Phòng đã đủ 25 món');
  });

  it('thanh trên: nút, trạng thái lưu, nút chính', async () => {
    const { store } = setup();
    let done = 0;
    render(<EditorTopBar store={store} onDone={() => done++} doneLabel="Hoàn tất" saveState="unsaved" />);
    expect(screen.getByText('Chưa lưu')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Thêm đồ/ }));
    expect(store.getState().panel).toBe('add');
    await userEvent.click(screen.getByRole('button', { name: 'Phông nền' }));
    expect(store.getState().panel).toBe('bg');
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tất' }));
    expect(done).toBe(1);
  });
});
