import { Link } from 'react-router';
import { useConfig } from '../lib/config';
import { vnDate } from '../lib/dates';

/** Chính sách riêng tư (đặc tả 6.9.2): chỉ nói điều code đang làm (mục 7.8, 10). Tải lười, gói riêng. */
export function PolicyPage() {
  const config = useConfig();
  const purge = config?.purgeAt ? vnDate(config.purgeAt) : '07/01/2027';
  const email = config?.supportEmail;
  return (
    <main className="policy">
      <h1>Chính sách riêng tư</h1>

      <h2>Lưu gì</h2>
      <p>Tên chủ cây, tên cây và căn phòng bạn trang trí. Lời nhắn, tên người viết (chọn ẩn danh thì không lưu tên) và ảnh kèm — ảnh đã được bỏ thông tin vị trí (EXIF).</p>
      <p>Mã băm của thiết bị và của địa chỉ IP để chống spam; chúng tôi không lưu địa chỉ IP thật. Đăng nhập bằng Google chỉ lưu mã người dùng Google, không lưu tên hay email Google.</p>

      <h2>Ai thấy gì</h2>
      <p>Khách không thấy lời nhắn của nhau. Chủ cây đọc được lời nhắn từ 0h 24/12 (giờ Việt Nam). Quản trị viên chỉ thấy lời nhắn đã bị báo cáo (bản chụp lúc báo cáo).</p>
      <p>Nói thật với bạn: dữ liệu không mã hoá đầu-cuối. Người vận hành có quyền truy cập máy chủ về kỹ thuật vẫn có thể xem cơ sở dữ liệu. Trang quản trị không có chức năng đọc lời nhắn, và người vận hành cam kết không xem.</p>

      <h2>Giữ bao lâu</h2>
      <p>Lần đăng nhập (kèm mã băm IP) giữ 7 ngày. Bộ đếm chống spam giữ tối đa 1 ngày. Mọi dữ liệu khác bị xoá ngày {purge}, kể cả bản sao lưu.</p>
      <p>Chủ cây xoá cây bất cứ lúc nào; xoá cây là xoá cả lời nhắn và ảnh.</p>

      <h2>Lưu trên trình duyệt</h2>
      <p>Trong trình duyệt (localStorage): mã thiết bị, danh sách cây của bạn, bản nháp đang tạo, tên bạn ghi lần trước khi viết lời nhắn, và mã sửa lời nhắn (để sửa trong 15 phút). Nếu trình duyệt chặn localStorage, mã thiết bị được giữ bằng một cookie 1 năm. Cookie phiên để nhớ bạn là chủ cây.</p>
      <p>Không có quảng cáo, không có công cụ theo dõi. Nút đăng nhập Google tải mã từ accounts.google.com khi nút đó hiện ra.</p>

      <h2>Liên hệ</h2>
      <p>{email ? <>Gửi thư tới <a href={`mailto:${email}`}>{email}</a>.</> : 'Dùng email hỗ trợ ở trang chủ.'}</p>

      <Link to="/" className="btn btn-primary">‹ Về trang chủ</Link>
    </main>
  );
}
