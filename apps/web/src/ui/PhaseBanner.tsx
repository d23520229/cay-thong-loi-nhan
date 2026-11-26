import { useConfig } from '../lib/config';
import { vnDate, vnLastDay } from '../lib/dates';

/** Biểu ngữ L3 từ 0h 26/12 (đặc tả 6.9.1): nhắc tải ảnh trước khi ngừng dịch vụ. */
export function PhaseBanner() {
  const config = useConfig();
  if (config?.phase !== 'NOTICE') return null;
  return (
    <p className="phase-banner" role="status">
      Cây Thông Lời Nhắn ngừng hoạt động hết {vnLastDay(config.serviceEndsAt)}. Tải ảnh phòng và thiệp về máy sớm nhé — dữ liệu bị xoá ngày {vnDate(config.purgeAt)}.
    </p>
  );
}
