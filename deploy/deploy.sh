#!/usr/bin/env bash
set -euo pipefail

# ============================================
# 初屿会员系统 — 部署脚本
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

echo "=== 1/5 构建 admin-web 静态文件 ==="
if command -v pnpm &>/dev/null; then
  pnpm install --frozen-lockfile
  pnpm --filter @member-platform/shared build
  VITE_API_BASE_URL=/api pnpm --filter @member-platform/admin-web build
else
  echo "服务器未安装 pnpm，将在本地构建 admin-web 后上传 dist 目录"
  if [ ! -d "apps/admin-web/dist" ]; then
    echo "错误: apps/admin-web/dist 不存在，请先在本地运行:"
    echo "  VITE_API_BASE_URL=/api pnpm --filter @member-platform/admin-web build"
    exit 1
  fi
fi

echo "=== 2/5 构建 Docker 镜像 ==="
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" build

echo "=== 3/5 启动服务 ==="
docker compose -f docker-compose.production.yml --env-file "$ENV_FILE" up -d

echo "=== 4/5 等待数据库就绪 ==="
sleep 5

echo "=== 5/5 运行数据库迁移 + 初始数据 ==="
docker compose -f docker-compose.production.yml exec api \
  npx prisma migrate deploy

docker compose -f docker-compose.production.yml exec api \
  node dist/apps/api/src/seed.js

echo ""
echo "========================================="
echo "  部署完成！"
echo ""
echo "  管理后台: http://114.215.179.81"
echo "  API 地址: http://114.215.179.81/api"
echo ""
echo "  小程序端 API 地址配置:"
echo "    VITE_API_BASE_URL=http://114.215.179.81/api"
echo ""
echo "  查看日志: docker compose -f docker-compose.production.yml logs -f"
echo "========================================="
