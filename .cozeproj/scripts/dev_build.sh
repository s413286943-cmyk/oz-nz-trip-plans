#!/usr/bin/env bash
# Coze 开发预览：装依赖并构建。
set -euo pipefail
cd "$(dirname "$0")/../.."
npm ci --no-audit --no-fund
npm run build
