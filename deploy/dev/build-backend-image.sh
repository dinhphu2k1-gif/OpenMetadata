#!/usr/bin/env bash
# ==============================================================================
# 🚀 Build Backend Docker Image: openmetadata/server:custom-1.13.3
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
IMAGE_NAME="openmetadata/server:custom-1.13.3"

echo "=================================================="
echo "🚀 Bắt đầu build Backend Docker Image: $IMAGE_NAME"
echo "=================================================="

# 1. Build Backend & Packaging (.tar.gz) bằng Maven
echo ">> [1/2] Đang compile Java Backend & tạo distribution package..."
cd "$PROJECT_ROOT"
export MAVEN_OPTS="-Xmx4096m -XX:+UseG1GC"
mvn install \
    -pl :openmetadata-dist \
    -am \
    -T 1C \
    -DskipTests \
    -DskipITs \
    -Dmaven.javadoc.skip=true \
    -Dcheckstyle.skip=true \
    -Dspotbugs.skip=true \
    -Dpmd.skip=true \
    -Drat.skip=true \
    -Dlicense.skip=true \
    -Dmaven.source.skip=true \
    -Dskip.yarn=true \
    -Dskip.installyarn=true

# 2. Build Docker Image cho Server Backend
echo ">> [2/2] Đang build Docker Image '$IMAGE_NAME' từ deploy/dev/Dockerfile.backend..."
docker build -f deploy/dev/Dockerfile.backend -t "$IMAGE_NAME" .

echo "=================================================="
echo "✅ Build thành công Backend image: $IMAGE_NAME"
echo "=================================================="
