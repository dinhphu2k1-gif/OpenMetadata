#!/usr/bin/env bash
# Builds the server image used by both the OpenMetadata and the Portal service. The server serves the
# web UI itself, so both UI builds are made first and packaged into the server jar. Set
# SKIP_UI_BUILD=true to reuse the existing ui/dist and ui/dist-portal.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
IMAGE_NAME="openmetadata/server:custom-1.13.3"

if [ "${SKIP_UI_BUILD:-false}" != "true" ]; then
    cd "$PROJECT_ROOT/openmetadata-ui/src/main/resources/ui"
    yarn install --ignore-engines
    yarn build
    yarn build:portal
fi

cd "$PROJECT_ROOT"
export MAVEN_OPTS="-Xmx4096m -XX:+UseG1GC"
mvn clean install \
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

docker build -f deploy/dev/Dockerfile.server -t "$IMAGE_NAME" .
