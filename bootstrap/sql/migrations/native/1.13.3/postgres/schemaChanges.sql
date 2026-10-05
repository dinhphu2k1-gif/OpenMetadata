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

CREATE TABLE IF NOT EXISTS glossary_business_snapshot_history (
  historyId varchar(36) PRIMARY KEY,
  snapshotId varchar(36) NOT NULL,
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
  supersededAt bigint NOT NULL,
  supersededBy varchar(256) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_glossary_snapshot_history_version
  ON glossary_business_snapshot_history (entityType, entityId, businessVersion, supersededAt DESC);
CREATE INDEX IF NOT EXISTS idx_glossary_snapshot_history_snapshot
  ON glossary_business_snapshot_history (snapshotId);

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

-- Technical Dictionary is unversioned (TD unversioned design): one set of records bound to the
-- active Data Dictionary, a frozen snapshot of the CDE bindings per replaced Data Dictionary
-- version, and an audit trail. It no longer uses the governed working/snapshot stores.
DROP TABLE IF EXISTS technical_projection_outbox;
DROP TABLE IF EXISTS technical_record_column_binding;
DROP TABLE IF EXISTS technical_dictionary_scope;
DROP TABLE IF EXISTS technical_bootstrap_job;
DROP TABLE IF EXISTS technical_source_state;
DROP TABLE IF EXISTS technical_index_outbox;

CREATE TABLE IF NOT EXISTS technical_dictionary_state (
  id integer PRIMARY KEY,
  dataDictionaryVersion varchar(16),
  previousDataDictionaryVersion varchar(16),
  resetAt bigint,
  resetBy varchar(256)
);
INSERT INTO technical_dictionary_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS technical_record (
  id varchar(36) PRIMARY KEY,
  columnKey varchar(36) NOT NULL,
  columnFqn text NOT NULL,
  sourceService varchar(256),
  sourceDatabase varchar(256),
  sourceSchema varchar(256),
  sourceTable varchar(256),
  sourceColumn varchar(256),
  dataType varchar(512),
  dataLength integer,
  dataPrecision integer,
  dataScale integer,
  description text,
  sourceStatus varchar(16) NOT NULL,
  cdeTermId varchar(36),
  cdeAssignedAt bigint,
  cdeAssignedBy varchar(256),
  survivorshipRank smallint,
  elementType varchar(256),
  generationType varchar(256),
  creationMethod varchar(256),
  timeliness varchar(256),
  systemOwnerId varchar(36),
  revision bigint NOT NULL,
  createdAt bigint NOT NULL,
  createdBy varchar(256) NOT NULL,
  updatedAt bigint NOT NULL,
  updatedBy varchar(256) NOT NULL,
  CONSTRAINT uq_technical_record_column UNIQUE (columnKey)
);
-- Existing records were effective before maker-checker was introduced.
ALTER TABLE technical_record
  ADD COLUMN status varchar(16) NOT NULL DEFAULT 'Approved',
  ADD COLUMN submittedAt bigint,
  ADD COLUMN submittedBy varchar(256),
  ADD COLUMN reviewedAt bigint,
  ADD COLUMN reviewedBy varchar(256),
  ADD COLUMN reviewComment text;
CREATE INDEX IF NOT EXISTS idx_technical_record_cde_rank
  ON technical_record (cdeTermId, survivorshipRank);

CREATE TABLE IF NOT EXISTS technical_record_audit (
  id varchar(36) PRIMARY KEY,
  recordId varchar(36) NOT NULL,
  columnFqn text NOT NULL,
  dataDictionaryVersion varchar(16),
  action varchar(16) NOT NULL,
  changes text,
  actor varchar(256) NOT NULL,
  changedAt bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_technical_audit_record ON technical_record_audit (recordId, changedAt);
CREATE INDEX IF NOT EXISTS idx_technical_audit_reset
  ON technical_record_audit (action, dataDictionaryVersion);

CREATE TABLE IF NOT EXISTS technical_binding_snapshot (
  dataDictionaryVersion varchar(16) NOT NULL,
  recordId varchar(36) NOT NULL,
  columnKey varchar(36) NOT NULL,
  cdeTermId varchar(36) NOT NULL,
  cdeCode varchar(256),
  cdeName varchar(512),
  survivorshipRank smallint,
  columnFqn text NOT NULL,
  payload text NOT NULL,
  frozenAt bigint NOT NULL,
  PRIMARY KEY (dataDictionaryVersion, recordId)
);
CREATE INDEX IF NOT EXISTS idx_technical_snapshot_cde
  ON technical_binding_snapshot (cdeTermId, dataDictionaryVersion);

CREATE TABLE IF NOT EXISTS technical_outbox (
  kind varchar(16) NOT NULL,
  subjectKey varchar(64) NOT NULL,
  payload text,
  enqueuedAt bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  lastError text,
  PRIMARY KEY (kind, subjectKey)
);
CREATE INDEX IF NOT EXISTS idx_technical_outbox_enqueued ON technical_outbox (enqueuedAt);

-- Data Quality Rule test execution: Rule -> TestSuite/pipeline, declaration and Column bindings.
CREATE TABLE IF NOT EXISTS dq_rule_exec (
  ruleTermId varchar(36) PRIMARY KEY,
  parentBusinessVersion varchar(16) NOT NULL,
  ruleCode varchar(256) NOT NULL,
  appliedBusinessVersion varchar(16),
  appliedSpecsHash varchar(64),
  cdeTermId varchar(36),
  testSuiteId varchar(36),
  pipelineId varchar(36),
  scheduleCron varchar(128),
  scheduleTimezone varchar(64),
  scheduleUpdatedBy varchar(256),
  scheduleUpdatedAt bigint,
  revision bigint NOT NULL DEFAULT 1,
  updatedAt bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dq_rule_exec_cde ON dq_rule_exec (cdeTermId);

CREATE TABLE IF NOT EXISTS dq_rule_test_spec_exec (
  ruleTermId varchar(36) NOT NULL,
  specKey varchar(16) NOT NULL,
  name varchar(256) NOT NULL,
  kind varchar(16) NOT NULL,
  testDefinitionFqn varchar(512),
  managedTestDefinitionId varchar(36),
  appliedSpecHash varchar(64),
  state varchar(16) NOT NULL,
  retiredAt bigint,
  updatedAt bigint NOT NULL,
  PRIMARY KEY (ruleTermId, specKey)
);

CREATE TABLE IF NOT EXISTS dq_rule_test_binding (
  id varchar(36) PRIMARY KEY,
  ruleTermId varchar(36) NOT NULL,
  specKey varchar(16) NOT NULL,
  columnKey varchar(36) NOT NULL,
  columnFqn text NOT NULL,
  cdeTermId varchar(36),
  testCaseId varchar(36),
  testCaseFqn text,
  state varchar(16) NOT NULL,
  stateReason varchar(64),
  lastError text,
  attempts integer NOT NULL DEFAULT 0,
  activatedAt bigint,
  retiredAt bigint,
  createdAt bigint NOT NULL,
  updatedAt bigint NOT NULL,
  CONSTRAINT uq_dq_rule_test_binding UNIQUE (ruleTermId, specKey, columnKey)
);
CREATE INDEX IF NOT EXISTS idx_dq_binding_cde_state ON dq_rule_test_binding (cdeTermId, state);
CREATE INDEX IF NOT EXISTS idx_dq_binding_spec_state ON dq_rule_test_binding (ruleTermId, specKey, state);
CREATE INDEX IF NOT EXISTS idx_dq_binding_column ON dq_rule_test_binding (columnKey);
CREATE INDEX IF NOT EXISTS idx_dq_binding_test_case ON dq_rule_test_binding (testCaseId);

CREATE TABLE IF NOT EXISTS dq_test_outbox (
  kind varchar(24) NOT NULL,
  subjectKey varchar(64) NOT NULL,
  payload text,
  enqueuedAt bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  lastError text,
  PRIMARY KEY (kind, subjectKey)
);
CREATE INDEX IF NOT EXISTS idx_dq_test_outbox_enqueued ON dq_test_outbox (enqueuedAt);
