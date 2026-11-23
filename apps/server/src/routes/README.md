# Route API

Mốc M1: các file đánh dấu **có rồi** đã làm xong; `og.ts` và `admin.ts` làm ở mốc sau.

| File | Đường dẫn | Mục đặc tả | Trạng thái |
|---|---|---|---|
| `config.ts` | `GET /api/config` | 8.1 | có rồi |
| `trees.ts` | `POST /api/trees`, `GET /api/trees/:id`, `DELETE /api/trees/:id` | 8.2, 8.3 | có rồi |
| `room.ts` | `PUT /api/trees/:id/room`, `GET /api/trees/:id/owner`, `POST /api/trees/:id/owner/visit` | 7.5, 8.3 | có rồi |
| `auth.ts` | `/api/trees/:id/auth/*`, `/api/auth/google` | 8.2 | có rồi |
| `messages.ts` | `POST /api/trees/:id/messages`, `/api/messages/:mid*` | 8.4 | có rồi |
| `owner.ts` | `/owner`, `/open`, `/block`, `/reports` | 8.5 | có rồi |
| `messages.ts` (ảnh) | `GET /api/messages/:mid/photo` (tác giả, kèm token), `POST/PUT` lời nhắn nhận trường `photo` (base64, xử lý ở `../photo.ts`, lưu qua `../storage/`) | 6.7.3, 8.4 | có rồi (23/11) |
| `owner.ts` (ảnh) | `GET /api/trees/:id/messages/:mid/photo` (chủ cây, chỉ sau khi mở quà) | 6.7.3, 8.5 | có rồi (23/11) |
| `og.ts` | `GET /api/trees/:id/image.png` (tải ảnh phòng, `content-disposition: attachment`), `GET /og/:id.png` (ảnh vẽ ở `../og/render.ts`); có `WEB_DIST` thì phục vụ bản build web, `GET /c/:id` chèn thẻ OG, đường dẫn trang khác trả `index.html` | 8.6, 6.6.3 | có rồi (M3) |
| `admin.ts` | `/api/admin/*` | 8.7 | sau (M3b) |

Không phải route nhưng route ảnh dùng: `../photo.ts` (giải mã base64, giới hạn 3 MB / 25 triệu điểm ảnh, xoay theo EXIF, bỏ EXIF, ra WebP) và `../storage/` (`PhotoStore` có `put/get/delete/copy`; `fs.ts` ghi `.data/photos/`, `azure.ts` dùng Blob khi có `AZURE_STORAGE_CONNECTION_STRING`, `memory.ts` cho test).
