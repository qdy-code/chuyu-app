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

echo "=== 1/7 校验正式配置与后台构建产物 ==="
if [ ! -d "apps/admin-web/dist" ]; then
  echo "错误: apps/admin-web/dist 不存在。请先在本地配置 apps/admin-web/.env.production 并运行:"
  echo "  pnpm --filter @member-platform/admin-web build:release"
  exit 1
fi

if [ ! -f "apps/api/prisma.config.ts" ]; then
  echo "错误: apps/api/prisma.config.ts 不存在，Prisma 无法读取生产数据库配置"
  exit 1
fi

docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" config --quiet

if [ -f "deploy/moonisle-backup.cron" ]; then
  if [ "$(id -u)" -eq 0 ]; then
    install -m 644 deploy/moonisle-backup.cron /etc/cron.d/moonisle-backup
  else
    echo "提示: 当前用户不是 root，未更新 /etc/cron.d/moonisle-backup"
  fi
fi

echo "=== 2/7 备份现有数据库与上传图片 ==="
bash deploy/backup.sh

echo "=== 3/7 构建 Docker 镜像 ==="
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" build

echo "=== 4/7 启动并等待数据库 ==="
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

echo "=== 5/7 运行数据库迁移 ==="
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" run --rm --no-deps api \
  npx prisma migrate deploy

echo "=== 6/7 启动应用服务 ==="
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" up -d api nginx

echo "=== 7/7 验证服务健康状态 ==="
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

echo ""
echo "========================================="
echo "  部署完成！"
echo ""
echo "  管理后台: https://chuy.shop"
echo "  API 地址: https://chuy.shop/api"
echo ""
echo "  小程序端 API 地址配置:"
echo "    VITE_API_BASE_URL=https://chuy.shop/api"
echo ""
echo "  查看日志: docker compose -f docker-compose.production.yml logs -f"
echo "========================================="
