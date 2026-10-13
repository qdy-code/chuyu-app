#!/usr/bin/env bash
set -euo pipefail

# ============================================
# 月光石屿会员系统 - 生产部署脚本
# 在服务器的项目目录中运行
# 用法: bash deploy/deploy.sh
# ============================================

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "=== 工作目录: $APP_DIR ==="

# 检查 .env 文件
ENV_FILE="deploy/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  echo "错误: 找不到 $ENV_FILE，请先配置环境变量"
  exit 1
fi

echo "=== 1/8 校验正式配置 ==="
if [ ! -f "apps/api/prisma.config.ts" ]; then
  echo "错误: apps/api/prisma.config.ts 不存在，Prisma 无法读取生产数据库配置"
  exit 1
fi

docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" config --quiet

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/moonisle}"
if [ "$(id -u)" -eq 0 ]; then
  install -d -m 700 "$BACKUP_DIR"
fi

if [ -f "deploy/moonisle-backup.cron" ]; then
  if [ "$(id -u)" -eq 0 ]; then
    install -m 644 deploy/moonisle-backup.cron /etc/cron.d/moonisle-backup
  else
    echo "提示: 当前用户不是 root，未更新 /etc/cron.d/moonisle-backup"
  fi
fi

echo "=== 2/8 备份现有数据库与上传图片 ==="
bash deploy/backup.sh

echo "=== 3/8 构建 Docker 镜像 ==="
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" build

echo "=== 4/8 启动并等待数据库 ==="
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" up -d postgres
for attempt in $(seq 1 24); do
  if docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" exec -T postgres \
    pg_isready -U chuyu -d member_platform >/dev/null; then
    break
  fi
  if [ "$attempt" -eq 24 ]; then
    echo "错误: PostgreSQL 未在预期时间内就绪" >&2
    exit 1
  fi
  sleep 5
done

echo "=== 5/8 运行数据库迁移 ==="
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" run --rm --no-deps migration \
  npx prisma migrate deploy

echo "=== 6/8 启动应用服务 ==="
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" up -d --remove-orphans api web

echo "=== 7/8 验证服务健康状态 ==="
for attempt in $(seq 1 24); do
  if docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" exec -T api \
    node -e "fetch('http://127.0.0.1:3000/health/ready').then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())}).catch(()=>process.exit(1))"; then
    break
  fi
  if [ "$attempt" -eq 24 ]; then
    echo "错误: API 健康检查未通过，请查看容器日志" >&2
    exit 1
  fi
  sleep 5
done

echo "=== 8/8 生成并校验部署后基线备份 ==="
bash deploy/backup.sh

echo ""
echo "========================================="
echo "  部署完成！"
echo ""
echo "  管理后台: https://${APP_DOMAIN:-moonisle.shop}"
echo "  API 地址: https://${APP_DOMAIN:-moonisle.shop}/api"
echo ""
echo "  小程序端 API 地址配置:"
echo "    VITE_API_BASE_URL=https://${APP_DOMAIN:-moonisle.shop}/api"
echo ""
echo "  查看日志: docker compose -f docker-compose.production.yml logs -f"
echo "========================================="
