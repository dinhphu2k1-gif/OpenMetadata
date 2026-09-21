-- Business-version workflow storage for glossaries and glossary terms.
-- Keep these statements idempotent so an existing 1.13.3 database can safely
-- reprocess this migration after upgrading the application image.
CREATE TABLE IF NOT EXISTS `glossary_business_working` (
  `workingId` varchar(36) NOT NULL,
  `entityType` varchar(32) NOT NULL,
  `entityId` varchar(36) NOT NULL,
  `glossaryId` varchar(36) DEFAULT NULL,
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
  UNIQUE KEY `uq_glossary_working_entity` (`entityType`, `entityId`),
  UNIQUE KEY `uq_glossary_working_version` (`entityType`, `entityId`, `businessVersion`),
  KEY `idx_glossary_working_parent` (`glossaryId`, `entityType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `glossary_business_snapshot` (
  `snapshotId` varchar(36) NOT NULL,
  `entityType` varchar(32) NOT NULL,
  `entityId` varchar(36) NOT NULL,
  `glossaryId` varchar(36) DEFAULT NULL,
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
  KEY `idx_glossary_snapshot_parent` (`glossaryId`, `entityType`, `publishedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `glossary_published_head` (
  `entityType` varchar(32) NOT NULL,
  `entityId` varchar(36) NOT NULL,
  `snapshotId` varchar(36) NOT NULL,
  `publicationSequence` bigint unsigned NOT NULL,
  PRIMARY KEY (`entityType`, `entityId`),
  UNIQUE KEY `uq_glossary_published_head_snapshot` (`snapshotId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `glossary_snapshot_term` (
  `glossarySnapshotId` varchar(36) NOT NULL,
  `termSnapshotId` varchar(36) NOT NULL,
  `parentTermSnapshotId` varchar(36) DEFAULT NULL,
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
