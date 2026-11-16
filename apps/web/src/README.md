# apps/web/src — sơ đồ thư mục (làm ở mốc M2–M3)

| Thư mục | Thành phần dự kiến | Lấy từ bản thiết kế |
|---|---|---|
| `routes/` | `Home`, `CreateRoom` (/tao), `RoomPage` (/c/:id), `AdminApp` (/quan-tri/*) | — |
| `room/` | `Scene` (dựng phòng từ catalog), `Camera` (tỉ lệ, zoom vào cây, dời tới món đang sửa), `DragLayer` (Pointer Events, cập nhật thẳng transform khi kéo), `Editor` (chọn món, mũi tên ‹ ›, thanh công cụ, tự lưu), `PickerStrip` (dải chọn điện thoại), `SidePanels` (bảng bên máy tính), `Effects` (hiệu ứng chạm) | Bảng "Phòng tự do" |
| `guest/` | `Compose` (chọn 1/20 phụ kiện, để tên/ẩn danh, lời nhắn; sửa trong 15 phút) | Bảng "Phòng tự do", vai trò bạn bè |
| `owner/` | `Reader` (đếm ngược, quà còn gói, mở thẻ lời nhắn), `OwnerAuth` (PIN, Google, link riêng) | Bảng "Phụ kiện treo & trạng thái" |
| `admin/` | `Overview`, `Reports`, `TreeLookup`, `Stats`, `Blocks`, `Words`, `Settings`, `Admins`, `Audit` | Đặc tả mục 3.7, 9.10 |
| `art/` | Bọc `@ctln/art/pets`, `@ctln/art/ornaments` thành component React | — |
| `styles/` | `base.css` (đã có), `room-animations.css` (đã có, gom từ bản thiết kế), `admin.css` | — |

Ảnh WebP đã xuất nằm ở `apps/web/public/assets/{tree,room}`; đường dẫn và kích thước lấy từ `@ctln/shared/catalog.json`.
