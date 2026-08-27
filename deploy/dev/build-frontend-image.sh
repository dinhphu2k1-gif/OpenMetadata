#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
IMAGE_NAME="openmetadata/frontend:custom-1.13.3"

cd "$PROJECT_ROOT/openmetadata-ui/src/main/resources/ui"
yarn install --ignore-engines
yarn build
cd "$PROJECT_ROOT"
docker build -f deploy/dev/Dockerfile.frontend -t "$IMAGE_NAME" .