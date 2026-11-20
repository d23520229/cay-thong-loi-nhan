# apps/web/src — sơ đồ thư mục

M2, M3 xong; M3b (quản trị) chưa làm.

| Thư mục | File hiện có | Trạng thái |
|---|---|---|
| `routes/` | `Home.tsx`, `ReopenDialog.tsx`, `CreatePage.tsx` (/tao), `RoomPage.tsx` (/c/:id), `OwnerLogin.tsx` | M2 xong. `AdminApp` (/quan-tri/*) chưa làm (M3b) |
| `room/` | `model.ts`, `fit.ts`, `Scene.tsx`, `RoomStage.tsx` (có `camera`, `overlay`), `store.ts`, `drag.ts`, `Editor.tsx`, `EditorLayout.tsx` (dải chọn, mũi tên ‹ ›, bảng bên), `autosave.ts`, `ConflictDialog.tsx`, `effects.ts` + `useItemFx.ts` (hiệu ứng chạm G6) | M2 xong; hiệu ứng chạm M3 phần 1 |
| `lib/` | `api.ts` (có API lời nhắn), `catalog.ts`, `storage.ts` (có `msg:`, `lastName`), `clock.ts` (giờ server), `treeRef.ts`, `authError.ts` | M2 xong; M3 phần 1 bổ sung |
| `ui/` | `Button.tsx`, `PinInput.tsx`, `Sheet.tsx` (có `className`), `ConfirmDialog.tsx`, `Toast.tsx` | M3 bổ sung |
| `guest/` | `geometry.ts` (vị trí điểm, camera zoom), `useTreeZoom.ts`, `slots.ts` (trạng thái điểm), `SlotsLayer.tsx` (cả trạng thái quà của chủ cây), `Compose.tsx` (bảng viết/sửa), `GuestTree.tsx` (điều khiển khách) | M3 xong |
| `owner/` | `OwnerTree.tsx` (chế độ Xem của chủ cây), `countdown.ts`, `MessageCard.tsx`, `ReportSheet.tsx`, `OwnerOptions.tsx`, `ShareSheet.tsx` | M3 xong |
| `admin/` | — (`Overview`, `Reports`, `TreeLookup`, ...) | Chưa làm (M3b) |
| `art/` | — (bọc `@ctln/art` thành component) | Chưa làm |
| `styles/` | `base.css`, `room-animations.css` (gom từ bản thiết kế), `app.css`; `admin.css` chưa có | Một phần |

Ảnh WebP đã xuất nằm ở `apps/web/public/assets/{tree,room}`; đường dẫn và kích thước lấy từ `@ctln/shared/catalog.json`.
