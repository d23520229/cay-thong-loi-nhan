# Bản thiết kế trên canvas

Canvas "Cây Thông Lời Nhắn – Bản thiết kế đồ hoạ": https://claude.ai/artifact/F3Xp3vGQisXLRZziocfvyX

Canvas chỉ để **duyệt thiết kế**, web thật không đọc gì từ đây. Thư mục này giữ mã sinh các bảng để sửa thiết kế sau này.

| File | Sinh ra bảng |
|---|---|
| `build-board-tree2.mjs` | `Main.dc.html` (cây thông màu nước – phối thử), `Bo-cay-thong.dc.html` |
| `build-board-free.mjs` | `Phong-tu-do.dc.html` (phòng tự do, kéo thả, chủ cây / bạn bè, điện thoại / máy tính), `Bo-phu-kien.dc.html` |
| `build-design-ornaments-v2.mjs` | `Phu-kien-treo.dc.html` (20 phụ kiện treo + trạng thái) |
| `design-common.mjs` | Khung trang và CSS dùng chung cho các bảng |
| `legacy/` | Đồ hoạ nét phẳng đời đầu, chỉ còn dùng cho vài bảng cũ |
| `data/` | Địa chỉ ảnh đã tải lên canvas (`asset-urls.json`, `item-urls.json`) và kích thước ảnh (`items-meta.json`) |
| `boards/` | Các file `.dc.html` và `canvas.json` đang có trên canvas |

Chạy từ thư mục gốc repo: `pnpm canvas:build`. Kết quả ghi vào `boards/`; việc đưa lên canvas do Claude thực hiện (ảnh mới phải tải lên canvas trước để có địa chỉ `/_blob/...`).
