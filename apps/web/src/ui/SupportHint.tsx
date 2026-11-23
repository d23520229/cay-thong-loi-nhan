import { useConfig } from '../lib/config';

/** Câu nhắc email hỗ trợ (đặc tả 6.8.7); không cấu hình SUPPORT_EMAIL thì không hiện. */
export function SupportHint() {
  const email = useConfig()?.supportEmail;
  if (!email) return null;
  return (
    <p className="hint support-hint">
      Cần giúp? Gửi mã cây và mô tả vấn đề tới <a href={`mailto:${email}`}>{email}</a> (đừng gửi PIN hay link riêng).
    </p>
  );
}
