#!/usr/bin/env bash
# Coze 正式部署：端口取 DEPLOY_RUN_PORT / PORT，默认 5000。纯静态页面，没有数据库和密钥。
set -euo pipefail
cd "$(dirname "$0")/../.."
export NODE_ENV=production
export PORT="${DEPLOY_RUN_PORT:-${PORT:-5000}}"
exec node node_modules/next/dist/bin/next start -p "$PORT" -H 0.0.0.0
