#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

ENV_FILE="deploy/.env.production"
COMPOSE_FILE="docker-compose.production.yml"
BACKUP_DIR="backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

if [ -z "$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q postgres 2>/dev/null)" ]; then
  echo "未发现当前 Compose 数据库容器，跳过自动备份。首次接管旧环境时必须先人工确认旧数据库位置。"
  exit 0
fi

echo "备份 PostgreSQL..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U chuyu -d member_platform --format=custom > "$BACKUP_DIR/database-$TIMESTAMP.dump"

if [ -n "$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q api 2>/dev/null)" ]; then
  echo "备份上传图片..."
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T api \
    tar -czf - -C /app/apps/api/uploads . > "$BACKUP_DIR/uploads-$TIMESTAMP.tar.gz"
else
  echo "未发现当前 API 容器，跳过上传图片自动备份。"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'database-*.dump' -o -name 'uploads-*.tar.gz' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "备份完成: $BACKUP_DIR/*-$TIMESTAMP.*"
