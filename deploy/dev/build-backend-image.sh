#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
IMAGE_NAME="openmetadata/server:custom-1.13.3"

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

docker build -f deploy/dev/Dockerfile.backend -t "$IMAGE_NAME" .
