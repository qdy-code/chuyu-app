#!/usr/bin/env bash
set -euo pipefail

# ============================================
# 月光石屿会员系统 - 服务器初始化脚本
# 在全新的 Alibaba Cloud Linux / Ubuntu / Debian 服务器上运行
# 用法: bash setup-server.sh
# ============================================

APP_DIR="/opt/chuyu-app"
BACKUP_DIR="/var/backups/moonisle"

if [ "$(id -u)" -ne 0 ]; then
  echo "错误: 请使用 root 运行服务器初始化脚本" >&2
  exit 1
fi

install_packages() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "$@"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y "$@"
  elif command -v yum >/dev/null 2>&1; then
    yum install -y "$@"
  else
    echo "错误: 不支持当前系统的包管理器" >&2
    exit 1
  fi
}

echo "=== 1/6 安装基础工具 ==="
install_packages curl ca-certificates git tar gzip util-linux

echo "=== 2/6 安装 Docker ==="
if ! command -v docker &>/dev/null; then
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
  fi

  if [ "${ID:-}" = "alinux" ] || [ "${PLATFORM_ID:-}" = "platform:al8" ]; then
    curl -fsSL \
      http://mirrors.cloud.aliyuncs.com/docker-ce/linux/centos/docker-ce.repo \
      -o /etc/yum.repos.d/docker-ce.repo
    sed -i 's|https://mirrors.aliyun.com|http://mirrors.cloud.aliyuncs.com|g' \
      /etc/yum.repos.d/docker-ce.repo
    dnf -y install dnf-plugin-releasever-adapter --repo alinux3-plus
    dnf -y install \
      docker-ce \
      docker-ce-cli \
      containerd.io \
      docker-buildx-plugin \
      docker-compose-plugin
  else
    curl -fsSL https://get.docker.com | bash
  fi
  echo "Docker 已安装"
else
  echo "Docker 已存在，跳过"
fi
systemctl enable --now docker

echo "=== 3/6 安装 Docker Compose 插件 ==="
if ! docker compose version &>/dev/null; then
  install_packages docker-compose-plugin
  echo "Docker Compose 已安装"
else
  echo "Docker Compose 已存在，跳过"
fi

echo "=== 4/6 创建项目与备份目录 ==="
install -d -m 755 "$APP_DIR"
install -d -m 700 "$BACKUP_DIR"
echo "项目目录: $APP_DIR"
echo "备份目录: $BACKUP_DIR"

echo "=== 5/6 配置 2 GiB Swap ==="
if ! swapon --show | grep -q .; then
  if ! command -v fallocate >/dev/null 2>&1; then
    install_packages util-linux
  fi
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Swap 已启用"
else
  echo "Swap 已存在，跳过"
fi

echo "=== 6/6 完成环境检查 ==="
docker version >/dev/null
docker compose version
git --version

echo ""
echo "========================================="
echo "  服务器环境准备完成！"
echo "  下一步：将代码推送到服务器并运行部署"
echo "========================================="
