# apps/web/src — sơ đồ thư mục

M2 xong; phần M3/M3b chưa làm.

| Thư mục | File hiện có | Trạng thái |
|---|---|---|
| `routes/` | `Home.tsx`, `ReopenDialog.tsx`, `CreatePage.tsx` (/tao), `RoomPage.tsx` (/c/:id), `OwnerLogin.tsx` | M2 xong. `AdminApp` (/quan-tri/*) chưa làm (M3b) |
| `room/` | `model.ts`, `fit.ts`, `Scene.tsx`, `RoomStage.tsx`, `store.ts`, `drag.ts`, `Editor.tsx`, `EditorLayout.tsx` (dải chọn, mũi tên ‹ ›, bảng bên), `autosave.ts`, `ConflictDialog.tsx` | M2 xong. `Effects` (hiệu ứng chạm) chưa làm (M3) |
| `lib/` | `api.ts`, `catalog.ts`, `storage.ts`, `treeRef.ts`, `authError.ts` | M2 xong |
| `ui/` | `Button.tsx`, `PinInput.tsx`, `Sheet.tsx`, `Toast.tsx` | M2 xong |
| `guest/` | — (`Compose`: chọn 1/20 phụ kiện, tên/ẩn danh, lời nhắn) | Chưa làm (M3) |
| `owner/` | — (`Reader`: đếm ngược, mở thẻ; chế độ Xem) | Chưa làm (M3) |
| `admin/` | — (`Overview`, `Reports`, `TreeLookup`, ...) | Chưa làm (M3b) |
| `art/` | — (bọc `@ctln/art` thành component) | Chưa làm |
| `styles/` | `base.css`, `room-animations.css` (gom từ bản thiết kế), `app.css`; `admin.css` chưa có | Một phần |

Ảnh WebP đã xuất nằm ở `apps/web/public/assets/{tree,room}`; đường dẫn và kích thước lấy từ `@ctln/shared/catalog.json`.
