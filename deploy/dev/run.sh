#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.dev.yml"

echo "Chon thanh phan can build:"
echo "1) Frontend (Chi build va recreate container UI)"
echo "2) Backend (Chi build va recreate container Server)"
echo "3) Ca hai (Frontend & Backend)"
echo "4) Khong build (Chi khoi dong lai toan bo)"
read -rp "Lua chon [1-4] (mac dinh 1): " choice
choice=${choice:-1}

# 1. Build va recreate Frontend (Chi tac dong container openmetadata_ui)
if [ "$choice" = "1" ]; then
    echo ">> [1/2] Dang build Frontend UI..."
    cd "$PROJECT_ROOT/openmetadata-ui/src/main/resources/ui"
    yarn install --ignore-engines
    yarn build

    cd "$PROJECT_ROOT"
    docker build -f "$SCRIPT_DIR/Dockerfile.frontend" -t openmetadata/frontend:custom-1.13.3 .

    echo ">> [2/2] Dang cap nhat lai container Frontend (khong dung Backend)..."
    cd "$SCRIPT_DIR"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate openmetadata-ui

# 2. Build va recreate Backend (Chi tac dong container openmetadata_server)
elif [ "$choice" = "2" ]; then
    echo ">> [1/2] Dang build Backend Java qua Maven..."
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

    docker build -f "$SCRIPT_DIR/Dockerfile.backend" -t openmetadata/server:custom-1.13.3 .

    echo ">> [2/2] Dang cap nhat lai container Backend..."
    cd "$SCRIPT_DIR"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate openmetadata-server

# 3. Build ca hai va recreate ca hai
elif [ "$choice" = "3" ]; then
    echo ">> [1/4] Dang build Backend..."
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

    docker build -f "$SCRIPT_DIR/Dockerfile.backend" -t openmetadata/server:custom-1.13.3 .

    echo ">> [2/4] Dang build Frontend..."
    cd "$PROJECT_ROOT/openmetadata-ui/src/main/resources/ui"
    yarn install --ignore-engines
    yarn build

    cd "$PROJECT_ROOT"
    docker build -f "$SCRIPT_DIR/Dockerfile.frontend" -t openmetadata/frontend:custom-1.13.3 .

    echo ">> [3/4] Dang cap nhat lai ca hai container..."
    cd "$SCRIPT_DIR"
    docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate openmetadata-server openmetadata-ui

# 4. Khoi dong lai toan bo
elif [ "$choice" = "4" ]; then
    echo ">> Dang khoi dong toan bo he thong..."
    cd "$SCRIPT_DIR"
    docker compose -f "$COMPOSE_FILE" up -d
fi

echo ""
echo "Hoan tat!"
echo "- Frontend UI: http://localhost:3000"
echo "- Backend API: http://localhost:8585"
