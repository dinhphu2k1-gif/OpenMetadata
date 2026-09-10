#!/usr/bin/env bash
#
# Packages a yarn-built UI (openmetadata-ui/src/main/resources/ui/dist/)
# as a plain jar with contents rooted under assets/, so it can be dropped
# straight into the server dist tarball's libs/ folder without ever
# running the openmetadata-ui Maven module's frontend-maven-plugin.
#
# Why this layout: OpenMetadataAssetServlet is registered with
# resourcePath="/assets" (see OpenMetadataApplication.registerAssetServlet)
# and Dropwizard's AssetServlet resolves files via
# getClass().getResource("/assets" + path) - i.e. classpath lookup. The
# openmetadata-ui module's own build produces exactly this by copying
# dist/ into target/classes/assets before jarring. Any jar on the runtime
# classpath (openmetadata-server-start.sh globs libs/*.jar) with an
# assets/ prefix satisfies the same lookup, regardless of how it was
# built - Maven's own toolchain is not required.
#
# Usage: package-ui-assets.sh <dist-dir> <output-jar>

set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <dist-dir> <output-jar>" >&2
  exit 2
fi

DIST_DIR="$1"
OUTPUT_JAR="$2"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "error: dist dir not found: $DIST_DIR" >&2
  exit 1
fi

if [[ -z "$(ls -A "$DIST_DIR" 2>/dev/null)" ]]; then
  echo "error: dist dir is empty: $DIST_DIR (did 'yarn build' actually run?)" >&2
  exit 1
fi

STAGE_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGE_DIR"' EXIT

mkdir -p "$STAGE_DIR/assets"
cp -r "$DIST_DIR"/. "$STAGE_DIR/assets/"

mkdir -p "$(dirname "$OUTPUT_JAR")"
jar cf "$OUTPUT_JAR" -C "$STAGE_DIR" assets

echo "wrote $OUTPUT_JAR ($(du -h "$OUTPUT_JAR" | cut -f1))"
