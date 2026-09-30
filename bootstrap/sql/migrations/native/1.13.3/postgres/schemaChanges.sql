-- Business-version workflow storage for glossaries and glossary terms.
-- Keep these statements idempotent so a 1.13.3 database can safely reprocess
-- this migration after upgrading an image that predates the workflow tables.
CREATE TABLE IF NOT EXISTS glossary_business_working (
  workingId varchar(36) PRIMARY KEY,
  entityType varchar(32) NOT NULL,
  entityId varchar(36) NOT NULL,
  glossaryId varchar(36),
  parentBusinessVersion varchar(64),
  businessVersion varchar(64) NOT NULL,
  entityStatus varchar(32) NOT NULL,
  revision bigint NOT NULL,
  nativeVersion double precision,
  payload jsonb NOT NULL,
  createdAt bigint NOT NULL,
  createdBy varchar(256) NOT NULL,
  updatedAt bigint NOT NULL,
  updatedBy varchar(256) NOT NULL,
  submittedAt bigint,
  submittedBy varchar(256),
  rejectedAt bigint,
  rejectedBy varchar(256),
  CONSTRAINT uq_glossary_working_version UNIQUE (entityType, entityId, businessVersion)
);

CREATE INDEX IF NOT EXISTS idx_glossary_working_parent
  ON glossary_business_working (glossaryId, entityType);
CREATE UNIQUE INDEX IF NOT EXISTS uq_glossary_working_entity_scope
  ON glossary_business_working (entityType, entityId, COALESCE(parentBusinessVersion, ''));
CREATE INDEX IF NOT EXISTS idx_glossary_working_scope_status
  ON glossary_business_working (glossaryId, parentBusinessVersion, entityStatus);

-- Early F03 builds created initial CDE drafts through the legacy DAO overload,
-- leaving their parent scope NULL. Recover the exact Data Dictionary working
-- scope so scoped workflow operations can resolve those drafts.
UPDATE glossary_business_working AS cde
SET parentBusinessVersion = parent.businessVersion,
    payload = jsonb_set(
      cde.payload,
      '{parentBusinessVersion}',
      to_jsonb(parent.businessVersion),
      true)
FROM glossary_business_working AS parent
WHERE cde.entityType = 'glossaryTerm'
  AND cde.parentBusinessVersion IS NULL
  AND parent.entityType = 'glossary'
  AND parent.entityId = cde.glossaryId;

CREATE TABLE IF NOT EXISTS glossary_business_snapshot (
  snapshotId varchar(36) PRIMARY KEY,
  entityType varchar(32) NOT NULL,
  entityId varchar(36) NOT NULL,
  glossaryId varchar(36),
  parentBusinessVersion varchar(64),
  businessVersion varchar(64) NOT NULL,
  nativeVersion double precision,
  publicationSequence bigint NOT NULL,
  payload jsonb NOT NULL,
  contentHash varchar(64) NOT NULL,
  publishedAt bigint NOT NULL,
  publishedBy varchar(256) NOT NULL,
  archivedAt bigint,
  archivedBy varchar(256),
  CONSTRAINT uq_glossary_snapshot_version UNIQUE (entityType, entityId, businessVersion),
  CONSTRAINT uq_glossary_snapshot_sequence UNIQUE (entityType, entityId, publicationSequence)
);

CREATE INDEX IF NOT EXISTS idx_glossary_snapshot_latest
  ON glossary_business_snapshot (entityType, entityId, publishedAt DESC);
CREATE INDEX IF NOT EXISTS idx_glossary_snapshot_parent
  ON glossary_business_snapshot (glossaryId, entityType, publishedAt DESC);
CREATE INDEX IF NOT EXISTS idx_glossary_snapshot_scope
  ON glossary_business_snapshot (glossaryId, parentBusinessVersion, publishedAt DESC);

CREATE TABLE IF NOT EXISTS glossary_published_head (
  entityType varchar(32) NOT NULL,
  entityId varchar(36) NOT NULL,
  parentBusinessVersion varchar(64),
  snapshotId varchar(36) NOT NULL UNIQUE,
  publicationSequence bigint NOT NULL,
  UNIQUE (entityType, entityId, parentBusinessVersion)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_glossary_published_head_entity_scope
  ON glossary_published_head (entityType, entityId, COALESCE(parentBusinessVersion, ''));

CREATE TABLE IF NOT EXISTS glossary_snapshot_term (
  glossarySnapshotId varchar(36) NOT NULL,
  termSnapshotId varchar(36) NOT NULL,
  displayOrder integer NOT NULL DEFAULT 0,
  PRIMARY KEY (glossarySnapshotId, termSnapshotId)
);

CREATE INDEX IF NOT EXISTS idx_glossary_snapshot_term_order
  ON glossary_snapshot_term (glossarySnapshotId, displayOrder);

CREATE TABLE IF NOT EXISTS glossary_snapshot_outbox (
  eventId varchar(36) PRIMARY KEY,
  snapshotId varchar(36) NOT NULL,
  eventType varchar(64) NOT NULL,
  payload jsonb NOT NULL,
  createdAt bigint NOT NULL,
  processedAt bigint,
  attempts integer NOT NULL DEFAULT 0,
  lastError text,
  CONSTRAINT uq_glossary_outbox_snapshot_event UNIQUE (snapshotId, eventType)
);

CREATE INDEX IF NOT EXISTS idx_glossary_outbox_pending
  ON glossary_snapshot_outbox (processedAt, createdAt);

-- Technical Dictionary records use the shared governed working/snapshot stores; Columns without
-- a record are read from the Column search index, so there is no bootstrap job table.
DROP TABLE IF EXISTS technical_projection_outbox;
DROP TABLE IF EXISTS technical_record_column_binding;
DROP TABLE IF EXISTS technical_dictionary_scope;

DROP TABLE IF EXISTS technical_bootstrap_job;

-- Operational availability of source Columns; published snapshots stay immutable.
CREATE TABLE IF NOT EXISTS technical_source_state (
  technicalGlossaryId varchar(36) NOT NULL,
  parentBusinessVersion varchar(64) NOT NULL,
  columnKey varchar(36) NOT NULL,
  status varchar(32) NOT NULL,
  columnFqn text NOT NULL,
  detectedAt bigint NOT NULL,
  PRIMARY KEY (technicalGlossaryId, parentBusinessVersion, columnKey)
);

-- Technical Dictionary records whose search document must be rebuilt from the database.
CREATE TABLE IF NOT EXISTS technical_index_outbox (
  termId varchar(36) PRIMARY KEY,
  enqueuedAt bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  lastError text
);
CREATE INDEX IF NOT EXISTS idx_technical_index_outbox_enqueued
  ON technical_index_outbox (enqueuedAt);
