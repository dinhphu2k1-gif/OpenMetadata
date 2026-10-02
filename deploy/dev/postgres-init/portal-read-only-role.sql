-- Read-only database user of the Portal service. Idempotent: safe to run again on an existing
-- database. Run as a superuser, passing the password:
--   psql -U postgres -v portal_password=... -f portal-read-only-role.sql
-- The Portal can then read everything the OpenMetadata server reads, and nothing can write through it:
-- the role has SELECT only, and every session it opens is read-only.

SELECT 'CREATE ROLE portal_ro LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'portal_ro') \gexec

ALTER ROLE portal_ro WITH LOGIN PASSWORD :'portal_password' CONNECTION LIMIT 40;
ALTER ROLE portal_ro SET default_transaction_read_only = on;

\connect openmetadata_db

GRANT CONNECT ON DATABASE openmetadata_db TO portal_ro;
GRANT USAGE ON SCHEMA public TO portal_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO portal_ro;

-- Tables that later migrations create
ALTER DEFAULT PRIVILEGES FOR ROLE openmetadata_user IN SCHEMA public GRANT SELECT ON TABLES TO portal_ro;
