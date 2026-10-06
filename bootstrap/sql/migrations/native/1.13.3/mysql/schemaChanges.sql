-- Business-version workflow storage for glossaries and glossary terms.
-- Keep these statements idempotent so an existing 1.13.3 database can safely
-- reprocess this migration after upgrading the application image.
CREATE TABLE IF NOT EXISTS `glossary_business_working` (
  `workingId` varchar(36) NOT NULL,
  `entityType` varchar(32) NOT NULL,
  `entityId` varchar(36) NOT NULL,
  `glossaryId` varchar(36) DEFAULT NULL,
  `parentBusinessVersion` varchar(64) DEFAULT NULL,
  `scopeKey` varchar(64) GENERATED ALWAYS AS (coalesce(`parentBusinessVersion`,_utf8mb4'')) STORED,
  `businessVersion` varchar(64) NOT NULL,
  `entityStatus` varchar(32) NOT NULL,
  `revision` bigint unsigned NOT NULL,
  `nativeVersion` double DEFAULT NULL,
  `payload` json NOT NULL,
  `createdAt` bigint unsigned NOT NULL,
  `createdBy` varchar(256) NOT NULL,
  `updatedAt` bigint unsigned NOT NULL,
  `updatedBy` varchar(256) NOT NULL,
  `submittedAt` bigint unsigned DEFAULT NULL,
  `submittedBy` varchar(256) DEFAULT NULL,
  `rejectedAt` bigint unsigned DEFAULT NULL,
  `rejectedBy` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`workingId`),
  UNIQUE KEY `uq_glossary_working_entity_scope` (`entityType`, `entityId`, `scopeKey`),
  UNIQUE KEY `uq_glossary_working_version` (`entityType`, `entityId`, `businessVersion`),
  KEY `idx_glossary_working_parent` (`glossaryId`, `entityType`),
  KEY `idx_glossary_working_scope_status` (`glossaryId`,`parentBusinessVersion`,`entityStatus`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Early F03 builds created initial CDE drafts through the legacy DAO overload,
-- leaving their parent scope NULL. Recover the exact Data Dictionary working
-- scope so scoped workflow operations can resolve those drafts.
UPDATE `glossary_business_working` AS cde
JOIN `glossary_business_working` AS parent
  ON parent.`entityType` = 'glossary'
 AND parent.`entityId` = cde.`glossaryId`
SET cde.`parentBusinessVersion` = parent.`businessVersion`,
    cde.`payload` = JSON_SET(
      cde.`payload`,
      '$.parentBusinessVersion',
      parent.`businessVersion`)
WHERE cde.`entityType` = 'glossaryTerm'
  AND cde.`parentBusinessVersion` IS NULL;

CREATE TABLE IF NOT EXISTS `glossary_business_snapshot` (
  `snapshotId` varchar(36) NOT NULL,
  `entityType` varchar(32) NOT NULL,
  `entityId` varchar(36) NOT NULL,
  `glossaryId` varchar(36) DEFAULT NULL,
  `parentBusinessVersion` varchar(64) DEFAULT NULL,
  `businessVersion` varchar(64) NOT NULL,
  `nativeVersion` double DEFAULT NULL,
  `publicationSequence` bigint unsigned NOT NULL,
  `payload` json NOT NULL,
  `contentHash` varchar(64) NOT NULL,
  `publishedAt` bigint unsigned NOT NULL,
  `publishedBy` varchar(256) NOT NULL,
  `archivedAt` bigint unsigned DEFAULT NULL,
  `archivedBy` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`snapshotId`),
  UNIQUE KEY `uq_glossary_snapshot_version` (`entityType`, `entityId`, `businessVersion`),
  UNIQUE KEY `uq_glossary_snapshot_sequence` (`entityType`, `entityId`, `publicationSequence`),
  KEY `idx_glossary_snapshot_latest` (`entityType`, `entityId`, `publishedAt`),
  KEY `idx_glossary_snapshot_parent` (`glossaryId`, `entityType`, `publishedAt`),
  KEY `idx_glossary_snapshot_scope` (`glossaryId`,`parentBusinessVersion`,`publishedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `glossary_business_snapshot_history` (
  `historyId` varchar(36) NOT NULL,
  `snapshotId` varchar(36) NOT NULL,
  `entityType` varchar(32) NOT NULL,
  `entityId` varchar(36) NOT NULL,
  `glossaryId` varchar(36) DEFAULT NULL,
  `parentBusinessVersion` varchar(64) DEFAULT NULL,
  `businessVersion` varchar(64) NOT NULL,
  `nativeVersion` double DEFAULT NULL,
  `publicationSequence` bigint unsigned NOT NULL,
  `payload` json NOT NULL,
  `contentHash` varchar(64) NOT NULL,
  `publishedAt` bigint unsigned NOT NULL,
  `publishedBy` varchar(256) NOT NULL,
  `supersededAt` bigint unsigned NOT NULL,
  `supersededBy` varchar(256) NOT NULL,
  PRIMARY KEY (`historyId`),
  KEY `idx_glossary_snapshot_history_version` (`entityType`, `entityId`, `businessVersion`, `supersededAt`),
  KEY `idx_glossary_snapshot_history_snapshot` (`snapshotId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `glossary_published_head` (
  `entityType` varchar(32) NOT NULL,
  `entityId` varchar(36) NOT NULL,
  `parentBusinessVersion` varchar(64) DEFAULT NULL,
  `scopeKey` varchar(64) GENERATED ALWAYS AS (coalesce(`parentBusinessVersion`,_utf8mb4'')) STORED,
  `snapshotId` varchar(36) NOT NULL,
  `publicationSequence` bigint unsigned NOT NULL,
  PRIMARY KEY (`entityType`, `entityId`, `scopeKey`),
  UNIQUE KEY `uq_glossary_published_head_snapshot` (`snapshotId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `glossary_snapshot_term` (
  `glossarySnapshotId` varchar(36) NOT NULL,
  `termSnapshotId` varchar(36) NOT NULL,
  `displayOrder` int unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`glossarySnapshotId`, `termSnapshotId`),
  KEY `idx_glossary_snapshot_term_order` (`glossarySnapshotId`, `displayOrder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `glossary_snapshot_outbox` (
  `eventId` varchar(36) NOT NULL,
  `snapshotId` varchar(36) NOT NULL,
  `eventType` varchar(64) NOT NULL,
  `payload` json NOT NULL,
  `createdAt` bigint unsigned NOT NULL,
  `processedAt` bigint unsigned DEFAULT NULL,
  `attempts` int unsigned NOT NULL DEFAULT 0,
  `lastError` text,
  PRIMARY KEY (`eventId`),
  UNIQUE KEY `uq_glossary_outbox_snapshot_event` (`snapshotId`, `eventType`),
  KEY `idx_glossary_outbox_pending` (`processedAt`, `createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Technical Dictionary is unversioned (TD unversioned design): one set of records bound to the
-- active Data Dictionary, a frozen snapshot of the CDE bindings per replaced Data Dictionary
-- version, and an audit trail. It no longer uses the governed working/snapshot stores.
DROP TABLE IF EXISTS `technical_projection_outbox`;
DROP TABLE IF EXISTS `technical_record_column_binding`;
DROP TABLE IF EXISTS `technical_dictionary_scope`;
DROP TABLE IF EXISTS `technical_bootstrap_job`;
DROP TABLE IF EXISTS `technical_source_state`;
DROP TABLE IF EXISTS `technical_index_outbox`;

CREATE TABLE IF NOT EXISTS `technical_dictionary_state` (
  `id` int NOT NULL,
  `dataDictionaryVersion` varchar(16) DEFAULT NULL,
  `previousDataDictionaryVersion` varchar(16) DEFAULT NULL,
  `resetAt` bigint unsigned DEFAULT NULL,
  `resetBy` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT IGNORE INTO `technical_dictionary_state` (`id`) VALUES (1);

CREATE TABLE IF NOT EXISTS `technical_record` (
  `id` varchar(36) NOT NULL,
  `columnKey` varchar(36) NOT NULL,
  `columnFqn` text NOT NULL,
  `sourceService` varchar(256) DEFAULT NULL,
  `sourceDatabase` varchar(256) DEFAULT NULL,
  `sourceSchema` varchar(256) DEFAULT NULL,
  `sourceTable` varchar(256) DEFAULT NULL,
  `sourceColumn` varchar(256) DEFAULT NULL,
  `dataType` varchar(512) DEFAULT NULL,
  `dataLength` int DEFAULT NULL,
  `dataPrecision` int DEFAULT NULL,
  `dataScale` int DEFAULT NULL,
  `description` mediumtext,
  `sourceStatus` varchar(16) NOT NULL,
  `cdeTermId` varchar(36) DEFAULT NULL,
  `cdeAssignedAt` bigint unsigned DEFAULT NULL,
  `cdeAssignedBy` varchar(256) DEFAULT NULL,
  `survivorshipRank` smallint DEFAULT NULL,
  `elementType` varchar(256) DEFAULT NULL,
  `generationType` varchar(256) DEFAULT NULL,
  `creationMethod` varchar(256) DEFAULT NULL,
  `timeliness` varchar(256) DEFAULT NULL,
  `systemOwnerId` mediumtext,
  `revision` bigint unsigned NOT NULL,
  `createdAt` bigint unsigned NOT NULL,
  `createdBy` varchar(256) NOT NULL,
  `updatedAt` bigint unsigned NOT NULL,
  `updatedBy` varchar(256) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_technical_record_column` (`columnKey`),
  KEY `idx_technical_record_cde_rank` (`cdeTermId`, `survivorshipRank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Existing records were effective before maker-checker was introduced.
ALTER TABLE `technical_record`
  ADD COLUMN `status` varchar(16) NOT NULL DEFAULT 'Approved' AFTER `systemOwnerId`,
  ADD COLUMN `submittedAt` bigint unsigned DEFAULT NULL AFTER `status`,
  ADD COLUMN `submittedBy` varchar(256) DEFAULT NULL AFTER `submittedAt`,
  ADD COLUMN `reviewedAt` bigint unsigned DEFAULT NULL AFTER `submittedBy`,
  ADD COLUMN `reviewedBy` varchar(256) DEFAULT NULL AFTER `reviewedAt`,
  ADD COLUMN `reviewComment` mediumtext AFTER `reviewedBy`;

CREATE TABLE IF NOT EXISTS `technical_record_change_request` (
  `id` varchar(36) NOT NULL,
  `recordId` varchar(36) NOT NULL,
  `operation` varchar(16) NOT NULL,
  `baseRevision` bigint unsigned NOT NULL,
  `proposedValues` mediumtext,
  `status` varchar(16) NOT NULL,
  `revision` bigint unsigned NOT NULL,
  `createdAt` bigint unsigned NOT NULL,
  `createdBy` varchar(256) NOT NULL,
  `updatedAt` bigint unsigned NOT NULL,
  `updatedBy` varchar(256) NOT NULL,
  `submittedAt` bigint unsigned DEFAULT NULL,
  `submittedBy` varchar(256) DEFAULT NULL,
  `reviewedAt` bigint unsigned DEFAULT NULL,
  `reviewedBy` varchar(256) DEFAULT NULL,
  `reviewComment` mediumtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_technical_change_record` (`recordId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `technical_record_audit` (
  `id` varchar(36) NOT NULL,
  `recordId` varchar(36) NOT NULL,
  `columnFqn` text NOT NULL,
  `dataDictionaryVersion` varchar(16) DEFAULT NULL,
  `action` varchar(16) NOT NULL,
  `changes` mediumtext,
  `actor` varchar(256) NOT NULL,
  `changedAt` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_technical_audit_record` (`recordId`, `changedAt`),
  KEY `idx_technical_audit_reset` (`action`, `dataDictionaryVersion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `technical_binding_snapshot` (
  `dataDictionaryVersion` varchar(16) NOT NULL,
  `recordId` varchar(36) NOT NULL,
  `columnKey` varchar(36) NOT NULL,
  `cdeTermId` varchar(36) NOT NULL,
  `cdeCode` varchar(256) DEFAULT NULL,
  `cdeName` varchar(512) DEFAULT NULL,
  `survivorshipRank` smallint DEFAULT NULL,
  `columnFqn` text NOT NULL,
  `payload` mediumtext NOT NULL,
  `frozenAt` bigint unsigned NOT NULL,
  PRIMARY KEY (`dataDictionaryVersion`, `recordId`),
  KEY `idx_technical_snapshot_cde` (`cdeTermId`, `dataDictionaryVersion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `technical_outbox` (
  `kind` varchar(16) NOT NULL,
  `subjectKey` varchar(64) NOT NULL,
  `payload` mediumtext,
  `enqueuedAt` bigint unsigned NOT NULL,
  `attempts` int unsigned NOT NULL DEFAULT 0,
  `lastError` text,
  PRIMARY KEY (`kind`, `subjectKey`),
  KEY `idx_technical_outbox_enqueued` (`enqueuedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data Quality Rule test execution: Rule -> TestSuite/pipeline, declaration and Column bindings.
CREATE TABLE IF NOT EXISTS `dq_rule_exec` (
  `ruleTermId` varchar(36) NOT NULL,
  `parentBusinessVersion` varchar(16) NOT NULL,
  `ruleCode` varchar(256) NOT NULL,
  `appliedBusinessVersion` varchar(16) DEFAULT NULL,
  `appliedSpecsHash` varchar(64) DEFAULT NULL,
  `cdeTermId` varchar(36) DEFAULT NULL,
  `testSuiteId` varchar(36) DEFAULT NULL,
  `pipelineId` varchar(36) DEFAULT NULL,
  `scheduleCron` varchar(128) DEFAULT NULL,
  `scheduleTimezone` varchar(64) DEFAULT NULL,
  `scheduleUpdatedBy` varchar(256) DEFAULT NULL,
  `scheduleUpdatedAt` bigint unsigned DEFAULT NULL,
  `revision` bigint unsigned NOT NULL DEFAULT 1,
  `updatedAt` bigint unsigned NOT NULL,
  PRIMARY KEY (`ruleTermId`),
  KEY `idx_dq_rule_exec_cde` (`cdeTermId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `dq_rule_test_spec_exec` (
  `ruleTermId` varchar(36) NOT NULL,
  `specKey` varchar(16) NOT NULL,
  `name` varchar(256) NOT NULL,
  `kind` varchar(16) NOT NULL,
  `testDefinitionFqn` varchar(512) DEFAULT NULL,
  `managedTestDefinitionId` varchar(36) DEFAULT NULL,
  `appliedSpecHash` varchar(64) DEFAULT NULL,
  `state` varchar(16) NOT NULL,
  `retiredAt` bigint unsigned DEFAULT NULL,
  `updatedAt` bigint unsigned NOT NULL,
  PRIMARY KEY (`ruleTermId`, `specKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `dq_rule_test_binding` (
  `id` varchar(36) NOT NULL,
  `ruleTermId` varchar(36) NOT NULL,
  `specKey` varchar(16) NOT NULL,
  `columnKey` varchar(36) NOT NULL,
  `columnFqn` text NOT NULL,
  `cdeTermId` varchar(36) DEFAULT NULL,
  `testCaseId` varchar(36) DEFAULT NULL,
  `testCaseFqn` text,
  `state` varchar(16) NOT NULL,
  `stateReason` varchar(64) DEFAULT NULL,
  `lastError` text,
  `attempts` int unsigned NOT NULL DEFAULT 0,
  `activatedAt` bigint unsigned DEFAULT NULL,
  `retiredAt` bigint unsigned DEFAULT NULL,
  `createdAt` bigint unsigned NOT NULL,
  `updatedAt` bigint unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dq_rule_test_binding` (`ruleTermId`, `specKey`, `columnKey`),
  KEY `idx_dq_binding_cde_state` (`cdeTermId`, `state`),
  KEY `idx_dq_binding_spec_state` (`ruleTermId`, `specKey`, `state`),
  KEY `idx_dq_binding_column` (`columnKey`),
  KEY `idx_dq_binding_test_case` (`testCaseId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `dq_test_outbox` (
  `kind` varchar(24) NOT NULL,
  `subjectKey` varchar(64) NOT NULL,
  `payload` mediumtext,
  `enqueuedAt` bigint unsigned NOT NULL,
  `attempts` int unsigned NOT NULL DEFAULT 0,
  `lastError` text,
  PRIMARY KEY (`kind`, `subjectKey`),
  KEY `idx_dq_test_outbox_enqueued` (`enqueuedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
