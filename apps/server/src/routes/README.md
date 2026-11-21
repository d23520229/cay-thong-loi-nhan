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
| `og.ts` | `GET /c/:id`, `GET /og/:id.png` | 8.6 | sau (M3) |
| `admin.ts` | `/api/admin/*` | 8.7 | sau (M3b) |
