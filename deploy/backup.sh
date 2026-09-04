#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

ENV_FILE="deploy/.env.production"
COMPOSE_FILE="docker-compose.production.yml"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

if [ ! -f "$ENV_FILE" ]; then
  echo "错误: 找不到 $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/moonisle}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

umask 077

mkdir -p "$BACKUP_DIR"

if [ -z "$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q postgres 2>/dev/null)" ]; then
  echo "未发现当前 Compose 数据库容器，跳过自动备份。首次接管旧环境时必须先人工确认旧数据库位置。"
  exit 0
fi

DATABASE_FILE="$BACKUP_DIR/database-$TIMESTAMP.dump"
DATABASE_TMP="$DATABASE_FILE.tmp"
UPLOAD_FILE="$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz"
UPLOAD_TMP="$UPLOAD_FILE.tmp"
MANIFEST_FILE="$BACKUP_DIR/backup-$TIMESTAMP.sha256"
MANIFEST_TMP="$MANIFEST_FILE.tmp"

cleanup() {
  rm -f "$DATABASE_TMP" "$UPLOAD_TMP" "$MANIFEST_TMP"
}
trap cleanup EXIT

echo "备份 PostgreSQL..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U chuyu -d member_platform --format=custom > "$DATABASE_TMP"

test -s "$DATABASE_TMP"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_restore --list < "$DATABASE_TMP" >/dev/null
mv "$DATABASE_TMP" "$DATABASE_FILE"

if [ -n "$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q api 2>/dev/null)" ]; then
  echo "备份上传图片..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T api \
    tar -czf - -C /app/apps/api/uploads . > "$UPLOAD_TMP"
  tar -tzf "$UPLOAD_TMP" >/dev/null
  mv "$UPLOAD_TMP" "$UPLOAD_FILE"
else
  echo "未发现当前 API 容器，跳过上传图片自动备份。"
fi

(
  cd "$BACKUP_DIR"
  sha256sum "$(basename "$DATABASE_FILE")" > "$MANIFEST_TMP"
  if [ -f "$UPLOAD_FILE" ]; then
    sha256sum "$(basename "$UPLOAD_FILE")" >> "$MANIFEST_TMP"
  fi
)
mv "$MANIFEST_TMP" "$MANIFEST_FILE"

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'database-*.dump' -o -name 'uploads-*.tar.gz' -o -name 'backup-*.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "备份完成并通过格式校验: $BACKUP_DIR/*-$TIMESTAMP.*"
