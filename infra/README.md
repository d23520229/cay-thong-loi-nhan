# Triển khai Azure (đặc tả 6.10)

Trang chạy ở **https://caythongloinhan.azurewebsites.net**, vùng Japan East, mọi tài nguyên nằm trong resource group `rg-caythong`. Mỗi commit vào `main` tự kiểm tra rồi tự triển khai (`.github/workflows/ci-cd.yml`).

| File | Việc |
|---|---|
| `tao-azure.sh` | Tạo tài nguyên — chạy **một lần** |
| `dong-goi.sh` | Gói server + web vào `out/` (CI dùng; chạy thử trên máy sau `pnpm build`) |

## 1. Google Cloud (làm trước)

Google Cloud Console → APIs & Services → Credentials → OAuth client loại **Web application** (dùng client đang dùng cho `localhost`, hoặc tạo mới):

- **Authorized JavaScript origins:** thêm `https://caythongloinhan.azurewebsites.net` (giữ `http://localhost:5173`).
- **OAuth consent screen:** nếu đang "Testing" thì bấm **Publish app** sang "In production" — không thì chỉ tài khoản trong danh sách thử đăng nhập được.

Chép **Client ID** cho bước 2.

## 2. Tạo tài nguyên

Mở **Git Bash** ở thư mục repo:

```bash
az login
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com \
ADMIN_BOOTSTRAP_EMAIL=email-quan-tri@gmail.com \
SUPPORT_EMAIL=email-ho-tro@gmail.com \
ALERT_EMAIL=email-nhan-canh-bao@gmail.com \
bash infra/tao-azure.sh
```

Mất khoảng 10–15 phút (PostgreSQL lâu nhất). Script hỏi xác nhận đúng subscription; chạy từ chỗ không gõ được phím (vd. `!` trong Claude Code) thì thêm `XAC_NHAN=y`.

- Script dừng **trước khi tạo gì** nếu vùng không được phép, tên `caythongloinhan` đã có người dùng, hoặc đã có `rg-caythong`.
- Hỏng giữa chừng: xoá `az group delete -n rg-caythong --yes` (chờ xong) rồi chạy lại.
- Cuối cùng script in 3 giá trị cho bước 3. Không có bí mật nào được in ra.

## 3. GitHub

Repo → **Settings → Environments → New environment** tên `production`:

- **Deployment branches and tags:** "Selected branches" → thêm `main`.
- **Environment secrets:** `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (giá trị script in ra).

Sau đó gộp PR vào `main` (hoặc tab **Actions → CI/CD → Run workflow** trên `main`). Job `trien-khai` xong và xanh là trang đã lên.

## Thử giai đoạn bằng `FAKE_NOW` (tạm — gỡ trước 10/12, đặc tả 6.10.6)

Đổi cấu hình thì app tự khởi động lại (~1 phút), không cần triển khai lại.

```bash
# NOTICE
az webapp config appsettings set -g rg-caythong -n caythongloinhan --settings FAKE_NOW=2026-12-27T10:00:00+07:00 -o none
# ENDED
az webapp config appsettings set -g rg-caythong -n caythongloinhan --settings FAKE_NOW=2027-01-02T10:00:00+07:00 -o none
# Thử xong — BẮT BUỘC
az webapp config appsettings delete -g rg-caythong -n caythongloinhan --setting-names FAKE_NOW -o none
# Kiểm đã xoá (phải ra rỗng)
az webapp config appsettings list -g rg-caythong -n caythongloinhan --query "[?name=='FAKE_NOW']" -o tsv
```

## Theo dõi

- Log trực tiếp: `az webapp log tail -g rg-caythong -n caythongloinhan`
- Khởi động lại: `az webapp restart -g rg-caythong -n caythongloinhan`
- Credit còn lại: https://www.microsoftazuresponsorships.com/balance

## Kết thúc — 07/01/2027

Xoá toàn bộ (app, CSDL, ảnh, identity, cảnh báo) — **không lấy lại được**:

```bash
az group delete -n rg-caythong --yes
```
