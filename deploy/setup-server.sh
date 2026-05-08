#!/usr/bin/env bash
set -euo pipefail

# ============================================
# 初屿会员系统 — 服务器初始化脚本
# 在全新的 Ubuntu/Debian 服务器上运行
# 用法: bash setup-server.sh
# ============================================

APP_DIR="/opt/chuyu-app"

echo "=== 1/4 安装 Docker ==="
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker
  systemctl start docker
  echo "Docker 已安装"
else
  echo "Docker 已存在，跳过"
fi

echo "=== 2/4 安装 Docker Compose 插件 ==="
if ! docker compose version &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq docker-compose-plugin
  echo "Docker Compose 已安装"
else
  echo "Docker Compose 已存在，跳过"
fi

echo "=== 3/4 创建项目目录 ==="
mkdir -p "$APP_DIR"
echo "项目目录: $APP_DIR"

echo "=== 4/4 安装 Git ==="
if ! command -v git &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq git
  echo "Git 已安装"
else
  echo "Git 已存在，跳过"
fi

echo ""
echo "========================================="
echo "  服务器环境准备完成！"
echo "  下一步：将代码推送到服务器并运行部署"
echo "========================================="
