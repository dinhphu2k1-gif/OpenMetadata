#!/usr/bin/env bash
# Local development without building images. PostgreSQL and OpenSearch run in Docker; the
# OpenMetadata server, the Portal server and the Vite dev servers run on the host from the source tree.
#
#   ./local-dev.sh infra       start PostgreSQL + OpenSearch, stop the Docker server and portal,
#                              and create the read-only database user of the Portal
#   ./local-dev.sh compile     compile the backend (openmetadata-service)
#   ./local-dev.sh migrate     run the database migrations
#   ./local-dev.sh reindex     rebuild the OpenSearch indexes from PostgreSQL
#   ./local-dev.sh server      run the OpenMetadata server   (API :8585, admin :8586)
#   ./local-dev.sh portal      run the Portal server         (API :8595, admin :8596), read-only database user
#   ./local-dev.sh ui          run Vite for OpenMetadata     (http://localhost:3000 -> :8585)
#   ./local-dev.sh ui-portal   run Vite for the Portal       (http://localhost:3001 -> :8595)
#
# Backend change: Ctrl+C the server, then "./local-dev.sh server" again (it recompiles first).
# UI change: Vite reloads by itself.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
UI_DIR="$PROJECT_ROOT/openmetadata-ui/src/main/resources/ui"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.dev.yml"
CLASSPATH_FILE="$PROJECT_ROOT/openmetadata-dist/target/local-dev.classpath"
APP_CLASS=org.openmetadata.service.OpenMetadataApplication
OPS_CLASS=org.openmetadata.service.util.OpenMetadataOperations
CONFIG_FILE="$PROJECT_ROOT/conf/openmetadata.yaml"

MVN_FAST_FLAGS=(
    -o
    -Dmaven.test.skip=true
    -Dcheckstyle.skip=true
    -Dspotbugs.skip=true
    -Dpmd.skip=true
    -Drat.skip=true
    -Dlicense.skip=true
    -Dspotless.check.skip=true
    -Djacoco.skip=true
)

load_environment() {
    set -a
    # shellcheck disable=SC1091
    [ -f "$SCRIPT_DIR/.env" ] && source "$SCRIPT_DIR/.env"
    DB_DRIVER_CLASS=org.postgresql.Driver
    DB_SCHEME=postgresql
    DB_HOST=localhost
    DB_PORT=8001
    DB_USER=${DB_USER:-openmetadata_user}
    DB_USER_PASSWORD=${DB_USER_PASSWORD:-openmetadata_password}
    DB_PARAMS=${DB_PARAMS:-allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC+7}
    OM_DATABASE=${OM_DATABASE:-openmetadata_db}
    SEARCH_TYPE=opensearch
    ELASTICSEARCH_HOST=localhost
    ELASTICSEARCH_PORT=8086
    ELASTICSEARCH_SCHEME=http
    PIPELINE_SERVICE_CLIENT_ENABLED=${PIPELINE_SERVICE_CLIENT_ENABLED:-false}
    set +a
}

compile_backend() {
    cd "$PROJECT_ROOT"
    mvn -q compile -pl openmetadata-service "${MVN_FAST_FLAGS[@]}"
}

# Dependencies are resolved the way the release package resolves them (openmetadata-dist), so the jar
# versions match the Docker image; resolving from openmetadata-service alone picks a different
# jetty-util and the server fails with NoSuchMethodError. openmetadata-service comes from
# target/classes instead of its jar, and the UI jar is left out because the UI runs in Vite.
backend_classpath() {
    if [ ! -f "$CLASSPATH_FILE" ] || [ "$PROJECT_ROOT/pom.xml" -nt "$CLASSPATH_FILE" ] \
        || [ "$PROJECT_ROOT/openmetadata-service/pom.xml" -nt "$CLASSPATH_FILE" ]; then
        mkdir -p "$(dirname "$CLASSPATH_FILE")"
        cd "$PROJECT_ROOT"
        mvn -q -o dependency:build-classpath -pl openmetadata-dist -am \
            -Dmdep.includeScope=runtime -Dmdep.outputFile="$CLASSPATH_FILE"
    fi
    local dependencies
    dependencies="$(tr ':' '\n' < "$CLASSPATH_FILE" \
        | grep -Ev '/openmetadata-(service|ui)-[0-9][^/]*\.jar$' | paste -sd: -)"
    echo "$PROJECT_ROOT/openmetadata-service/target/classes:$dependencies"
}

run_java() {
    local main_class=$1
    shift
    local classpath
    classpath="$(backend_classpath)"
    cd "$PROJECT_ROOT"
    exec java ${OPENMETADATA_HEAP_OPTS:--Xmx1G} -Dbootstrap.dir="$PROJECT_ROOT/bootstrap" \
        -cp "$classpath" "$main_class" "$@"
}

# The Portal reaches the database through a user that can only read, so a write it attempts fails here
# exactly as it does in production. A read-only session is not a "primary" server for the driver.
use_portal_database_user() {
    export DB_USER=portal_ro DB_USER_PASSWORD="${PORTAL_RO_PASSWORD:-portal_ro_password}"
    export DB_PG_TARGET_SERVER_TYPE=any
}

# Idempotent: creates the read-only user, or updates its password and grants on an existing database
apply_portal_role() {
    local attempt
    for attempt in $(seq 1 30); do
        docker exec openmetadata_postgresql psql -U postgres -d openmetadata_db -tAc 'select 1' > /dev/null 2>&1 && break
        sleep 3
    done
    docker exec -i openmetadata_postgresql psql -v ON_ERROR_STOP=1 -q -U postgres \
        -v portal_password="${PORTAL_RO_PASSWORD:-portal_ro_password}" \
        < "$SCRIPT_DIR/postgres-init/portal-read-only-role.sql"
}

run_server() {
    compile_backend
    load_environment
    export SERVER_PORT="$1" SERVER_ADMIN_PORT="$2" OM_PORTAL_ENABLED="$3"
    if [ "$3" = true ]; then
        use_portal_database_user
    fi
    export AUTHENTICATION_PUBLIC_KEYS="${AUTHENTICATION_PUBLIC_KEYS:-[http://localhost:$1/api/v1/system/config/jwks]}"
    run_java "$APP_CLASS" server "$CONFIG_FILE"
}

case "${1:-}" in
    infra)
        docker compose -f "$COMPOSE_FILE" stop openmetadata-server portal 2>/dev/null || true
        docker compose -f "$COMPOSE_FILE" up -d postgresql opensearch
        apply_portal_role
        ;;
    compile)
        compile_backend
        ;;
    migrate)
        compile_backend
        load_environment
        run_java "$OPS_CLASS" -c "$CONFIG_FILE" migrate --force
        ;;
    reindex)
        compile_backend
        load_environment
        run_java "$OPS_CLASS" -c "$CONFIG_FILE" reindex
        ;;
    server)
        run_server 8585 8586 false
        ;;
    portal)
        run_server 8595 8596 true
        ;;
    ui)
        cd "$UI_DIR"
        exec yarn start
        ;;
    ui-portal)
        cd "$UI_DIR"
        exec yarn start:portal
        ;;
    *)
        sed -n '2,18p' "$0"
        exit 1
        ;;
esac
