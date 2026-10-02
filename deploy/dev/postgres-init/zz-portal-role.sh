#!/usr/bin/env bash
# Runs once when the PostgreSQL data directory is first initialised. The "zz-" prefix makes it run
# after postgres-script.sql, which creates openmetadata_db and its owner. For a database that already
# exists, run portal-read-only-role.sql by hand (see deploy/dev/README.md).
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v portal_password="${PORTAL_RO_PASSWORD:-portal_ro_password}" \
  -f /portal-init/portal-read-only-role.sql
