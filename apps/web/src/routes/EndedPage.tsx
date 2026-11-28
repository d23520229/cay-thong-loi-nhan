import { Link } from 'react-router';
import { useConfig } from '../lib/config';
import { vnDate } from '../lib/dates';
import { SupportHint } from '../ui/SupportHint';

/** Trang kết thúc L4 từ 0h 01/01/2027 (đặc tả 6.9.1). */
export function EndedPage() {
  const purgeAt = useConfig()?.purgeAt;
  return (
    <main className="placeholder ended">
      <h1>Mùa Noel đã kết thúc, cảm ơn bạn!</h1>
      <p>Toàn bộ cây, lời nhắn và ảnh sẽ bị xoá ngày {purgeAt ? vnDate(purgeAt) : '07/01/2027'}.</p>
      <SupportHint />
      <Link to="/chinh-sach" className="linkbtn">Chính sách riêng tư</Link>
    </main>
  );
}
