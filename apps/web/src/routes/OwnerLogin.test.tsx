import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../lib/api';
import { OwnerLogin } from './OwnerLogin';

vi.mock('../lib/api', async (orig) => {
  const actual = await orig<typeof import('../lib/api')>();
  return { ...actual, api: { authPin: vi.fn(), authGoogle: vi.fn() } };
});

vi.mock('../ui/GoogleButton', () => ({
  GoogleButton: ({ onToken }: { onToken: (t: string) => void }) => (
    <button type="button" onClick={() => onToken(GTOKEN)}>Google giả</button>
  ),
}));
// idToken giả có tên "Lan" trong payload.
const GTOKEN = `h.${btoa(JSON.stringify({ name: 'Lan' })).replace(/=+$/, '')}.s`;
vi.mock('../ui/SupportHint', () => ({ SupportHint: () => <p>HỖ TRỢ</p> }));
const mocked = vi.mocked(api);

beforeEach(() => vi.resetAllMocks());

describe('OwnerLogin — Google', () => {
  it('đăng nhập Google đúng chủ cây → onSuccess', async () => {
    mocked.authGoogle.mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    render(<OwnerLogin treeId="abc12345" onClose={() => {}} onSuccess={onSuccess} />);
    await userEvent.click(screen.getByRole('button', { name: 'Google giả' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mocked.authGoogle).toHaveBeenCalledWith(GTOKEN, 'abc12345');
  });

  it('không phải chủ cây → báo lỗi', async () => {
    mocked.authGoogle.mockRejectedValue(new ApiError(403, 'not_owner', 'x'));
    const onSuccess = vi.fn();
    render(<OwnerLogin treeId="abc12345" onClose={() => {}} onSuccess={onSuccess} />);
    await userEvent.click(screen.getByRole('button', { name: 'Google giả' }));
    expect(await screen.findByText('Tài khoản này không phải chủ cây.')).toBeInTheDocument();
    expect(screen.getByText('HỖ TRỢ')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
