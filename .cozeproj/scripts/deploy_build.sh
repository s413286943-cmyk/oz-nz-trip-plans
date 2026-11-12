#!/usr/bin/env bash
# Coze 正式部署：构建后去掉开发依赖（浏览器测试工具），运行包只留 next 和构建产物。
set -euo pipefail
cd "$(dirname "$0")/../.."
npm ci --no-audit --no-fund
npm run build
npm prune --omit=dev --no-audit --no-fund
