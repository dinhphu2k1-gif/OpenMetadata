#!/usr/bin/env bash
# Starts or stops the whole local dev environment with one command:
# PostgreSQL, OpenSearch, Airflow and the Oracle sandbox in Docker; the OpenMetadata server, the Portal
# server and their UIs on the host from the source tree (same as local-dev.sh, run in the background
# with their logs in .dev-run/).
#
#   ./dev.sh up [--migrate] [--no-oracle] [--no-portal]
#                                           start everything (--migrate runs the DB migrations first)
#   ./dev.sh down                           stop servers, UIs and containers (data is kept)
#   ./dev.sh restart-server                 recompile (changed sources only; FULL_COMPILE=true for all) and restart
#                                           the servers (after a backend change)
#   ./dev.sh status                         what is running, health and memory
#   ./dev.sh logs server|ui|portal|ui-portal   follow a log
#
# OpenMetadata UI http://localhost:3000, Portal UI http://localhost:3001.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE=(docker compose -f "$SCRIPT_DIR/docker-compose.dev.yml" --profile dq-sandbox)
LOCAL_DEV="$SCRIPT_DIR/local-dev.sh"
RUN_DIR="$SCRIPT_DIR/.dev-run"
SERVER_PORT=8585
SERVER_HEALTH_URL=http://localhost:8586/healthcheck
PORTAL_PORT=8595
PORTAL_HEALTH_URL=http://localhost:8596/healthcheck
UI_PORT=3000
UI_PORTAL_PORT=3001
AIRFLOW_URL=http://localhost:8080/api/v2/version
SERVER_WAIT_SECONDS=420
UI_WAIT_SECONDS=180

mkdir -p "$RUN_DIR"

log() { echo "[dev] $*"; }

port_pid() {
    ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2
}

wait_for_url() {
    local url=$1 seconds=$2 credentials=${3:-}
    local waited=0
    until curl -sf ${credentials:+-u "$credentials"} -o /dev/null "$url"; do
        if [ "$waited" -ge "$seconds" ]; then
            return 1
        fi
        sleep 5
        waited=$((waited + 5))
    done
}

# Runs a local-dev.sh command in its own session so that "down" can stop it with everything it started
start_background() {
    local name=$1
    shift
    setsid nohup env "$@" > "$RUN_DIR/$name.log" 2>&1 < /dev/null &
    echo $! > "$RUN_DIR/$name.pid"
}

stop_background() {
    local name=$1 port=$2 pid
    pid=$(cat "$RUN_DIR/$name.pid" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid"
        log "$name stopped"
    elif [ -n "$(port_pid "$port")" ]; then
        log "$name on :$port was not started by dev.sh; stop it in its own terminal"
    fi
    rm -f "$RUN_DIR/$name.pid"
}

server_has_ingestion() {
    local pid
    pid=$(port_pid "$SERVER_PORT")
    [ -n "$pid" ] && tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | grep -qx 'PIPELINE_SERVICE_CLIENT_ENABLED=true'
}

start_server() {
    if [ -n "$(port_pid "$SERVER_PORT")" ]; then
        if server_has_ingestion; then
            log "server already running on :$SERVER_PORT"
        else
            log "WARNING: a server is running on :$SERVER_PORT without Airflow (WITH_INGESTION=true)."
            log "         Test Connection and pipelines will fail. Stop it, then run ./dev.sh restart-server"
        fi
        return
    fi
    log "starting server (compiles the changed sources first), log: $RUN_DIR/server.log"
    start_background server WITH_INGESTION=true SKIP_COMPILE="${SKIP_COMPILE:-false}" "$LOCAL_DEV" server
    if wait_for_url "$SERVER_HEALTH_URL" "$SERVER_WAIT_SECONDS"; then
        log "server ready: http://localhost:$SERVER_PORT"
    else
        log "server not healthy after ${SERVER_WAIT_SECONDS}s, see: ./dev.sh logs server"
    fi
}

start_ui() {
    if [ -n "$(port_pid "$UI_PORT")" ]; then
        log "UI already running on :$UI_PORT"
        return
    fi
    log "starting UI, log: $RUN_DIR/ui.log"
    start_background ui "$LOCAL_DEV" ui
    if wait_for_url "http://localhost:$UI_PORT" "$UI_WAIT_SECONDS"; then
        log "UI ready: http://localhost:$UI_PORT"
    else
        log "UI not ready after ${UI_WAIT_SECONDS}s, see: ./dev.sh logs ui"
    fi
}

# The Portal needs the server first on a fresh database: the server creates the initial data the Portal
# does not create. The server has already compiled the classes, so the Portal does not compile again.
launch_portal() {
    log "starting portal server, log: $RUN_DIR/portal.log"
    start_background portal SKIP_COMPILE=true "$LOCAL_DEV" portal
}

wait_portal() {
    if wait_for_url "$PORTAL_HEALTH_URL" "$SERVER_WAIT_SECONDS"; then
        log "portal ready: http://localhost:$PORTAL_PORT"
    else
        log "portal not healthy after ${SERVER_WAIT_SECONDS}s, see: ./dev.sh logs portal"
    fi
}

start_portal() {
    if [ -n "$(port_pid "$PORTAL_PORT")" ]; then
        log "portal already running on :$PORTAL_PORT"
        return
    fi
    launch_portal
    wait_portal
}

start_ui_portal() {
    if [ -n "$(port_pid "$UI_PORTAL_PORT")" ]; then
        log "Portal UI already running on :$UI_PORTAL_PORT"
        return
    fi
    log "starting Portal UI, log: $RUN_DIR/ui-portal.log"
    start_background ui-portal "$LOCAL_DEV" ui-portal
    if wait_for_url "http://localhost:$UI_PORTAL_PORT" "$UI_WAIT_SECONDS"; then
        log "Portal UI ready: http://localhost:$UI_PORTAL_PORT"
    else
        log "Portal UI not ready after ${UI_WAIT_SECONDS}s, see: ./dev.sh logs ui-portal"
    fi
}

up() {
    local migrate=false oracle=true portal=true arg
    for arg in "$@"; do
        case "$arg" in
            --migrate) migrate=true ;;
            --no-oracle) oracle=false ;;
            --no-portal) portal=false ;;
            *) log "unknown option $arg"; exit 1 ;;
        esac
    done

    log "PostgreSQL + OpenSearch"
    "$LOCAL_DEV" infra
    if [ "$oracle" = true ]; then
        log "Oracle sandbox (first start creates the database: 15-30 minutes, see: docker logs -f dq-sandbox-oracle)"
        "${COMPOSE[@]}" up -d dq-sandbox-oracle
    fi
    log "Airflow"
    "$LOCAL_DEV" ingestion
    if [ "$migrate" = true ]; then
        log "database migrations"
        "$LOCAL_DEV" migrate
    fi
    start_server
    start_ui
    if [ "$portal" = true ]; then
        start_portal
        start_ui_portal
    fi
    if ! wait_for_url "$AIRFLOW_URL" 120 admin:admin; then
        log "Airflow not ready yet: http://localhost:8080"
    fi
    status
}

down() {
    stop_background ui-portal "$UI_PORTAL_PORT"
    stop_background portal "$PORTAL_PORT"
    stop_background ui "$UI_PORT"
    stop_background server "$SERVER_PORT"
    log "stopping containers (data is kept)"
    "${COMPOSE[@]}" stop dq-sandbox-oracle ingestion opensearch postgresql
}

restart_server() {
    # Only a Portal started by dev.sh is restarted: one in its own terminal cannot be stopped from here
    local portal_pid portal_managed=false
    portal_pid=$(cat "$RUN_DIR/portal.pid" 2>/dev/null || true)
    if [ -n "$portal_pid" ] && kill -0 "$portal_pid" 2>/dev/null; then
        portal_managed=true
        stop_background portal "$PORTAL_PORT"
    fi
    stop_background server "$SERVER_PORT"
    while [ -n "$(port_pid "$SERVER_PORT")" ] || { [ "$portal_managed" = true ] && [ -n "$(port_pid "$PORTAL_PORT")" ]; }; do
        sleep 2
    done
    # Compile once, here, so that a compile error shows at once instead of as a server that never
    # becomes healthy, and so that the server and the Portal start together on the same classes
    "$LOCAL_DEV" compile || { log "compile failed, the servers were not restarted"; exit 1; }
    export SKIP_COMPILE=true
    if [ "$portal_managed" = true ]; then
        launch_portal
    fi
    start_server
    if [ "$portal_managed" = true ]; then
        wait_portal
    fi
}

check() {
    local name=$1 url=$2 credentials=${3:-}
    if curl -sf ${credentials:+-u "$credentials"} -o /dev/null --max-time 5 "$url"; then
        echo "  $name: up ($url)"
    else
        echo "  $name: down"
    fi
}

status() {
    echo "Services:"
    check "OpenMetadata server" "$SERVER_HEALTH_URL"
    if [ -n "$(port_pid "$SERVER_PORT")" ] && ! server_has_ingestion; then
        echo "    (running without Airflow: run ./dev.sh restart-server)"
    fi
    check "UI" "http://localhost:$UI_PORT"
    check "Portal server" "$PORTAL_HEALTH_URL"
    check "Portal UI" "http://localhost:$UI_PORTAL_PORT"
    check "Airflow" "$AIRFLOW_URL" admin:admin
    if docker logs dq-sandbox-oracle 2>&1 | grep -q "DATABASE IS READY TO USE"; then
        echo "  Oracle sandbox: $(docker inspect -f '{{.State.Status}}' dq-sandbox-oracle 2>/dev/null || echo missing)"
    else
        echo "  Oracle sandbox: not ready (docker logs -f dq-sandbox-oracle)"
    fi
    echo "Memory:"
    docker stats --no-stream --format '{{.Name}}: {{.MemUsage}}' 2>/dev/null | sed 's/^/  /' || true
    local name pid
    for name in server ui portal ui-portal; do
        pid=$(cat "$RUN_DIR/$name.pid" 2>/dev/null || true)
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            echo "  $name: $(ps -o rss= -g "$pid" 2>/dev/null | awk '{s+=$1} END {printf "%d MB", s/1024}')"
        fi
    done
    free -h | awk 'NR==2 {print "  host: used " $3 " of " $2 ", available " $7}'
}

case "${1:-}" in
    up) shift; up "$@" ;;
    down) down ;;
    restart-server) restart_server ;;
    status) status ;;
    logs)
        [ -f "$RUN_DIR/${2:-}.log" ] || { log "usage: ./dev.sh logs server|ui|portal|ui-portal"; exit 1; }
        exec tail -f "$RUN_DIR/$2.log"
        ;;
    *)
        sed -n '2,14p' "$0"
        exit 1
        ;;
esac
