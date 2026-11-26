import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { url } from './servers';

// 3 luồng chính trên bản build thật (đặc tả 6.9.4). Chạy nối tiếp: luồng sau dùng cây của luồng trước.
const MESSAGE = 'Chúc mừng Giáng sinh e2e';
const ENDED_TITLE = 'Mùa Noel đã kết thúc, cảm ơn bạn!';

let treeId = '';
let owner: BrowserContext;
const pages: Page[] = [];

/** Ghi vi phạm CSP (console + securitypolicyviolation) cho mọi trang mở trong luồng. */
async function track(ctx: BrowserContext): Promise<BrowserContext> {
  await ctx.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  ctx.on('page', (p) => watch(p));
  return ctx;
}
const consoleCsp = new WeakMap<Page, string[]>();
function watch(p: Page) {
  pages.push(p);
  const list: string[] = [];
  consoleCsp.set(p, list);
  p.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) list.push(m.text()); });
}

test.afterEach(async () => {
  for (const p of pages.splice(0)) {
    if (p.isClosed()) continue;
    expect(consoleCsp.get(p), `CSP (console) ở ${p.url()}`).toEqual([]);
    expect(await p.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? []), `CSP ở ${p.url()}`).toEqual([]);
  }
});

const zoomTree = async (p: Page) => {
  await p.locator('[data-type="tree"]').first().click();
  await expect(p.getByRole('button', { name: /Về căn phòng/ })).toBeVisible();
};

test.describe.serial('Cây Thông Lời Nhắn', () => {
  test('BUILD: tạo cây bằng PIN, khách treo lời nhắn', async ({ browser }) => {
    owner = await track(await browser.newContext());
    const op = await owner.newPage();
    await op.goto(url('build', '/tao'));
    await op.getByRole('button', { name: 'Hoàn tất' }).click();
    await op.getByLabel('Tên của bạn').fill('Lan e2e');
    await op.getByLabel('Mã PIN 6 số').fill('123456');
    await op.getByRole('button', { name: 'Tạo cây' }).click();
    await expect(op.getByRole('heading', { name: /Cây của bạn đã sẵn sàng/ })).toBeVisible();
    treeId = (await op.locator('.tree-code').textContent())!.trim();
    expect(treeId).toMatch(/^[a-z2-9]{8}$/);

    // Trang /c/:id do server phục vụ: có thẻ OG và CSP (frame-ancestors).
    const res = await op.request.get(url('build', `/c/${treeId}`));
    expect(await res.text()).toContain('<meta property="og:image"');
    expect(res.headers()['content-security-policy']).toContain('frame-ancestors');

    const guest = await track(await browser.newContext());
    const gp = await guest.newPage();
    await gp.goto(url('build', `/c/${treeId}`));
    await zoomTree(gp);
    await gp.getByRole('button', { name: 'Điểm trống, chạm để treo lời nhắn' }).first().click();
    await gp.getByRole('button', { name: 'Ẩn danh' }).click();
    await gp.getByRole('textbox', { name: /Lời nhắn/ }).fill(MESSAGE);
    await gp.getByRole('button', { name: 'Xem trước thiệp' }).click();
    await gp.getByRole('button', { name: 'Treo lên cây' }).click();
    await expect(gp.getByText('Đã treo! Còn 15 phút để sửa')).toBeVisible();

    // Khách khác chỉ thấy phụ kiện, không thấy chữ.
    const other = await track(await browser.newContext());
    const xp = await other.newPage();
    await xp.goto(url('build', `/c/${treeId}`));
    await zoomTree(xp);
    await expect(xp.getByRole('button', { name: /đã treo$/ })).toHaveCount(1);
    await expect(xp.locator('body')).not.toContainText(MESSAGE);
    await guest.close();
    await other.close();
  });

  test('OPEN: chủ cây mở quà đọc được, khách vẫn không', async ({ browser }) => {
    const op = await owner.newPage(); // cookie localhost dùng chung giữa các cổng
    await op.goto(url('open', `/c/${treeId}`));
    await expect(op.getByText('Đã mở quà')).toBeVisible();
    await zoomTree(op);
    await op.getByRole('button', { name: /^Lời nhắn chưa đọc/ }).first().click();
    const dlg = op.getByRole('dialog', { name: /^Lời nhắn/ });
    await expect(dlg.getByRole('img', { name: new RegExp(MESSAGE) })).toBeVisible();

    const guest = await track(await browser.newContext());
    const gp = await guest.newPage();
    await gp.goto(url('open', `/c/${treeId}`));
    await zoomTree(gp);
    await expect(gp.locator('body')).not.toContainText(MESSAGE);
    await expect(gp.getByRole('img', { name: new RegExp(MESSAGE) })).toHaveCount(0);
    await guest.close();
  });

  test('NOTICE: biểu ngữ, không còn lối tạo cây; ENDED: trang kết thúc', async ({ browser }) => {
    const ctx = await track(await browser.newContext());
    const p = await ctx.newPage();
    await p.goto(url('notice', '/'));
    await expect(p.getByRole('status').filter({ hasText: 'ngừng hoạt động hết 31/12' })).toBeVisible();
    await expect(p.getByRole('button', { name: 'Bạn đã có cây?' })).toBeVisible();
    await expect(p.getByRole('link', { name: 'Bắt đầu tạo cây' })).toHaveCount(0);
    await p.goto(url('notice', '/tao'));
    await expect(p.getByRole('heading', { name: 'Đã ngừng tạo cây mới từ 26/12' })).toBeVisible();
    await p.goto(url('notice', `/c/${treeId}`));
    await expect(p.getByRole('status').filter({ hasText: 'ngừng hoạt động hết 31/12' })).toBeVisible();
    await expect(p.getByRole('link', { name: 'Tạo cây của bạn' })).toHaveCount(0);

    for (const path of ['/', `/c/${treeId}`]) {
      await p.goto(url('ended', path));
      await expect(p.getByRole('heading', { name: ENDED_TITLE })).toBeVisible();
    }
    await p.getByRole('link', { name: 'Chính sách riêng tư' }).click();
    await expect(p.getByRole('heading', { level: 1, name: 'Chính sách riêng tư' })).toBeVisible();
    await ctx.close();
  });
});
