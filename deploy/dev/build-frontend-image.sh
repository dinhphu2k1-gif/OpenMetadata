#!/usr/bin/env bash
# ==============================================================================
# 🚀 Build Frontend Docker Image: openmetadata/frontend:custom-1.13.3
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
IMAGE_NAME="openmetadata/frontend:custom-1.13.3"

echo "=================================================="
echo "🚀 Bắt đầu build Frontend Docker Image: $IMAGE_NAME"
echo "=================================================="

# 1. Build mã nguồn React/Vite
echo ">> [1/2] Đang build Frontend UI (yarn build)..."
cd "$PROJECT_ROOT/openmetadata-ui/src/main/resources/ui"
yarn install --ignore-engines
yarn build

# 2. Đóng gói vào Nginx Docker Image
echo ">> [2/2] Đóng gói vào Nginx Docker Image..."
cd "$PROJECT_ROOT"
docker build -f deploy/dev/Dockerfile.frontend -t "$IMAGE_NAME" .

echo "=================================================="
echo "✅ Build thành công Frontend image: $IMAGE_NAME"
echo "=================================================="
