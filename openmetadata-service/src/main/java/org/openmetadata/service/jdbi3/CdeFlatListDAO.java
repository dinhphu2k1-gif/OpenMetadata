/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.jdbi3;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotMapper;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionMapper;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.util.jdbi.BindUUID;

/** Set-based persistence boundary for the CDE business-version flat list. */
public interface CdeFlatListDAO {
  @SqlQuery(
      "SELECT snapshotId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, nativeVersion, publicationSequence, payload, contentHash, publishedAt, publishedBy, archivedAt, archivedBy "
          + "FROM glossary_business_snapshot WHERE entityType = 'glossaryTerm' "
          + "AND glossaryId = :glossaryId AND parentBusinessVersion = :parentBusinessVersion "
          + "AND archivedAt IS NULL")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  List<PublishedSnapshotRecord> listActivePublished(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  @SqlQuery(
      "SELECT workingId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, entityStatus, revision, nativeVersion, payload, createdAt, createdBy, updatedAt, updatedBy, submittedAt, submittedBy, rejectedAt, rejectedBy "
          + "FROM glossary_business_working WHERE entityType = 'glossaryTerm' "
          + "AND glossaryId = :glossaryId AND parentBusinessVersion = :parentBusinessVersion")
  @RegisterRowMapper(WorkingVersionMapper.class)
  List<WorkingVersionRecord> listWorking(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  @SqlQuery(
      "SELECT DISTINCT s.snapshotId, s.entityType, s.entityId, s.glossaryId, s.parentBusinessVersion, s.businessVersion, s.nativeVersion, s.publicationSequence, s.payload, s.contentHash, s.publishedAt, s.publishedBy, s.archivedAt, s.archivedBy "
          + "FROM glossary_snapshot_term m "
          + "JOIN glossary_business_snapshot manifestTerm ON manifestTerm.snapshotId = m.termSnapshotId "
          + "JOIN glossary_business_snapshot s ON s.entityType = 'glossaryTerm' "
          + "AND s.entityId = manifestTerm.entityId AND s.glossaryId = manifestTerm.glossaryId "
          + "AND s.parentBusinessVersion = manifestTerm.parentBusinessVersion "
          + "WHERE m.glossarySnapshotId = :glossarySnapshotId "
          + "AND s.parentBusinessVersion = :parentBusinessVersion AND s.archivedAt IS NOT NULL")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  List<PublishedSnapshotRecord> listArchivedPublishedFromManifest(
      @BindUUID("glossarySnapshotId") UUID glossarySnapshotId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);
}
