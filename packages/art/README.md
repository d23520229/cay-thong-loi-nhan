# @ctln/art — đồ hoạ màu nước

Mọi đồ hoạ được **vẽ bằng code** (SVG có bộ lọc màu nước) rồi **xuất sẵn thành WebP**. Trình duyệt chỉ tải ảnh, không chạy bộ lọc, nên mượt trên điện thoại.

| File | Nội dung |
|---|---|
| `src/tree.mjs` | Tán cây (4 dáng × 6 màu), thân (3 dáng × 4 màu gỗ), lớp đèn + ngôi sao (SVG động), CSS chuyển động cây |
| `src/room.mjs` | 9 phông nền, 3 cửa sổ, thảm, hộp quà lẻ, chồng quà, lửa lò sưởi (SVG động), tuyết ngoài cửa sổ |
| `src/fireplaces.mjs` | 8 dáng lò sưởi + vị trí lửa cho từng dáng |
| `src/animated/pets.mjs` | 6 thú cưng SVG động (bản màu nước mềm: `petSVGSoft`) + CSS |
| `src/animated/ornaments.mjs` | 20 phụ kiện treo (bản mềm: `ornamentSVGSoft`), bong bóng điểm nhắn + CSS |
| `scripts/export.mjs` | Xuất WebP vào `apps/web/public/assets/{tree,room}` và sinh `packages/shared/src/catalog.json` |
| `scripts/export-pet-thumbs.mjs` | Ảnh thu nhỏ thú cưng cho khay "Thêm đồ" |
| `room-meta.json` | Kích thước + điểm neo của từng ảnh đồ trong phòng (do script sinh) |

## Thêm một kiểu đồ mới

1. Vẽ thêm trong `src/` (vd. thêm một khoá vào `FIREPLACES2` và hàm vẽ tương ứng).
2. Chạy `pnpm art:export` (hoặc `export:room` nếu chỉ đổi đồ trong phòng).
3. Kiểu mới tự xuất hiện trong `catalog.json`, web và server nhận ngay, không phải sửa code giao diện.

## Hệ toạ độ

- Căn phòng: khung **720 × 1080**, sàn bắt đầu ở y = 770. Ảnh đồ xuất ở 1,5× (cắt sát), kèm điểm neo `ax, ay` ở chân món.
- Cây: khung **400 × 600**, gốc ở y = 538, đặt vào phòng với tỉ lệ 1,2.
