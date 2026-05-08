#!/usr/bin/env bash
set -euo pipefail

# ============================================
# 初屿会员系统 — 更新部署脚本（Git 模式）
# 用法（在服务器 /opt/chuyu-app 目录运行）：
#   bash deploy/update.sh
# ============================================

APP_DIR="/opt/chuyu-app"
cd "$APP_DIR"

if [ ! -f deploy/.env.production ]; then
  echo "错误: deploy/.env.production 不存在"
  exit 1
fi

echo "=== 1/5 拉取最新代码 ==="
git fetch --all
git reset --hard origin/main

echo "=== 2/5 本地构建 admin-web 静态文件 ==="
if command -v pnpm &>/dev/null; then
  pnpm install --frozen-lockfile
  pnpm --filter @member-platform/shared build
  VITE_API_BASE_URL=/api pnpm --filter @member-platform/admin-web build
else
  echo "服务器未安装 pnpm，跳过 admin-web 本地构建"
  echo "请确保 apps/admin-web/dist 已通过 git 提交或本地推送"
fi

echo "=== 3/5 重新构建 Docker 镜像 ==="
docker compose -f docker-compose.production.yml --env-file deploy/.env.production build

echo "=== 4/5 重启服务 ==="
docker compose -f docker-compose.production.yml --env-file deploy/.env.production up -d

echo "=== 5/5 应用数据库迁移 ==="
sleep 3
docker compose -f docker-compose.production.yml exec -T api npx prisma migrate deploy

echo ""
echo "========================================="
echo "  更新完成！"
echo "  https://chuy.shop"
echo "========================================="
