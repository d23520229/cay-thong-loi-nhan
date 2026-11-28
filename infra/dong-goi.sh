#!/usr/bin/env bash
# Gói server + bản build web vào out/ để đưa lên Azure App Service (đặc tả 6.10.5).
# Chạy từ gốc repo, sau `pnpm build`. CI nén out/ thành zip; trên máy có thể chạy thử:
#   cd out && WEB_DIST="$PWD/web" DATABASE_URL=... node dist/index.js
set -euo pipefail

for f in apps/server/dist/index.js apps/web/dist/index.html; do
  if [ ! -f "$f" ]; then
    echo "Thiếu $f. Chạy pnpm build trước." >&2
    exit 1
  fi
done

rm -rf out
# node_modules phẳng, không symlink: zip deploy của App Service không giữ symlink.
pnpm --filter @ctln/server deploy --prod --config.node-linker=hoisted out
cp -r apps/web/dist out/web

missing=0
for f in dist/index.js dist/db/migrations/0000_init.sql web/index.html \
  node_modules/sharp/package.json node_modules/@ctln/shared/package.json \
  node_modules/@ctln/art/package.json node_modules/fastify/package.json; do
  if [ ! -e "out/$f" ]; then
    echo "Gói thiếu out/$f" >&2
    missing=1
  fi
done
[ "$missing" -eq 0 ] || exit 1

if [ -n "$(find out -type l | head -1)" ]; then
  echo "Gói còn symlink: $(find out -type l | head -1)" >&2
  exit 1
fi

echo "Đã đóng gói vào out/ ($(du -sh out | cut -f1))"
