#!/usr/bin/env bash
# ============================================================
# Atlas - 路过 本地部署运行脚本
#
# 用法：
#   ./run.sh              # 开发模式（默认）：装依赖 + 构建 shared + 生成素材 + 启动 素材/前/后端
#   ./run.sh dev          # 同上
#   ./run.sh build        # 仅编译：shared + 后端 + 前端（web 产物）
#   ./run.sh prod         # 生产模式：编译后以生产方式启动 素材/前/后端
#   ./run.sh assets       # 仅生成素材（从开放图库拉取真实景点照到 resources/assets）
#   ./run.sh assets --force  # 覆盖重新生成素材
#   ./run.sh install      # 仅安装依赖
#   ./run.sh stop         # 停止本脚本启动的进程（素材/前/后端）
#
# 选项：
#   --host <addr>         # 统一设置三个服务的绑定地址（前/后端/素材）
#                         #   云上 pod / 容器内对外暴露：用 0.0.0.0（默认）
#                         #   仅本机访问：用 127.0.0.1
#                         # 等价环境变量：HOST=0.0.0.0 ./run.sh
#                         # 可按服务细分：FRONTEND_HOST / BACKEND_HOST / ASSET_HOST
#   --host 仅对启动类模式（dev/prod）生效
#
# 端口（可用环境变量或 .env 覆盖，默认值如下）：
#   FRONTEND_PORT=3000    后端 PORT=3001    素材服务 ASSET_PORT=4001
# ============================================================

set -euo pipefail

# 切到脚本所在目录（仓库根）
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# 解析参数：第一个非选项参数为 MODE，--host <addr> 设置绑定地址
MODE=""
ASSETS_ARG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --host)
      [ $# -ge 2 ] || { echo "--host 需要一个地址参数" >&2; exit 1; }
      HOST="$2"
      shift 2
      ;;
    --host=*)
      HOST="${1#*=}"
      shift
      ;;
    --force)
      ASSETS_ARG="--force"
      shift
      ;;
    *)
      if [ -z "$MODE" ]; then MODE="$1"; else ASSETS_ARG="$1"; fi
      shift
      ;;
  esac
done
MODE="${MODE:-dev}"

# 载入根目录 .env（若存在），用于端口等配置
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${PORT:-3001}"
ASSET_PORT="${ASSET_PORT:-4001}"
# 绑定地址：默认 0.0.0.0（云上 pod 内对外可达）；可用 --host 或 HOST 覆盖，亦可按服务细分。
HOST="${HOST:-0.0.0.0}"
FRONTEND_HOST="${FRONTEND_HOST:-$HOST}"
BACKEND_HOST="${BACKEND_HOST:-$HOST}"
ASSET_HOST="${ASSET_HOST:-$HOST}"
PID_DIR="$ROOT_DIR/.run"
mkdir -p "$PID_DIR"

# 日志展示用：0.0.0.0 对人显示为 localhost
show_host() { [ "$1" = "0.0.0.0" ] && echo "localhost" || echo "$1"; }

log()  { printf '\033[1;36m[atlas]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[atlas]\033[0m %s\n' "$*" >&2; }

require_tools() {
  command -v node >/dev/null 2>&1 || { err "未找到 node，请先安装 Node.js (>=18)"; exit 1; }
  command -v npm  >/dev/null 2>&1 || { err "未找到 npm"; exit 1; }
}

install_deps() {
  if [ ! -d "$ROOT_DIR/node_modules" ] || [ "${FORCE_INSTALL:-0}" = "1" ]; then
    log "安装 workspace 依赖 (npm install)…"
    npm install
  else
    log "依赖已存在，跳过安装（FORCE_INSTALL=1 可强制重装）"
  fi
}

build_shared()   { log "构建公共包 @atlas/shared…"; npm run build -w @atlas/shared; }
build_backend()  { log "编译后端 @atlas/backend…"; npm run build -w @atlas/backend; }
build_frontend() { log "编译前端 web @atlas/frontend…"; npm run build -w @atlas/frontend; }

# 素材缺失时自动从开放图库生成（已存在则跳过）
ensure_assets() {
  if [ ! -f "$ROOT_DIR/resources/assets/regions/region_chengdu/map.png" ]; then
    log "未检测到本地素材，尝试拉取真实景点照（resources/assets）…"
    node "$ROOT_DIR/scripts/gen-assets.mjs" || log "素材生成有失败项，运行时将由占位兜底"
  else
    log "本地素材已存在，跳过生成"
  fi
}

# 启动本地素材静态服务（模拟 CDN，托管 resources/assets）
start_asset_server() {
  log "启动素材服务 → http://$(show_host "$ASSET_HOST"):${ASSET_PORT}  (bind ${ASSET_HOST})"
  ASSET_PORT="$ASSET_PORT" ASSET_HOST="$ASSET_HOST" node "$ROOT_DIR/scripts/asset-server.mjs" &
  echo $! > "$PID_DIR/asset.pid"
}

stop_services() {
  for name in backend frontend asset; do
    pidfile="$PID_DIR/$name.pid"
    if [ -f "$pidfile" ]; then
      pid="$(cat "$pidfile" 2>/dev/null || true)"
      if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
        log "停止 $name (pid=$pid)…"
        kill "$pid" >/dev/null 2>&1 || true
      fi
      rm -f "$pidfile"
    fi
  done
}

# Ctrl+C / 退出时清理子进程
cleanup() { stop_services; }

run_dev() {
  require_tools
  install_deps
  build_shared
  ensure_assets
  trap cleanup INT TERM EXIT

  start_asset_server

  log "启动后端 (开发) → http://$(show_host "$BACKEND_HOST"):${BACKEND_PORT}  (bind ${BACKEND_HOST})"
  PORT="$BACKEND_PORT" HOST="$BACKEND_HOST" npm run start:dev -w @atlas/backend &
  echo $! > "$PID_DIR/backend.pid"

  log "启动前端 (开发) → http://$(show_host "$FRONTEND_HOST"):${FRONTEND_PORT}  (bind ${FRONTEND_HOST})"
  npm run dev -w @atlas/frontend -- -p "$FRONTEND_PORT" -H "$FRONTEND_HOST" &
  echo $! > "$PID_DIR/frontend.pid"

  log "素材/前/后端已启动，按 Ctrl+C 退出。"
  wait
}

run_build() {
  require_tools
  install_deps
  build_shared
  build_backend
  build_frontend
  log "编译完成。"
}

run_prod() {
  require_tools
  run_build
  ensure_assets
  trap cleanup INT TERM EXIT

  start_asset_server

  log "启动后端 (生产) → http://$(show_host "$BACKEND_HOST"):${BACKEND_PORT}  (bind ${BACKEND_HOST})"
  PORT="$BACKEND_PORT" HOST="$BACKEND_HOST" npm run start:prod -w @atlas/backend &
  echo $! > "$PID_DIR/backend.pid"

  log "启动前端 (生产) → http://$(show_host "$FRONTEND_HOST"):${FRONTEND_PORT}  (bind ${FRONTEND_HOST})"
  npm run start -w @atlas/frontend -- -p "$FRONTEND_PORT" -H "$FRONTEND_HOST" &
  echo $! > "$PID_DIR/frontend.pid"

  log "素材/前/后端已启动，按 Ctrl+C 退出。"
  wait
}

case "$MODE" in
  dev)     run_dev ;;
  build)   run_build ;;
  prod)    run_prod ;;
  assets)  require_tools; build_shared; node "$ROOT_DIR/scripts/gen-assets.mjs" "$ASSETS_ARG" ;;
  install) require_tools; FORCE_INSTALL=1 install_deps ;;
  stop)    stop_services; log "已停止。" ;;
  *)       err "未知模式：$MODE（可用：dev | build | prod | assets | install | stop）"; exit 1 ;;
esac
