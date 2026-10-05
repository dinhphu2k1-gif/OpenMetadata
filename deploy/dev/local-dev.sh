#!/usr/bin/env bash
# Local development without building images. PostgreSQL and OpenSearch run in Docker; the
# OpenMetadata server, the Portal server and the Vite dev servers run on the host from the source tree.
#
#   ./local-dev.sh infra       start PostgreSQL + OpenSearch, stop the Docker server and portal
#   ./local-dev.sh compile     compile the backend (openmetadata-service)
#   ./local-dev.sh migrate     run the database migrations
#   ./local-dev.sh reindex     rebuild the OpenSearch indexes from PostgreSQL
#   ./local-dev.sh server      run the OpenMetadata server   (API :8585, admin :8586)
#   ./local-dev.sh portal      run the Portal server         (API :8595, admin :8596), same database as the server
#   ./local-dev.sh ui          run Vite for OpenMetadata     (http://localhost:3000 -> :8585)
#   ./local-dev.sh ui-portal   run Vite for the Portal       (http://localhost:3001 -> :8595)
#   ./local-dev.sh ingestion   run Airflow in Docker (http://localhost:8080), needed for Test Connection,
#                              metadata ingestion and test pipelines; then start the server with
#                              WITH_INGESTION=true ./local-dev.sh server
#
# Backend change: Ctrl+C the server, then "./local-dev.sh server" again (it recompiles first, only the
# changed sources; FULL_COMPILE=true recompiles everything, SKIP_COMPILE=true does not compile).
# UI change: Vite reloads by itself.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
UI_DIR="$PROJECT_ROOT/openmetadata-ui/src/main/resources/ui"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.dev.yml"
CLASSPATH_FILE="$PROJECT_ROOT/openmetadata-dist/target/local-dev.classpath"
SPEC_CLASSES="$PROJECT_ROOT/openmetadata-spec/target/classes"
APP_CLASS=org.openmetadata.service.OpenMetadataApplication
OPS_CLASS=org.openmetadata.service.util.OpenMetadataOperations
CONFIG_FILE="$PROJECT_ROOT/conf/openmetadata.yaml"

# resolve.skip: the swagger plugin scans every resource class on each compile, which is not needed locally.
# The compiler recompiles all 1727 sources on every run because ReportsHandler.java produces no class;
# without incremental compilation only the sources newer than their class are compiled. A change to a
# signature used by an unchanged class then needs FULL_COMPILE=true.
MVN_FAST_FLAGS=(
    -o
    -Dresolve.skip=true
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
    if [ "${WITH_INGESTION:-false}" = true ]; then
        # Airflow runs in Docker (./local-dev.sh ingestion); the server here calls it on localhost and
        # gives the ingestion workflows an address of this machine they can reach from the Docker network.
        PIPELINE_SERVICE_CLIENT_ENABLED=true
        PIPELINE_SERVICE_CLIENT_ENDPOINT=http://localhost:8080
        SERVER_HOST_API_URL="http://$(docker_host_gateway):${SERVER_PORT:-8585}/api"
    fi
    set +a
}

# Address of this machine seen from the containers of omd_network
docker_host_gateway() {
    docker network inspect omd_network -f '{{range .IPAM.Config}}{{.Gateway}}{{end}}'
}

compile_backend() {
    local incremental=(-Dmaven.compiler.useIncrementalCompilation=false)
    if [ "${SKIP_COMPILE:-false}" = true ]; then
        return 0
    fi
    if [ "${FULL_COMPILE:-false}" = true ]; then
        incremental=()
    fi
    cd "$PROJECT_ROOT"
    # Build reactor dependencies as well: openmetadata-spec generates the Java schema classes used by
    # the service. Compiling only openmetadata-service can silently reuse an older schema jar from ~/.m2.
    mvn -q compile -pl openmetadata-service -am "${MVN_FAST_FLAGS[@]}" "${incremental[@]}"
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
        | grep -Ev '/openmetadata-(service|spec|ui)-[0-9][^/]*\.jar$' | paste -sd: -)"
    # Use the schema classes generated by compile_backend, not a possibly stale installed spec jar.
    echo "$PROJECT_ROOT/openmetadata-service/target/classes:$SPEC_CLASSES:$dependencies"
}

run_java() {
    local main_class=$1
    shift
    local classpath
    classpath="$(backend_classpath)"
    cd "$PROJECT_ROOT"
    exec java ${OPENMETADATA_HEAP_OPTS:--Xms256m -Xmx768m} -Dbootstrap.dir="$PROJECT_ROOT/bootstrap" \
        -cp "$classpath" "$main_class" "$@"
}

run_server() {
    compile_backend
    load_environment
    export SERVER_PORT="$1" SERVER_ADMIN_PORT="$2" OM_PORTAL_ENABLED="$3"
    if [ "$3" = true ]; then
        # The Portal never reaches the pipeline service: the server deploys the pipelines it changes
        export PIPELINE_SERVICE_CLIENT_ENABLED=false
    fi
    export AUTHENTICATION_PUBLIC_KEYS="${AUTHENTICATION_PUBLIC_KEYS:-[http://localhost:$1/api/v1/system/config/jwks]}"
    run_java "$APP_CLASS" server "$CONFIG_FILE"
}

case "${1:-}" in
    infra)
        docker compose -f "$COMPOSE_FILE" stop openmetadata-server portal 2>/dev/null || true
        docker compose -f "$COMPOSE_FILE" up -d postgresql opensearch
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
        export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1024}"
        exec yarn start
        ;;
    ui-portal)
        cd "$UI_DIR"
        export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1024}"
        exec yarn start:portal
        ;;
    ingestion)
        # --no-deps: the OpenMetadata server runs on the host, not in Docker
        docker compose -f "$COMPOSE_FILE" up -d --no-deps ingestion
        echo "Airflow: http://localhost:8080 (admin/admin). Start the server with: WITH_INGESTION=true ./local-dev.sh server"
        ;;
    *)
        sed -n '2,21p' "$0"
        exit 1
        ;;
esac
