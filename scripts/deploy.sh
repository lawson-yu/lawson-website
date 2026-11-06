#!/usr/bin/env bash
# 构建当前版本，先执行迁移，迁移成功后再更新应用。
set -euo pipefail
cd "$(dirname "$0")/.."

compose=(docker compose -f compose.prod.yaml --env-file .env.production)
"${compose[@]}" --profile migration build app migrate
"${compose[@]}" up -d --wait postgres
"${compose[@]}" --profile migration run --rm --no-deps migrate
"${compose[@]}" up -d --no-deps --wait app
"${compose[@]}" up -d --wait caddy
"${compose[@]}" ps
