#!/usr/bin/env bash
# 统一的生产环境 docker compose 入口。
# 永远要带 --env-file，否则 ${ADMIN_PASSWORD} 等占位符全部展开成空字符串，
# 导致 api 启动后管理员登录、JWT 校验、微信小程序登录全部失效。
#
# 用法（在项目根目录执行）：
#   ./deploy/compose.sh up -d           # 启动全部服务
#   ./deploy/compose.sh up -d --no-deps api   # 只重启 api
#   ./deploy/compose.sh logs -f api     # 看 api 日志
#   ./deploy/compose.sh restart api     # 重启 api（但不重新拉环境，慎用）
#
set -euo pipefail

# 始终从 repo 根目录运行，避免相对路径出错
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

ENV_FILE="deploy/.env.production"
COMPOSE_FILE="docker-compose.production.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FATAL: $ENV_FILE missing. Copy deploy/.env.production.example and fill in real secrets." >&2
  exit 1
fi

exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
