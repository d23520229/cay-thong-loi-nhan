# M4 khối 2 — Triển khai Azure và CI/CD — Kế hoạch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi commit vào `main` tự kiểm tra rồi tự lên `https://caythongloinhan.azurewebsites.net`; tài nguyên Azure tạo bằng một script; tạm cho `FAKE_NOW` trên production để chủ dự án thử NOTICE / ENDED.

**Architecture:** Một script dùng chung `infra/dong-goi.sh` gói server (`pnpm deploy`, node_modules phẳng) + `apps/web/dist` vào `out/`. GitHub Actions: job `kiem-tra` (typecheck, test, build, e2e với service Postgres) → job `trien-khai` (chỉ push lên `main`, environment `production`, đăng nhập Azure bằng OIDC của managed identity, `az webapp deploy` zip, kiểm khói). Script `infra/tao-azure.sh` tạo mọi tài nguyên trong `rg-caythong`.

**Tech Stack:** GitHub Actions, Azure CLI 2.91, pnpm 9.12, Node 22, bash.

**Spec:** `docs/dac-ta-v3.md` mục 6.10 (đọc cả mục). Bối cảnh: `docs/tien-do.md`.

## Global Constraints

- Vùng `southeastasia`; resource group `rg-caythong`; Web App `caythongloinhan`; plan `asp-caythong` Linux **B1**; PostgreSQL Flexible **B1ms** Burstable, phiên bản 16, 32 GB, sao lưu 7 ngày; storage StorageV2 LRS, container riêng tư `photos`; identity `id-caythong-github`.
- Runtime `NODE:22-lts`, startup `node dist/index.js`, health check `/healthz`, Always On, chỉ HTTPS, TLS ≥ 1.2, tắt FTP.
- App settings đúng danh sách đặc tả 6.10.3, `WEB_DIST=/home/site/wwwroot/web`, `WEBSITE_RUN_FROM_PACKAGE=1`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, `TRUST_PROXY_HOPS=1`.
- Federated credential subject: `repo:d23520229/cay-thong-loi-nhan:environment:production`; vai trò **Website Contributor** chỉ trên Web App.
- Bí mật không bao giờ in ra màn hình / log CI, không nằm trong repo. Không `set -x`; lệnh `az` trả bí mật dùng `-o none` hoặc `--query ... -o tsv` gán vào biến.
- Không dịch vụ trả phí ngoài App Service B1 + PostgreSQL B1ms + Storage (CLAUDE.md).
- Chữ hiện cho người, chú thích, commit: tiếng Việt.
- `pnpm test` + `pnpm typecheck` phải qua trước khi báo xong mỗi task có code.

## Review Focus

1. **Mật khẩu CSDL có ký tự đặc biệt làm hỏng `DATABASE_URL`** → mật khẩu chỉ gồm `Aa1` + 32 ký tự hex (đủ 3 loại ký tự Azure đòi, không cần mã hoá URL). Task 4 kiểm bằng `grep`.
2. **Chạy script lần hai / tên Web App đã có người dùng** → kiểm tên trước khi tạo bất cứ thứ gì (`az webapp list` trong subscription + `nslookup caythongloinhan.azurewebsites.net`), dừng với thông báo rõ. Task 4.
3. **PR từ fork hoặc nhánh khác triển khai được** → job `trien-khai` có `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` và `environment: production`; federated credential chỉ khớp environment này. Task 3 kiểm bằng PR thật: job `trien-khai` hiện "skipped".
4. **Gói zip thiếu thứ khi chạy trên Linux** (symlink, `sharp`, migration, `@ctln/shared`, `@ctln/art`, `web/index.html`) → `dong-goi.sh` tự kiểm các file bắt buộc trong `out/` và thoát mã ≠ 0 nếu thiếu; Task 2 chạy thử `out/` thật.
5. **Khởi động lần đầu trên B1 chậm (migration + sharp)** → vòng chờ `/healthz` tới 180 giây trước khi báo đỏ. Task 3.

---

### Task 1: Tạm cho `FAKE_NOW` khi production

**Files:**
- Modify: `apps/server/src/env.ts:47`
- Test: `apps/server/test/security.test.ts:43-48`

**Interfaces:** không đổi chữ ký `loadEnv`.

- [ ] **Step 1: Sửa test** — đổi test `'production không cho đặt FAKE_NOW'` thành `'production tạm cho đặt FAKE_NOW (đặc tả 6.10.6, gỡ trước 10/12)'`, khẳng định `expect(() => loadEnv({ ...base, FAKE_NOW: '2026-12-24T00:00:00+07:00' })).not.toThrow()`; giữ nguyên dòng kiểm môi trường không production.
- [ ] **Step 2: Chạy, thấy trượt** — `pnpm --filter @ctln/server exec vitest run test/security.test.ts` → FAIL (vẫn ném lỗi FAKE_NOW).
- [ ] **Step 3: Sửa code** — xoá dòng `if (production && src.FAKE_NOW) throw ...`, thay bằng chú thích một dòng: `// TẠM (đặc tả 6.10.6): cho FAKE_NOW trên production để thử NOTICE/ENDED; trả lại lệnh cấm trước 10/12.`
- [ ] **Step 4: Chạy lại** — cùng lệnh → PASS; `pnpm --filter @ctln/server test` → toàn bộ qua.
- [ ] **Step 5: Commit** — `git commit -m "chore(server): tạm cho FAKE_NOW khi production để thử giai đoạn trên Azure (đặc tả 6.10.6)"`

### Task 2: Script đóng gói `infra/dong-goi.sh`

**Files:**
- Create: `infra/dong-goi.sh`
- Modify: `.gitignore` (thêm `out/`, `app.zip`)

**Interfaces:**
- Consumes: `pnpm build` đã chạy (cần `apps/server/dist/index.js`, `apps/web/dist/index.html`).
- Produces: thư mục `out/` ở gốc repo, chạy được bằng `cd out && node dist/index.js` với `WEB_DIST=<out>/web`. Task 3 gọi `bash infra/dong-goi.sh` rồi tự nén.

- [ ] **Step 1: Viết script** (`#!/usr/bin/env bash`, `set -euo pipefail`, chạy từ gốc repo):
  1. Thiếu một trong hai file build → in "Chạy pnpm build trước" và `exit 1`.
  2. `rm -rf out` → `pnpm --filter @ctln/server deploy --prod --config.node-linker=hoisted out`.
  3. `cp -r apps/web/dist out/web`.
  4. Kiểm tồn tại, thiếu cái nào in tên và `exit 1`: `out/dist/index.js`, `out/dist/db/migrations/0000_init.sql`, `out/web/index.html`, `out/node_modules/sharp/package.json`, `out/node_modules/@ctln/shared/package.json`, `out/node_modules/@ctln/art/package.json`, `out/node_modules/fastify/package.json`.
  5. Kiểm không còn symlink: `find out -type l | head -1` có kết quả → in "Gói còn symlink" và `exit 1`.
  6. In "Đã đóng gói vào out/ (<dung lượng du -sh>)".
- [ ] **Step 2: Chạy thử trên máy** — `pnpm build && bash infra/dong-goi.sh` → in "Đã đóng gói…", mã thoát 0. Nếu `pnpm deploy` không nhận `--config.node-linker=hoisted` ở pnpm 9.12, thử `pnpm --filter @ctln/server --config.node-linker=hoisted deploy --prod out`; ghi cách chạy được vào chú thích script.
- [ ] **Step 3: Khởi động gói** — Postgres dev đang bật (`pnpm db:up`); trong `out/`: `PORT=3097 WEB_DIST="$PWD/web" DATABASE_URL=postgres://ctln:ctln_dev@localhost:5432/caythong node dist/index.js` chạy nền; `curl -s localhost:3097/healthz` → `{"ok":true}`; `curl -s localhost:3097/ | grep -c '<div id="root">'` → 1; `curl -s localhost:3097/api/config` có `"phase"`. Tắt server.
- [ ] **Step 4: Kiểm thiếu build** — `mv apps/web/dist apps/web/dist.bak; bash infra/dong-goi.sh; echo $?` → in thông báo, mã 1; trả lại `mv apps/web/dist.bak apps/web/dist`.
- [ ] **Step 5: Commit** — `git add infra/dong-goi.sh .gitignore && git commit -m "build: script đóng gói server + web cho App Service (đặc tả 6.10.5)"`

### Task 3: Workflow `.github/workflows/ci-cd.yml`

**Files:**
- Create: `.github/workflows/ci-cd.yml`

**Interfaces:**
- Consumes: `bash infra/dong-goi.sh` (Task 2); secret environment `production`: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (Task 4 in ra).
- Produces: hai job `kiem-tra`, `trien-khai`.

- [ ] **Step 1: Viết workflow**
  - `on`: `pull_request: branches: [main]`, `push: branches: [main]`, `workflow_dispatch`.
  - `permissions: contents: read` ở mức workflow.
  - **`kiem-tra`**: `runs-on: ubuntu-latest`, `timeout-minutes: 30`; service `postgres:16` (env `POSTGRES_USER=ctln`, `POSTGRES_PASSWORD=ctln_dev`, `POSTGRES_DB=caythong`, cổng `5432:5432`, health-cmd `pg_isready`). Bước: checkout → `pnpm/action-setup@v4` (đọc `packageManager`) → `actions/setup-node@v4` node 22, `cache: pnpm` → `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm test` → `pnpm build` → `pnpm exec playwright install --with-deps chromium` → `pnpm e2e` với env `E2E_ADMIN_DB_URL=postgres://ctln:ctln_dev@localhost:5432/caythong` → khi `failure()`: `actions/upload-artifact@v4` thư mục `e2e/.out/results`, giữ 7 ngày.
  - **`trien-khai`**: `needs: kiem-tra`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `environment: production` (url `https://caythongloinhan.azurewebsites.net`), `concurrency: { group: trien-khai, cancel-in-progress: false }`, `permissions: { id-token: write, contents: read }`, `timeout-minutes: 20`. Bước: checkout → pnpm + node như trên → `pnpm install --frozen-lockfile` → `pnpm build` → `bash infra/dong-goi.sh` → `cd out && zip -qr ../app.zip .` → `azure/login@v2` (client-id / tenant-id / subscription-id từ secret) → `az webapp deploy -g rg-caythong -n caythongloinhan --type zip --src-path app.zip` → kiểm khói.
  - **Kiểm khói** (bước bash): lặp tối đa 36 lần × 5 giây gọi `curl -fsS https://caythongloinhan.azurewebsites.net/healthz`; hết lượt → `exit 1` với "Trang chưa lên sau 180 giây — xem: az webapp log tail -g rg-caythong -n caythongloinhan". Sau đó `curl -fsS .../ | grep -q '<div id="root">'` và `curl -fsS .../api/config | grep -q '"phase"'`.
- [ ] **Step 2: Kiểm cú pháp** — `node -e "require('yaml')"` không có thì dùng `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci-cd.yml'))"`; nếu cả hai không có, đọc lại thụt lề bằng mắt. Expected: không lỗi.
- [ ] **Step 3: Commit** — `git commit -m "ci: kiểm tra mọi PR, tự triển khai main lên Azure (đặc tả 6.10.5)"`
- [ ] **Step 4 (sau khi push nhánh và mở PR — Task 5):** tab Actions: `kiem-tra` xanh, `trien-khai` "skipped". `kiem-tra` đỏ → sửa đến khi xanh trước khi bàn giao.

### Task 4: Script tạo tài nguyên `infra/tao-azure.sh` + `infra/README.md`

**Files:**
- Create: `infra/tao-azure.sh`, `infra/README.md`

**Interfaces:**
- Produces: tài nguyên đúng Global Constraints; in ra `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, URL trang, link Portal resource group.

- [ ] **Step 1: Viết `tao-azure.sh`** — `set -euo pipefail`, không `set -x`. Biến đầu: `LOCATION=${LOCATION:-southeastasia}`, `RG=rg-caythong`, `APP=caythongloinhan`, `REPO=d23520229/cay-thong-loi-nhan`; hậu tố `SUF=$(openssl rand -hex 2)`; `PG=psql-caythong-$SUF`; `ST=stcaythong$SUF`. Hỏi bằng `read` (bỏ qua nếu biến đã đặt): `GOOGLE_CLIENT_ID`, `ADMIN_BOOTSTRAP_EMAIL`, `SUPPORT_EMAIL`, `ALERT_EMAIL`; rỗng → dừng. Các bước theo đặc tả 6.10.2, mỗi bước `echo "▶ <việc>"`:
  1. `az account show` → in tên subscription, hỏi "Đúng tài khoản Azure for Students? (y/N)".
  2. Kiểm vùng: `az policy assignment list --query "[?contains(displayName,'location') || contains(displayName,'Location')].parameters"` — có danh sách mà thiếu `$LOCATION` → in danh sách, `exit 1`. Không có chính sách → tiếp.
  3. Kiểm tên: `nslookup $APP.azurewebsites.net` phân giải được → "Tên $APP đã có người dùng — đổi APP=... rồi chạy lại", `exit 1`. Kiểm `az group exists -n $RG` = true → "Đã có $RG (chạy lần trước?) — xoá bằng az group delete -n $RG hoặc tạo tiếp tay", `exit 1`.
  4. `az group create`.
  5. `PGPASS="Aa1$(openssl rand -hex 16)"`; `az postgres flexible-server create -g $RG -n $PG -l $LOCATION --tier Burstable --sku-name Standard_B1ms --version 16 --storage-size 32 --backup-retention 7 --admin-user ctlnadmin --admin-password "$PGPASS" --public-access 0.0.0.0 --database-name caythong --yes -o none`. `DATABASE_URL=postgres://ctlnadmin:$PGPASS@$PG.postgres.database.azure.com:5432/caythong`.
  6. `az storage account create -g $RG -n $ST -l $LOCATION --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false -o none`; lấy chuỗi kết nối vào biến; `az storage container create -n photos --public-access off --connection-string ... -o none`.
  7. `az appservice plan create -g $RG -n asp-caythong --is-linux --sku B1 -l $LOCATION -o none`; `az webapp create -g $RG -p asp-caythong -n $APP --runtime "NODE:22-lts" -o none`; `az webapp config set ... --always-on true --ftps-state Disabled --min-tls-version 1.2 --startup-file "node dist/index.js" --generic-configurations '{"healthCheckPath":"/healthz"}' -o none`; `az webapp update ... --https-only true -o none`.
  8. App settings (đặc tả 6.10.3) bằng một lệnh `az webapp config appsettings set ... --settings ... -o none`; `PEPPER` và `BLOCK_IP_KEY` = `openssl rand -hex 24` (48 ký tự); 4 mốc ngày chép từ `.env.example`; `ADMIN_AZURE_URL=https://portal.azure.com/#@/resource/subscriptions/$SUB/resourceGroups/$RG`.
  9. `az identity create -g $RG -n id-caythong-github`; `az identity federated-credential create --identity-name id-caythong-github -g $RG -n github-main --issuer https://token.actions.githubusercontent.com --subject repo:$REPO:environment:production --audiences api://AzureADTokenExchange -o none`; `az role assignment create --assignee-object-id <principalId> --assignee-principal-type ServicePrincipal --role "Website Contributor" --scope <id Web App> -o none`.
  10. `az consumption budget create --budget-name caythong-40usd --amount 40 --category cost --time-grain monthly --start-date <ngày 1 tháng này> --end-date 2027-01-31 ...` kèm thông báo email `ALERT_EMAIL` ở 100 %; lỗi (subscription không hỗ trợ) → không dừng (`|| echo "…xem credit tại https://www.microsoftazuresponsorships.com/balance"`). Nếu CLI không có tham số email cho budget → in hướng dẫn tạo cảnh báo trong Portal (Cost Management → Budgets).
  11. In: 3 giá trị cho GitHub, URL trang, link Portal, và "Bước tiếp: infra/README.md mục GitHub".
- [ ] **Step 2: Viết `infra/README.md`** — các mục: Chuẩn bị (Google Cloud theo đặc tả 6.10.4: thêm origin, chuyển "In production"); Chạy script (`! az login` → `bash infra/tao-azure.sh`); GitHub (Settings → Environments → `production`, giới hạn nhánh `main`, 3 secret); Thử giai đoạn (lệnh đặt `FAKE_NOW` NOTICE / ENDED và lệnh xoá, đặc tả 6.10.6); Xem log (`az webapp log tail -g rg-caythong -n caythongloinhan`); Kết thúc 07/01/2027 (`az group delete -n rg-caythong --yes`).
- [ ] **Step 3: Kiểm** — `bash -n infra/tao-azure.sh` → không lỗi; `shellcheck infra/*.sh` nếu máy có; `grep -n "set -x" infra/tao-azure.sh` → không có; `grep -n 'echo.*\(PGPASS\|PEPPER\|BLOCK_IP_KEY\|CONN\)' infra/tao-azure.sh` → không có. **Không chạy thật** — chủ dự án chạy sau khi duyệt.
- [ ] **Step 4: Commit** — `git commit -m "infra: script tạo tài nguyên Azure + hướng dẫn (đặc tả 6.10.2–6.10.4)"`

### Task 5: Tiến độ + bàn giao cho chủ dự án

**Files:**
- Modify: `docs/tien-do.md` (mục Hiện tại, Lịch mốc M4, thêm "M4 khối 2 — việc của chủ dự án", Nhật ký; ghi việc tạm `FAKE_NOW` phải gỡ trước 10/12)

- [ ] **Step 1:** `pnpm typecheck && pnpm test` → qua hết.
- [ ] **Step 2:** cập nhật `tien-do.md`; commit `docs: tiến độ M4 khối 2`.
- [ ] **Step 3:** hỏi chủ dự án trước khi push và mở PR (chưa có `gh`: đưa link `https://github.com/d23520229/cay-thong-loi-nhan/compare/main...m4-khoi2`). Kiểm Task 3 Step 4.
- [ ] **Step 4:** dừng. Chủ dự án: Google Cloud → `az login` + chạy script → environment + secret GitHub → gộp PR → theo dõi lần triển khai đầu.

### Task 6 (sau lần triển khai đầu): kiểm trên Azure — đặc tả 6.10.7

- [ ] **Step 1: Sao lưu PostgreSQL** — đọc tài liệu Azure "restore a dropped server" (Flexible Server); ghi số ngày giữ bản sao lưu sau khi xoá vào `tien-do.md`. Nếu > 0: đề xuất câu mới cho `/chinh-sach`, **chờ chủ dự án duyệt chữ** rồi mới sửa (kèm test web nếu có test chữ chính sách).
- [ ] **Step 2: IPv6** — tra tài liệu App Service IPv6 inbound cho gói Basic; bật được miễn phí bằng CLI → thêm lệnh vào `tao-azure.sh` + chạy lệnh đó trên app thật (hỏi chủ dự án trước); không → ghi lý do vào `tien-do.md`.
- [ ] **Step 3: PostgreSQL miễn phí cho sinh viên** — xem Cost Management / mục "Free services" của subscription; ghi kết quả, sửa bảng chi phí đặc tả 13 nếu khác.
- [ ] **Step 4: `TRUST_PROXY_HOPS`** — chủ dự án mở trang từ wifi và 4G; trên `/quan-tri` (hoặc log) thấy hai lượt có IP băm khác nhau. Giống nhau → báo, không tự đổi.
- [ ] **Step 5: Commit** các thay đổi tài liệu.

### Task 7 (khi chủ dự án báo đã thử NOTICE / ENDED, trước 10/12): trả lệnh cấm `FAKE_NOW`

**Files:** `apps/server/src/env.ts`, `apps/server/test/security.test.ts`, `docs/tien-do.md`

- [ ] **Step 1:** `git revert` commit Task 1 (hoặc trả tay đúng dòng cũ và test cũ `'production không cho đặt FAKE_NOW'` với `toThrow(/FAKE_NOW/)`).
- [ ] **Step 2:** `pnpm --filter @ctln/server test` → qua.
- [ ] **Step 3:** nhắc chủ dự án chạy `az webapp config appsettings delete -g rg-caythong -n caythongloinhan --setting-names FAKE_NOW` **trước** khi gộp (không thì app không khởi động được sau triển khai); kiểm bằng `az webapp config appsettings list ... --query "[?name=='FAKE_NOW']"` → `[]`.
- [ ] **Step 4:** cập nhật `tien-do.md` (gỡ việc tạm); commit; PR → gộp → CI/CD triển khai → kiểm khói xanh.
