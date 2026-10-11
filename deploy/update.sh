#!/usr/bin/env bash
set -euo pipefail

# ============================================
# 月光石屿会员系统 - 更新部署脚本（Git 模式）
# 用法（在服务器 /opt/chuyu-app 目录运行）：
#   bash deploy/update.sh
# ============================================

APP_DIR="/opt/chuyu-app"
cd "$APP_DIR"

if [ ! -f deploy/.env.production ]; then
  echo "错误: deploy/.env.production 不存在"
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "错误: 服务器工作区存在未提交修改，请先人工确认，更新已停止" >&2
  exit 1
fi

echo "=== 拉取最新代码 ==="
git fetch origin main
git merge --ff-only origin/main

echo "=== 执行备份、迁移与健康检查 ==="
bash deploy/deploy.sh

echo ""
echo "========================================="
echo "  更新完成！"
echo "  查看 deploy/.env.production 中的 APP_DOMAIN 获取后台地址"
echo "========================================="
