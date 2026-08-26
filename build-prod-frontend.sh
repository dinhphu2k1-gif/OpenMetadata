#!/bin/bash
# ==============================================================================
# 🚀 OpenMetadata - All-In-One Production Build & Deploy Script
# Based on: docker/docker-compose-quickstart/prod-build-frontend-guide.md
# ==============================================================================

set -e

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Determine project root directory regardless of where script is executed
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# If script is located in docker/docker-compose-quickstart, go up 2 levels
if [ -f "$SCRIPT_DIR/pom.xml" ]; then
    PROJECT_ROOT="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/../../pom.xml" ]; then
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
else
    PROJECT_ROOT="$SCRIPT_DIR"
fi

cd "$PROJECT_ROOT"

# Default flags
SKIP_INSTALL=false
SKIP_START=false
DOCKER_NO_CACHE=false
SKIP_CLEAN=false
BUILD_THREADS="1C"

# Help function
show_help() {
    echo -e "${BOLD}Usage:${NC} ./build-prod-frontend.sh [OPTIONS]"
    echo ""
    echo "Builds OpenMetadata UI and backend distribution, builds Docker image, and starts services."
    echo ""
    echo -e "${BOLD}Options:${NC}"
    echo "  --skip-install    Skip 'yarn install' step (faster if dependencies haven't changed)"
    echo "  --skip-clean      Skip 'mvn clean' step (faster incremental build)"
    echo "  --skip-start      Build all artifacts and Docker image only, do not restart docker compose"
    echo "  --threads <N>     Number of threads for Maven (default: 1C = 1 thread per CPU core)"
    echo "  --no-cache        Build Docker image with --no-cache"
    echo "  -h, --help        Show this help message"
    echo ""
}

# Parse command-line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --skip-install) SKIP_INSTALL=true ;;
        --skip-clean) SKIP_CLEAN=true ;;
        --skip-start) SKIP_START=true ;;
        --threads) BUILD_THREADS="$2"; shift ;;
        --no-cache) DOCKER_NO_CACHE=true ;;
        -h|--help) show_help; exit 0 ;;
        *) echo -e "${RED}Unknown option: $1${NC}"; show_help; exit 1 ;;
    esac
    shift
done

# Check Docker Compose command
if docker compose version &>/dev/null; then
    DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    echo -e "${RED}Error: Neither 'docker compose' nor 'docker-compose' was found.${NC}"
    exit 1
fi

echo -e "${CYAN}${BOLD}======================================================${NC}"
echo -e "${CYAN}${BOLD}  OpenMetadata Production Build & Deploy              ${NC}"
echo -e "${CYAN}${BOLD}======================================================${NC}"
echo -e "Project Root: ${BOLD}$PROJECT_ROOT${NC}"
echo ""

# Define compose file
COMPOSE_FILE="docker/docker-compose-quickstart/docker-compose.dev.yml"

# ------------------------------------------------------------------------------
# Bước 0: Dừng Containers Để Giải Phóng Tài Nguyên
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[Bước 0/4] 🛑 Dừng containers để giải phóng RAM/CPU...${NC}"
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}Error: Không tìm thấy compose file '$COMPOSE_FILE'.${NC}"
    exit 1
fi

echo -e "${YELLOW}>> Đang chạy: $DOCKER_COMPOSE -f $COMPOSE_FILE down${NC}"
$DOCKER_COMPOSE -f "$COMPOSE_FILE" down
echo -e "${GREEN}✓ Các container đã dừng; bắt đầu build với tài nguyên đã giải phóng.${NC}"
echo ""

# ------------------------------------------------------------------------------
# Bước 1: Build Giao Diện Frontend (Vite)
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[Bước 1/4] 🛠 Build Giao Diện Frontend (Vite)...${NC}"
UI_DIR="$PROJECT_ROOT/openmetadata-ui/src/main/resources/ui"

if [ ! -d "$UI_DIR" ]; then
    echo -e "${RED}Error: UI directory not found at $UI_DIR${NC}"
    exit 1
fi

cd "$UI_DIR"

if [ "$SKIP_INSTALL" = false ]; then
    echo -e "${YELLOW}>> Cài đặt dependencies (yarn install --ignore-engines)...${NC}"
    yarn install --ignore-engines
else
    echo -e "${YELLOW}>> Bỏ qua yarn install (--skip-install)...${NC}"
fi

echo -e "${YELLOW}>> Tiến hành build code giao diện (yarn build)...${NC}"
yarn build

if [ ! -d "$UI_DIR/dist" ]; then
    echo -e "${RED}Error: Build failed, '$UI_DIR/dist' directory was not generated.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build Frontend hoàn tất thành công!${NC}"
echo ""

# ------------------------------------------------------------------------------
# Bước 2: Build Backend Và Distribution Bằng Maven Reactor
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[Bước 2/4] 📦 Build Backend và Distribution bằng Maven Reactor...${NC}"
cd "$PROJECT_ROOT"

# Tối ưu RAM cho Maven JVM
export MAVEN_OPTS="-Xmx4096m -XX:+UseG1GC"

MAVEN_GOALS="install"
if [ "$SKIP_CLEAN" = false ]; then
    MAVEN_GOALS="clean install"
fi

echo -e "${YELLOW}>> Đang chạy Maven với ${BOLD}${BUILD_THREADS}${NC}${YELLOW} luồng song song (Goals: ${MAVEN_GOALS})...${NC}"
mvn $MAVEN_GOALS \
    -pl :openmetadata-dist \
    -am \
    -T "$BUILD_THREADS" \
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

TAR_FILE="$PROJECT_ROOT/openmetadata-dist/target/openmetadata-1.13.3.tar.gz"
SERVICE_JAR="$PROJECT_ROOT/openmetadata-service/target/openmetadata-service-1.13.3.jar"
VERIFY_DIR="$(mktemp -d)"
trap 'rm -rf "$VERIFY_DIR"' EXIT

if [ ! -f "$TAR_FILE" ]; then
    echo -e "${RED}Error: Maven không tạo distribution '$TAR_FILE'.${NC}"
    exit 1
fi
if [ ! -f "$SERVICE_JAR" ]; then
    echo -e "${RED}Error: Maven không tạo backend JAR '$SERVICE_JAR'.${NC}"
    exit 1
fi

PACKAGED_SERVICE_PATH="openmetadata-1.13.3/libs/openmetadata-service-1.13.3.jar"
tar xzf "$TAR_FILE" -C "$VERIFY_DIR" "$PACKAGED_SERVICE_PATH"
PACKAGED_SERVICE_JAR="$VERIFY_DIR/$PACKAGED_SERVICE_PATH"

if ! cmp -s "$SERVICE_JAR" "$PACKAGED_SERVICE_JAR"; then
    echo -e "${RED}Error: Backend JAR trong distribution không khớp với JAR vừa build.${NC}"
    echo -e "${RED}Dừng trước khi tạo Docker image để tránh deploy backend cũ.${NC}"
    exit 1
fi

RULE_EVALUATOR_CLASS="org/openmetadata/service/security/policyevaluator/RuleEvaluator.class"
unzip -p "$PACKAGED_SERVICE_JAR" "$RULE_EVALUATOR_CLASS" > "$VERIFY_DIR/RuleEvaluator.class"
if ! strings "$VERIFY_DIR/RuleEvaluator.class" | grep -q "isCreator" \
    || ! strings "$VERIFY_DIR/RuleEvaluator.class" | grep -q "notApproved"; then
    echo -e "${RED}Error: Distribution không chứa isCreator/notApproved trong RuleEvaluator.${NC}"
    exit 1
fi

rm -rf "$VERIFY_DIR"
trap - EXIT
echo -e "${GREEN}✓ Backend, UI và distribution đã được build đồng bộ!${NC}"
echo ""

# ------------------------------------------------------------------------------
# Bước 3: Build Custom Docker Image
# ------------------------------------------------------------------------------
echo -e "${BLUE}${BOLD}[Bước 3/4] 🐳 Build Custom Docker Image...${NC}"
cd "$PROJECT_ROOT"

BUILD_CMD="docker build -f docker/development/Dockerfile -t openmetadata/server:custom-1.13.3 ."
if [ "$DOCKER_NO_CACHE" = true ]; then
    BUILD_CMD="docker build --no-cache -f docker/development/Dockerfile -t openmetadata/server:custom-1.13.3 ."
fi

echo -e "${YELLOW}>> Đang chạy: $BUILD_CMD${NC}"
$BUILD_CMD

echo -e "${GREEN}✓ Docker Image 'openmetadata/server:custom-1.13.3' đã được build thành công!${NC}"
echo ""

# ------------------------------------------------------------------------------
# Bước 4: Khởi Động Lại Services
# ------------------------------------------------------------------------------
if [ "$SKIP_START" = false ]; then
    echo -e "${BLUE}${BOLD}[Bước 4/4] 🚀 Khởi Động Services Qua Docker Compose...${NC}"

    echo -e "${YELLOW}>> Recreate services bằng image mới sau khi tất cả bước build đã thành công...${NC}"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" up -d --force-recreate

    echo ""
    echo -e "${GREEN}${BOLD}======================================================${NC}"
    echo -e "${GREEN}${BOLD}  🎉 QUY TRÌNH HOÀN TẤT THÀNH CÔNG!                   ${NC}"
    echo -e "${GREEN}${BOLD}======================================================${NC}"
    echo -e "Theo dõi log khởi động server bằng lệnh:"
    echo -e "  ${CYAN}docker logs -f openmetadata_server${NC}"
    echo ""
    echo -e "Khi hệ thống báo ${BOLD}'Started OpenMetadataApplication'${NC}, hãy truy cập:"
    echo -e "  ${CYAN}http://localhost:8585${NC} hoặc domain đã cấu hình."
else
    echo -e "${YELLOW}[Bước 4/4] ⏭ Bỏ qua khởi động Docker Compose (--skip-start).${NC}"
    echo -e "${GREEN}✓ Toàn bộ quá trình build đã hoàn tất.${NC}"
fi
