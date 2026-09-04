#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

ENV_FILE="deploy/.env.production"
COMPOSE_FILE="docker-compose.production.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "错误: 找不到 $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/moonisle}"
MANIFEST="${1:-$(find "$BACKUP_DIR" -maxdepth 1 -name 'backup-*.sha256' -type f | sort | tail -n 1)}"

if [ -z "$MANIFEST" ] || [ ! -f "$MANIFEST" ]; then
  echo "错误: 找不到备份校验文件" >&2
  exit 1
fi

cd "$BACKUP_DIR"
sha256sum --check "$(basename "$MANIFEST")"

DATABASE_FILE="$(awk '/database-.*\.dump$/ { print $2; exit }' "$MANIFEST")"
if [ -z "$DATABASE_FILE" ] || [ ! -f "$DATABASE_FILE" ]; then
  echo "错误: 校验文件中没有可用的数据库备份" >&2
  exit 1
fi

cd "$APP_DIR"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_restore --list < "$BACKUP_DIR/$DATABASE_FILE" >/dev/null

echo "备份校验通过: $MANIFEST"
