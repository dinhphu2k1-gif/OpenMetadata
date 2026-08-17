#!/bin/bash
set -e

echo "Starting repackage process..."
# Paths
TAR_FILE="openmetadata-dist/target/openmetadata-1.13.3.tar.gz"
UI_DIST="openmetadata-ui/src/main/resources/ui/dist"
TMP_BUILD="/tmp/om-build"
TMP_JAR="/tmp/om-jar"

# Backup original tar
if [ ! -f "${TAR_FILE}.bak" ]; then
    cp "$TAR_FILE" "${TAR_FILE}.bak"
    echo "Created backup of original tar file."
fi

# Clean temp directories
rm -rf "$TMP_BUILD" "$TMP_JAR"
mkdir -p "$TMP_BUILD" "$TMP_JAR"

echo "Extracting tar file..."
tar xf "$TAR_FILE" -C "$TMP_BUILD"

JAR_FILE="$TMP_BUILD/openmetadata-1.13.3/libs/openmetadata-ui-1.13.3.jar"
if [ ! -f "$JAR_FILE" ]; then
    echo "JAR file not found: $JAR_FILE"
    exit 1
fi

echo "Extracting JAR file..."
cd "$TMP_JAR"
unzip -q "$JAR_FILE"

echo "Replacing UI assets..."
rm -rf assets/*
cp -r ~/project/OpenMetadata/$UI_DIST/* assets/

echo "Re-zipping JAR file..."
zip -qr "$JAR_FILE" .

echo "Re-tarring everything..."
cd "$TMP_BUILD"
tar czf ~/project/OpenMetadata/$TAR_FILE openmetadata-1.13.3/

echo "Cleaning up..."
rm -rf "$TMP_BUILD" "$TMP_JAR"

echo "Done repackaging!"
