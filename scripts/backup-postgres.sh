#!/usr/bin/env bash
# 每周备份 PostgreSQL：导出到 backups/postgres，再同步到腾讯云 COS。
# 未配置 COS_ALIAS 时只做本地备份。
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f deploy/backup.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source deploy/backup.env
  set +a
fi

COS_ALIAS=${COS_ALIAS:-}
COS_PREFIX=${COS_PREFIX:-lawson-website/postgres}
BACKUP_RETENTION=${BACKUP_RETENTION:-4}
BACKUP_DIR=${BACKUP_DIR:-backups/postgres}
COMPOSE_FILE=${COMPOSE_FILE:-compose.prod.yaml}
ENV_FILE=${ENV_FILE:-.env.production}

mkdir -p "$BACKUP_DIR"

if [[ ! "$BACKUP_RETENTION" =~ ^[1-9][0-9]*$ ]]; then
  echo "BACKUP_RETENTION 必须是正整数" >&2
  exit 1
fi

stamp=$(date -u +%Y%m%dT%H%M%SZ)
dump="$BACKUP_DIR/lawson_website-$stamp.dump"
tmp=$(mktemp "$BACKUP_DIR/.lawson_website-XXXXXX")
trap 'rm -f "$tmp"' EXIT

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  sh -c 'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' \
  >"$tmp"

if [[ ! -s "$tmp" ]]; then
  echo "备份文件为空，已停止" >&2
  exit 1
fi

# 检查归档目录可读，再将备份发布为正式文件。
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_restore --list <"$tmp" >/dev/null
mv "$tmp" "$dump"

echo "已导出 $dump"

# 文件名中的 UTC 时间戳可直接排序；数组保留路径中的空格和换行。
shopt -s nullglob
backups=("$BACKUP_DIR"/lawson_website-*.dump)
remove_count=$((${#backups[@]} - BACKUP_RETENTION))
if ((remove_count > 0)); then
  rm -f -- "${backups[@]:0:remove_count}"
fi

if [[ -z "$COS_ALIAS" ]]; then
  echo "未配置 COS_ALIAS，跳过上传"
  exit 0
fi

# 仅上传本次成功生成的备份；云端保留策略由存储桶独立管理。
coscli cp "$dump" "cos://$COS_ALIAS/$COS_PREFIX/$(basename "$dump")"
echo "已上传到 cos://$COS_ALIAS/$COS_PREFIX/"
