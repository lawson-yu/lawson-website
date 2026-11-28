#!/usr/bin/env bash
# 清理 24 个月前（按 lastVisitedAt）的访客文章与项目访问记录。
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE_FILE=${COMPOSE_FILE:-compose.prod.yaml}
ENV_FILE=${ENV_FILE:-.env.production}

SQL='
BEGIN;
DELETE FROM "ArticleVisit" WHERE "lastVisitedAt" < NOW() - INTERVAL '\''24 months'\'';
DELETE FROM "ProjectVisit" WHERE "lastVisitedAt" < NOW() - INTERVAL '\''24 months'\'';
COMMIT;
'

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  sh -c 'psql -v ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  <<<"$SQL"
