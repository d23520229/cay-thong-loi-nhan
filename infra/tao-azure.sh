#!/usr/bin/env bash
# Tạo mọi tài nguyên Azure cho Cây Thông Lời Nhắn (đặc tả 6.10.2). Chạy MỘT lần, sau `az login`.
#
#   GOOGLE_CLIENT_ID=... ADMIN_BOOTSTRAP_EMAIL=... SUPPORT_EMAIL=... ALERT_EMAIL=... bash infra/tao-azure.sh
#
# Thiếu biến nào thì script hỏi (khi chạy trong terminal). Bí mật (mật khẩu CSDL, PEPPER, khoá,
# chuỗi kết nối) sinh ngay trong script, ghi thẳng vào cấu hình App Service, không in ra.
set -euo pipefail
# Git Bash tự đổi tham số bắt đầu bằng "/" thành đường dẫn Windows — tắt đi (vd. --scope /subscriptions/...).
export MSYS_NO_PATHCONV=1

LOCATION=${LOCATION:-japaneast}
RG=rg-caythong
PLAN=asp-caythong
APP=${APP:-caythongloinhan}
REPO=d23520229/cay-thong-loi-nhan
IDENTITY=id-caythong-github
SUF=$(openssl rand -hex 2)
PG=psql-caythong-$SUF
ST=stcaythong$SUF

buoc() { echo; echo "▶ $*"; }
# az trên Windows in kèm \r ở cuối dòng.
azv() { az "$@" -o tsv | tr -d '\r'; }

# Ghi JSON (stdin) ra file tạm, in đường dẫn cho `az rest --body @...` — truyền JSON thẳng qua az.cmd dễ hỏng dấu nháy.
json_file() {
  local f; f=$(mktemp); cat > "$f"
  if command -v cygpath > /dev/null; then cygpath -w "$f"; else echo "$f"; fi
}

hoi() { # hoi TÊN_BIẾN "câu hỏi"
  local name=$1 prompt=$2
  if [ -z "${!name:-}" ]; then
    if [ -t 0 ]; then read -rp "$prompt: " "$name"; fi
  fi
  if [ -z "${!name:-}" ]; then echo "Thiếu $name — đặt biến này rồi chạy lại." >&2; exit 1; fi
}
hoi GOOGLE_CLIENT_ID "Google OAuth client ID (đặc tả 6.10.4)"
hoi ADMIN_BOOTSTRAP_EMAIL "Email Google của quản trị viên đầu tiên"
hoi SUPPORT_EMAIL "Email hỗ trợ hiện cho người dùng"
hoi ALERT_EMAIL "Email nhận cảnh báo chi phí"

buoc "1. Kiểm tài khoản"
SUB=$(azv account show --query id)
TENANT=$(azv account show --query tenantId)
echo "Subscription: $(azv account show --query name) ($SUB)"
if [ "${XAC_NHAN:-}" != "y" ]; then
  if [ ! -t 0 ]; then echo "Đặt XAC_NHAN=y để xác nhận đúng subscription Azure for Students." >&2; exit 1; fi
  read -rp "Đúng tài khoản Azure for Students? (y/N) " ok
  [ "$ok" = "y" ] || exit 1
fi

buoc "2. Kiểm vùng $LOCATION có được phép"
allowed=$(azv policy assignment list --query "[].parameters.listOfAllowedLocations.value[]" || true)
if [ -n "$allowed" ] && ! echo "$allowed" | grep -qx "$LOCATION"; then
  echo "Subscription không cho tạo ở $LOCATION. Các vùng được phép:" >&2
  echo "$allowed" | sort -u >&2
  echo "Chọn một vùng rồi chạy lại: LOCATION=<vùng> bash infra/tao-azure.sh" >&2
  exit 1
fi
echo "Được phép."

buoc "3. Kiểm tên trước khi tạo bất cứ thứ gì"
if [ "$(azv group exists -n "$RG")" = "true" ]; then
  echo "Đã có resource group $RG (chạy lần trước?). Xoá bằng: az group delete -n $RG --yes — rồi chạy lại." >&2
  exit 1
fi
avail=$(azv rest --method post \
  --url "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.Web/checknameavailability?api-version=2022-03-01" \
  --body "@$(echo "{\"name\":\"$APP\",\"type\":\"Microsoft.Web/sites\"}" | json_file)" --query nameAvailable)
if [ "$avail" != "true" ]; then
  echo "Tên $APP.azurewebsites.net đã có người dùng. Đổi tên: APP=<tên khác> bash infra/tao-azure.sh" >&2
  echo "(Nhớ sửa APP_URL và tên app trong .github/workflows/ci-cd.yml cho khớp.)" >&2
  exit 1
fi
echo "Tên $APP còn trống."

buoc "4. Resource group $RG"
az group create -n "$RG" -l "$LOCATION" -o none

buoc "5. PostgreSQL $PG (B1ms, 16, 32 GB, sao lưu 7 ngày) — mất khoảng 5–10 phút"
# Mật khẩu: chữ hoa + chữ thường + số (đủ yêu cầu của Azure), không ký tự đặc biệt nên không làm hỏng DATABASE_URL.
PGPASS="Aa1$(openssl rand -hex 16)"
az postgres flexible-server create -g "$RG" -n "$PG" -l "$LOCATION" \
  --tier Burstable --sku-name Standard_B1ms --version 16 --storage-size 32 --backup-retention 7 \
  --admin-user ctlnadmin --admin-password "$PGPASS" --public-access 0.0.0.0 --yes -o none
az postgres flexible-server db create -g "$RG" -s "$PG" -d caythong -o none
DATABASE_URL="postgres://ctlnadmin:$PGPASS@$PG.postgres.database.azure.com:5432/caythong"

buoc "6. Storage $ST + container riêng tư photos"
az storage account create -g "$RG" -n "$ST" -l "$LOCATION" --sku Standard_LRS --kind StorageV2 \
  --min-tls-version TLS1_2 --allow-blob-public-access false -o none
STORAGE_CS=$(azv storage account show-connection-string -g "$RG" -n "$ST" --query connectionString)
az storage container create -n photos --public-access off --connection-string "$STORAGE_CS" -o none

buoc "7. App Service $PLAN (B1) + Web App $APP"
az appservice plan create -g "$RG" -n "$PLAN" --is-linux --sku B1 -l "$LOCATION" -o none
az webapp create -g "$RG" -p "$PLAN" -n "$APP" --runtime "NODE:22-lts" -o none
az webapp config set -g "$RG" -n "$APP" --always-on true --ftps-state Disabled --min-tls-version 1.2 \
  --startup-file "node dist/index.js" --generic-configurations "healthCheckPath=/healthz" -o none
az webapp update -g "$RG" -n "$APP" --https-only true -o none

buoc "8. Cấu hình App Service (đặc tả 6.10.3)"
az webapp config appsettings set -g "$RG" -n "$APP" -o none --settings \
  NODE_ENV=production \
  "BASE_URL=https://$APP.azurewebsites.net" \
  "DATABASE_URL=$DATABASE_URL" \
  "PEPPER=$(openssl rand -hex 24)" \
  "BLOCK_IP_KEY=$(openssl rand -hex 24)" \
  "AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CS" \
  "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" \
  "ADMIN_BOOTSTRAP_EMAIL=$ADMIN_BOOTSTRAP_EMAIL" \
  "SUPPORT_EMAIL=$SUPPORT_EMAIL" \
  DB_QUOTA_GB=32 \
  "ADMIN_AZURE_URL=https://portal.azure.com/#@/resource/subscriptions/$SUB/resourceGroups/$RG/overview" \
  UNLOCK_AT=2026-12-24T00:00:00+07:00 \
  WRITE_CLOSES_AT=2026-12-26T00:00:00+07:00 \
  SERVICE_ENDS_AT=2027-01-01T00:00:00+07:00 \
  PURGE_AT=2027-01-07T00:00:00+07:00 \
  WEB_DIST=/home/site/wwwroot/web \
  TRUST_PROXY_HOPS=1 \
  WEBSITE_RUN_FROM_PACKAGE=1 \
  SCM_DO_BUILD_DURING_DEPLOYMENT=false
unset PGPASS DATABASE_URL STORAGE_CS

buoc "9. Managed identity cho GitHub Actions (chỉ environment production của $REPO)"
az identity create -g "$RG" -n "$IDENTITY" -l "$LOCATION" -o none
CLIENT_ID=$(azv identity show -g "$RG" -n "$IDENTITY" --query clientId)
PRINCIPAL_ID=$(azv identity show -g "$RG" -n "$IDENTITY" --query principalId)
az identity federated-credential create -g "$RG" --identity-name "$IDENTITY" -n github-production \
  --issuer https://token.actions.githubusercontent.com \
  --subject "repo:$REPO:environment:production" \
  --audiences api://AzureADTokenExchange -o none
APP_ID=$(azv webapp show -g "$RG" -n "$APP" --query id)
# Identity mới tạo cần vài giây mới thấy được khi phân quyền.
for i in 1 2 3 4 5 6; do
  if az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
    --role "Website Contributor" --scope "$APP_ID" -o none 2>/dev/null; then break; fi
  if [ "$i" -eq 6 ]; then echo "Không phân quyền được cho $IDENTITY — chạy lại riêng lệnh az role assignment create." >&2; exit 1; fi
  sleep 10
done

buoc "10. Cảnh báo chi phí 40 USD → $ALERT_EMAIL"
START=$(date -u +%Y-%m-01)
BODY_PATH=$(json_file <<JSON
{"properties":{"category":"Cost","amount":40,"timeGrain":"Annually",
 "timePeriod":{"startDate":"${START}T00:00:00Z","endDate":"2027-01-31T00:00:00Z"},
 "notifications":{"actual80":{"enabled":true,"operator":"GreaterThanOrEqualTo","threshold":80,"contactEmails":["$ALERT_EMAIL"]},
  "actual100":{"enabled":true,"operator":"GreaterThanOrEqualTo","threshold":100,"contactEmails":["$ALERT_EMAIL"]}}}}
JSON
)
if az rest --method put \
  --url "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.Consumption/budgets/caythong-40usd?api-version=2023-05-01" \
  --body "@$BODY_PATH" -o none 2>/dev/null; then
  echo "Đã đặt cảnh báo (email khi chi tiêu đạt 32 và 40 USD)."
else
  echo "Tài khoản này không cho đặt budget — theo dõi credit tại https://www.microsoftazuresponsorships.com/balance"
fi

echo
echo "================ XONG ================"
echo "Trang (lên sau lần triển khai đầu): https://$APP.azurewebsites.net"
echo "Azure Portal: https://portal.azure.com/#@/resource/subscriptions/$SUB/resourceGroups/$RG/overview"
echo
echo "Dán 3 giá trị sau vào GitHub → Settings → Environments → production → Environment secrets:"
echo "  AZURE_CLIENT_ID       = $CLIENT_ID"
echo "  AZURE_TENANT_ID       = $TENANT"
echo "  AZURE_SUBSCRIPTION_ID = $SUB"
echo "Bước tiếp: infra/README.md, mục 3."
