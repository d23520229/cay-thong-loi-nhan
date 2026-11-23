import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OwnerOptions } from './OwnerOptions';

vi.mock('../ui/SupportHint', () => ({ SupportHint: () => <p>HỖ TRỢ</p> }));

describe('OwnerOptions', () => {
  it('có câu nhắc email hỗ trợ', () => {
    render(<OwnerOptions showCount busy={false} onToggleCount={() => {}} onDeleteTree={() => {}} onClose={() => {}} />);
    expect(screen.getByText('HỖ TRỢ')).toBeInTheDocument();
  });
});
