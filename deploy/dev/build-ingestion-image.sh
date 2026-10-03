#!/usr/bin/env bash
# Builds the ingestion (Airflow) image with DqrColumnSqlValidator on top of the stock image.
# After building, set INGESTION_IMAGE=openmetadata/ingestion:custom-1.13.3 in deploy/dev/.env.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
IMAGE_NAME="openmetadata/ingestion:custom-1.13.3"

cd "$PROJECT_ROOT"
docker build -f deploy/dev/Dockerfile.ingestion -t "$IMAGE_NAME" .
echo "Built $IMAGE_NAME. Set INGESTION_IMAGE=$IMAGE_NAME in deploy/dev/.env"
