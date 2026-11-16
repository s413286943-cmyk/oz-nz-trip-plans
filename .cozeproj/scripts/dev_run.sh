#!/usr/bin/env bash
# Coze 开发预览：端口取项目根目录 .preview 的 expose_port，没有就用 5000。
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT="$(awk -F '[ =]+' '/^expose_port/ {gsub(/[^0-9]/, "", $2); print $2; exit}' .preview 2>/dev/null || true)"
export PORT="${PORT:-5000}"
fuser -k "${PORT}/tcp" 2>/dev/null || true
exec node node_modules/next/dist/bin/next start -p "$PORT" -H 0.0.0.0
