/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindUUID;

/** Persistence boundary for glossary working versions and immutable published snapshots. */
public interface GlossaryVersionDAO {

  @SqlQuery("SELECT id FROM glossary_entity WHERE id = :glossaryId FOR UPDATE")
  String lockGlossaryIdentity(@BindUUID("glossaryId") UUID glossaryId);

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO glossary_business_working "
              + "(workingId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, entityStatus, revision, nativeVersion, payload, createdAt, createdBy, updatedAt, updatedBy) "
              + "VALUES (:workingId, :entityType, :entityId, :glossaryId, :parentBusinessVersion, :businessVersion, :entityStatus, 1, :nativeVersion, :payload, :now, :actor, :now, :actor)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO glossary_business_working "
              + "(workingId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, entityStatus, revision, nativeVersion, payload, createdAt, createdBy, updatedAt, updatedBy) "
              + "VALUES (:workingId, :entityType, :entityId, :glossaryId, :parentBusinessVersion, :businessVersion, :entityStatus, 1, :nativeVersion, (:payload :: jsonb), :now, :actor, :now, :actor)",
      connectionType = POSTGRES)
  void insertWorking(
      @BindUUID("workingId") UUID workingId,
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @BindUUID(value = "glossaryId", nullable = true) UUID glossaryId,
      @Bind(value = "parentBusinessVersion") String parentBusinessVersion,
      @Bind("businessVersion") String businessVersion,
      @Bind("entityStatus") String entityStatus,
      @Bind("nativeVersion") Double nativeVersion,
      @Bind("payload") String payload,
      @Bind("now") long now,
      @Bind("actor") String actor);

  default void insertWorking(
      UUID workingId,
      String entityType,
      UUID entityId,
      UUID glossaryId,
      String businessVersion,
      String entityStatus,
      Double nativeVersion,
      String payload,
      long now,
      String actor) {
    insertWorking(
        workingId,
        entityType,
        entityId,
        glossaryId,
        null,
        businessVersion,
        entityStatus,
        nativeVersion,
        payload,
        now,
        actor);
  }

  @SqlQuery(
      "SELECT workingId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, entityStatus, revision, nativeVersion, payload, createdAt, createdBy, updatedAt, updatedBy, submittedAt, submittedBy, rejectedAt, rejectedBy "
          + "FROM glossary_business_working WHERE entityType = :entityType AND entityId = :entityId AND COALESCE(parentBusinessVersion, '') = COALESCE(:parentBusinessVersion, '')")
  @RegisterRowMapper(WorkingVersionMapper.class)
  WorkingVersionRecord findWorking(
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  default WorkingVersionRecord findWorking(String entityType, UUID entityId) {
    return findWorking(entityType, entityId, null);
  }

  @SqlQuery(
      "SELECT workingId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, entityStatus, revision, nativeVersion, payload, createdAt, createdBy, updatedAt, updatedBy, submittedAt, submittedBy, rejectedAt, rejectedBy "
          + "FROM glossary_business_working WHERE entityType = :entityType")
  @RegisterRowMapper(WorkingVersionMapper.class)
  List<WorkingVersionRecord> listWorking(@Bind("entityType") String entityType);

  @SqlQuery(
      "SELECT workingId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, entityStatus, revision, nativeVersion, payload, createdAt, createdBy, updatedAt, updatedBy, submittedAt, submittedBy, rejectedAt, rejectedBy "
          + "FROM glossary_business_working WHERE entityType = :entityType AND entityId IN (<entityIds>)")
  @RegisterRowMapper(WorkingVersionMapper.class)
  List<WorkingVersionRecord> findWorkingBatchInternal(
      @Bind("entityType") String entityType, @BindList("entityIds") List<String> entityIds);

  default List<WorkingVersionRecord> findWorkingBatch(String entityType, List<String> entityIds) {
    return EntityDAO.queryInChunks(entityIds, chunk -> findWorkingBatchInternal(entityType, chunk));
  }

  @SqlQuery(
      "SELECT workingId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, entityStatus, revision, nativeVersion, payload, createdAt, createdBy, updatedAt, updatedBy, submittedAt, submittedBy, rejectedAt, rejectedBy "
          + "FROM glossary_business_working WHERE entityType = :entityType AND entityId IN (<entityIds>) "
          + "AND parentBusinessVersion = :parentBusinessVersion")
  @RegisterRowMapper(WorkingVersionMapper.class)
  List<WorkingVersionRecord> findWorkingBatchByParentInternal(
      @Bind("entityType") String entityType,
      @BindList("entityIds") List<String> entityIds,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  default List<WorkingVersionRecord> findWorkingBatchByParent(
      String entityType, List<String> entityIds, String parentBusinessVersion) {
    return EntityDAO.queryInChunks(
        entityIds,
        chunk -> findWorkingBatchByParentInternal(entityType, chunk, parentBusinessVersion));
  }

  @SqlQuery(
      "SELECT workingId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, entityStatus, revision, nativeVersion, payload, createdAt, createdBy, updatedAt, updatedBy, submittedAt, submittedBy, rejectedAt, rejectedBy "
          + "FROM glossary_business_working WHERE entityType = :entityType AND glossaryId = :glossaryId "
          + "ORDER BY updatedAt DESC, entityId")
  @RegisterRowMapper(WorkingVersionMapper.class)
  List<WorkingVersionRecord> listWorkingByGlossary(
      @Bind("entityType") String entityType, @BindUUID("glossaryId") UUID glossaryId);

  @SqlQuery(
      "SELECT workingId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, entityStatus, revision, nativeVersion, payload, createdAt, createdBy, updatedAt, updatedBy, submittedAt, submittedBy, rejectedAt, rejectedBy "
          + "FROM glossary_business_working WHERE entityType = :entityType AND glossaryId = :glossaryId "
          + "AND parentBusinessVersion = :parentBusinessVersion ORDER BY updatedAt DESC, entityId")
  @RegisterRowMapper(WorkingVersionMapper.class)
  List<WorkingVersionRecord> listWorkingByGlossaryAndParent(
      @Bind("entityType") String entityType,
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  @SqlUpdate(
      "DELETE FROM glossary_business_working WHERE entityType = :entityType AND glossaryId = :glossaryId "
          + "AND parentBusinessVersion = :parentBusinessVersion")
  int deleteWorkingByGlossaryAndParent(
      @Bind("entityType") String entityType,
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  @SqlQuery(
      "SELECT workingId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, entityStatus, revision, nativeVersion, payload, createdAt, createdBy, updatedAt, updatedBy, submittedAt, submittedBy, rejectedAt, rejectedBy "
          + "FROM glossary_business_working WHERE entityType = :entityType AND entityId = :entityId AND COALESCE(parentBusinessVersion, '') = COALESCE(:parentBusinessVersion, '') FOR UPDATE")
  @RegisterRowMapper(WorkingVersionMapper.class)
  WorkingVersionRecord lockWorking(
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  default WorkingVersionRecord lockWorking(String entityType, UUID entityId) {
    return lockWorking(entityType, entityId, null);
  }

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE glossary_business_working SET payload = :payload, entityStatus = :entityStatus, nativeVersion = :nativeVersion, revision = revision + 1, updatedAt = :now, updatedBy = :actor "
              + "WHERE entityType = :entityType AND entityId = :entityId AND COALESCE(parentBusinessVersion, '') = COALESCE(:parentBusinessVersion, '') AND revision = :expectedRevision",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE glossary_business_working SET payload = (:payload :: jsonb), entityStatus = :entityStatus, nativeVersion = :nativeVersion, revision = revision + 1, updatedAt = :now, updatedBy = :actor "
              + "WHERE entityType = :entityType AND entityId = :entityId AND COALESCE(parentBusinessVersion, '') = COALESCE(:parentBusinessVersion, '') AND revision = :expectedRevision",
      connectionType = POSTGRES)
  int updateWorking(
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @Bind("parentBusinessVersion") String parentBusinessVersion,
      @Bind("expectedRevision") long expectedRevision,
      @Bind("entityStatus") String entityStatus,
      @Bind("nativeVersion") Double nativeVersion,
      @Bind("payload") String payload,
      @Bind("now") long now,
      @Bind("actor") String actor);

  default int updateWorking(
      String entityType,
      UUID entityId,
      long expectedRevision,
      String entityStatus,
      Double nativeVersion,
      String payload,
      long now,
      String actor) {
    return updateWorking(
        entityType,
        entityId,
        null,
        expectedRevision,
        entityStatus,
        nativeVersion,
        payload,
        now,
        actor);
  }

  @SqlUpdate(
      "UPDATE glossary_business_working SET entityStatus = :entityStatus, revision = revision + 1, updatedAt = :now, updatedBy = :actor, "
          + "submittedAt = CASE WHEN :entityStatus = 'InReview' THEN :now ELSE submittedAt END, "
          + "submittedBy = CASE WHEN :entityStatus = 'InReview' THEN :actor ELSE submittedBy END, "
          + "rejectedAt = CASE WHEN :entityStatus = 'Rejected' THEN :now ELSE rejectedAt END, "
          + "rejectedBy = CASE WHEN :entityStatus = 'Rejected' THEN :actor ELSE rejectedBy END "
          + "WHERE entityType = :entityType AND entityId = :entityId AND COALESCE(parentBusinessVersion, '') = COALESCE(:parentBusinessVersion, '') AND entityStatus = :expectedStatus AND revision = :expectedRevision")
  int transitionWorking(
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @Bind("parentBusinessVersion") String parentBusinessVersion,
      @Bind("expectedRevision") long expectedRevision,
      @Bind("expectedStatus") String expectedStatus,
      @Bind("entityStatus") String entityStatus,
      @Bind("now") long now,
      @Bind("actor") String actor);

  default int transitionWorking(
      String entityType,
      UUID entityId,
      long expectedRevision,
      String expectedStatus,
      String entityStatus,
      long now,
      String actor) {
    return transitionWorking(
        entityType, entityId, null, expectedRevision, expectedStatus, entityStatus, now, actor);
  }

  @SqlUpdate(
      "DELETE FROM glossary_business_working WHERE entityType = :entityType AND entityId = :entityId AND COALESCE(parentBusinessVersion, '') = COALESCE(:parentBusinessVersion, '') AND revision = :expectedRevision")
  int deleteWorking(
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @Bind("parentBusinessVersion") String parentBusinessVersion,
      @Bind("expectedRevision") long expectedRevision);

  default int deleteWorking(String entityType, UUID entityId, long expectedRevision) {
    return deleteWorking(entityType, entityId, null, expectedRevision);
  }

  @SqlQuery(
      "SELECT COALESCE(MAX(publicationSequence), 0) + 1 FROM glossary_business_snapshot WHERE entityType = :entityType AND entityId = :entityId")
  long nextPublicationSequence(
      @Bind("entityType") String entityType, @BindUUID("entityId") UUID entityId);

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO glossary_business_snapshot "
              + "(snapshotId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, nativeVersion, publicationSequence, payload, contentHash, publishedAt, publishedBy) "
              + "VALUES (:snapshotId, :entityType, :entityId, :glossaryId, :parentBusinessVersion, :businessVersion, :nativeVersion, :publicationSequence, :payload, :contentHash, :publishedAt, :publishedBy)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO glossary_business_snapshot "
              + "(snapshotId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, nativeVersion, publicationSequence, payload, contentHash, publishedAt, publishedBy) "
              + "VALUES (:snapshotId, :entityType, :entityId, :glossaryId, :parentBusinessVersion, :businessVersion, :nativeVersion, :publicationSequence, (:payload :: jsonb), :contentHash, :publishedAt, :publishedBy)",
      connectionType = POSTGRES)
  void insertSnapshot(
      @BindUUID("snapshotId") UUID snapshotId,
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @BindUUID(value = "glossaryId", nullable = true) UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion,
      @Bind("businessVersion") String businessVersion,
      @Bind("nativeVersion") Double nativeVersion,
      @Bind("publicationSequence") long publicationSequence,
      @Bind("payload") String payload,
      @Bind("contentHash") String contentHash,
      @Bind("publishedAt") long publishedAt,
      @Bind("publishedBy") String publishedBy);

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE glossary_business_snapshot SET payload = :payload, contentHash = :contentHash WHERE snapshotId = :snapshotId",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE glossary_business_snapshot SET payload = (:payload :: jsonb), contentHash = :contentHash WHERE snapshotId = :snapshotId",
      connectionType = POSTGRES)
  int updateSnapshotPayload(
      @BindUUID("snapshotId") UUID snapshotId,
      @Bind("payload") String payload,
      @Bind("contentHash") String contentHash);

  default void insertSnapshot(
      UUID snapshotId,
      String entityType,
      UUID entityId,
      UUID glossaryId,
      String businessVersion,
      Double nativeVersion,
      long publicationSequence,
      String payload,
      String contentHash,
      long publishedAt,
      String publishedBy) {
    insertSnapshot(
        snapshotId,
        entityType,
        entityId,
        glossaryId,
        null,
        businessVersion,
        nativeVersion,
        publicationSequence,
        payload,
        contentHash,
        publishedAt,
        publishedBy);
  }

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO glossary_published_head (entityType, entityId, parentBusinessVersion, snapshotId, publicationSequence) VALUES (:entityType, :entityId, :parentBusinessVersion, :snapshotId, :publicationSequence) "
              + "ON DUPLICATE KEY UPDATE snapshotId = VALUES(snapshotId), publicationSequence = VALUES(publicationSequence)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO glossary_published_head (entityType, entityId, parentBusinessVersion, snapshotId, publicationSequence) VALUES (:entityType, :entityId, :parentBusinessVersion, :snapshotId, :publicationSequence) "
              + "ON CONFLICT (entityType, entityId, (COALESCE(parentBusinessVersion, ''))) DO UPDATE SET snapshotId = EXCLUDED.snapshotId, publicationSequence = EXCLUDED.publicationSequence",
      connectionType = POSTGRES)
  void upsertPublishedHead(
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @Bind("parentBusinessVersion") String parentBusinessVersion,
      @BindUUID("snapshotId") UUID snapshotId,
      @Bind("publicationSequence") long publicationSequence);

  @SqlQuery(
      "SELECT s.snapshotId, s.entityType, s.entityId, s.glossaryId, s.parentBusinessVersion, s.businessVersion, s.nativeVersion, s.publicationSequence, s.payload, s.contentHash, s.publishedAt, s.publishedBy, s.archivedAt, s.archivedBy "
          + "FROM glossary_business_snapshot s JOIN glossary_published_head h ON h.snapshotId = s.snapshotId "
          + "WHERE h.entityType = :entityType AND h.entityId = :entityId "
          + "ORDER BY h.publicationSequence DESC LIMIT 1")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  PublishedSnapshotRecord findLatestPublished(
      @Bind("entityType") String entityType, @BindUUID("entityId") UUID entityId);

  @SqlQuery(
      "SELECT s.snapshotId, s.entityType, s.entityId, s.glossaryId, s.parentBusinessVersion, s.businessVersion, s.nativeVersion, s.publicationSequence, s.payload, s.contentHash, s.publishedAt, s.publishedBy, s.archivedAt, s.archivedBy "
          + "FROM glossary_business_snapshot s JOIN glossary_published_head h ON h.snapshotId = s.snapshotId "
          + "WHERE h.entityType = :entityType AND h.entityId = :entityId "
          + "AND h.parentBusinessVersion = :parentBusinessVersion")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  PublishedSnapshotRecord findLatestPublishedByParent(
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  @SqlQuery(
      "SELECT s.snapshotId, s.entityType, s.entityId, s.glossaryId, s.parentBusinessVersion, s.businessVersion, s.nativeVersion, s.publicationSequence, s.payload, s.contentHash, s.publishedAt, s.publishedBy, s.archivedAt, s.archivedBy "
          + "FROM glossary_published_head h JOIN glossary_business_snapshot s ON s.snapshotId = h.snapshotId "
          + "WHERE h.entityType = :entityType AND h.entityId = :entityId "
          + "ORDER BY h.publicationSequence DESC LIMIT 1 FOR UPDATE")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  PublishedSnapshotRecord lockLatestPublished(
      @Bind("entityType") String entityType, @BindUUID("entityId") UUID entityId);

  @SqlQuery(
      "SELECT s.snapshotId, s.entityType, s.entityId, s.glossaryId, s.parentBusinessVersion, s.businessVersion, s.nativeVersion, s.publicationSequence, s.payload, s.contentHash, s.publishedAt, s.publishedBy, s.archivedAt, s.archivedBy "
          + "FROM glossary_published_head h JOIN glossary_business_snapshot s ON s.snapshotId = h.snapshotId "
          + "WHERE h.entityType = :entityType AND h.entityId = :entityId "
          + "AND h.parentBusinessVersion = :parentBusinessVersion FOR UPDATE")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  PublishedSnapshotRecord lockLatestPublishedByParent(
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  @SqlQuery(
      "SELECT s.snapshotId, s.entityType, s.entityId, s.glossaryId, s.parentBusinessVersion, s.businessVersion, s.nativeVersion, s.publicationSequence, s.payload, s.contentHash, s.publishedAt, s.publishedBy, s.archivedAt, s.archivedBy "
          + "FROM glossary_business_snapshot s JOIN glossary_published_head h ON h.snapshotId = s.snapshotId "
          + "WHERE h.entityType = :entityType AND h.entityId IN (<entityIds>)")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  List<PublishedSnapshotRecord> findLatestPublishedBatchInternal(
      @Bind("entityType") String entityType, @BindList("entityIds") List<String> entityIds);

  default List<PublishedSnapshotRecord> findLatestPublishedBatch(
      String entityType, List<String> entityIds) {
    return EntityDAO.queryInChunks(
        entityIds, chunk -> findLatestPublishedBatchInternal(entityType, chunk));
  }

  @SqlQuery(
      "SELECT s.snapshotId, s.entityType, s.entityId, s.glossaryId, s.parentBusinessVersion, s.businessVersion, s.nativeVersion, s.publicationSequence, s.payload, s.contentHash, s.publishedAt, s.publishedBy, s.archivedAt, s.archivedBy "
          + "FROM glossary_business_snapshot s JOIN glossary_published_head h ON h.snapshotId = s.snapshotId "
          + "WHERE h.entityType = :entityType AND h.entityId IN (<entityIds>) "
          + "AND h.parentBusinessVersion = :parentBusinessVersion")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  List<PublishedSnapshotRecord> findLatestPublishedBatchByParentInternal(
      @Bind("entityType") String entityType,
      @BindList("entityIds") List<String> entityIds,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  default List<PublishedSnapshotRecord> findLatestPublishedBatchByParent(
      String entityType, List<String> entityIds, String parentBusinessVersion) {
    return EntityDAO.queryInChunks(
        entityIds,
        chunk ->
            findLatestPublishedBatchByParentInternal(
                entityType, chunk, parentBusinessVersion));
  }

  @SqlQuery(
      "SELECT s.snapshotId, s.entityType, s.entityId, s.glossaryId, s.parentBusinessVersion, s.businessVersion, s.nativeVersion, s.publicationSequence, s.payload, s.contentHash, s.publishedAt, s.publishedBy, s.archivedAt, s.archivedBy "
          + "FROM glossary_business_snapshot s JOIN glossary_published_head h ON h.snapshotId = s.snapshotId "
          + "JOIN glossary_term_entity t ON t.id = s.entityId "
          + "WHERE s.entityType = 'glossaryTerm' AND s.glossaryId = :glossaryId "
          + "AND s.archivedAt IS NULL AND (t.deleted IS NULL OR t.deleted = false)")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  List<PublishedSnapshotRecord> listActiveLatestTermsForGlossary(
      @BindUUID("glossaryId") UUID glossaryId);

  @SqlQuery(
      "SELECT s.snapshotId, s.entityType, s.entityId, s.glossaryId, s.parentBusinessVersion, s.businessVersion, s.nativeVersion, s.publicationSequence, s.payload, s.contentHash, s.publishedAt, s.publishedBy, s.archivedAt, s.archivedBy "
          + "FROM glossary_business_snapshot s JOIN glossary_published_head h ON h.snapshotId = s.snapshotId "
          + "JOIN glossary_term_entity t ON t.id = s.entityId "
          + "WHERE s.entityType = 'glossaryTerm' AND s.glossaryId = :glossaryId "
          + "AND s.parentBusinessVersion = :parentBusinessVersion "
          + "AND h.parentBusinessVersion = :parentBusinessVersion "
          + "AND s.archivedAt IS NULL AND (t.deleted IS NULL OR t.deleted = false)")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  List<PublishedSnapshotRecord> listActiveLatestTermsForGlossaryAndParent(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  @SqlQuery(
      "SELECT snapshotId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, nativeVersion, publicationSequence, payload, contentHash, publishedAt, publishedBy, archivedAt, archivedBy "
          + "FROM glossary_business_snapshot WHERE entityType = 'glossaryTerm' "
          + "AND glossaryId = :glossaryId AND parentBusinessVersion = :parentBusinessVersion "
          + "AND archivedAt IS NULL ORDER BY publicationSequence, entityId")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  List<PublishedSnapshotRecord> listUnarchivedTermSnapshotsForGlossaryAndParent(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  @SqlQuery(
      "SELECT snapshotId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, nativeVersion, publicationSequence, payload, contentHash, publishedAt, publishedBy, archivedAt, archivedBy "
          + "FROM glossary_business_snapshot WHERE entityType = 'glossaryTerm' "
          + "AND glossaryId = :glossaryId AND parentBusinessVersion = :parentBusinessVersion "
          + "AND archivedAt IS NOT NULL ORDER BY publicationSequence DESC, entityId")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  List<PublishedSnapshotRecord> listArchivedTermSnapshotsForGlossaryAndParent(
      @BindUUID("glossaryId") UUID glossaryId,
      @Bind("parentBusinessVersion") String parentBusinessVersion);

  @SqlQuery(
      "SELECT snapshotId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, nativeVersion, publicationSequence, payload, contentHash, publishedAt, publishedBy, archivedAt, archivedBy "
          + "FROM glossary_business_snapshot WHERE entityType = :entityType AND entityId = :entityId AND businessVersion = :businessVersion")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  PublishedSnapshotRecord findPublishedVersion(
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @Bind("businessVersion") String businessVersion);

  @SqlQuery(
      "SELECT snapshotId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, nativeVersion, publicationSequence, payload, contentHash, publishedAt, publishedBy, archivedAt, archivedBy "
          + "FROM glossary_business_snapshot WHERE snapshotId = :snapshotId")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  PublishedSnapshotRecord findSnapshot(@BindUUID("snapshotId") UUID snapshotId);

  @SqlQuery(
      "SELECT snapshotId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, nativeVersion, publicationSequence, payload, contentHash, publishedAt, publishedBy, archivedAt, archivedBy "
          + "FROM glossary_business_snapshot WHERE entityType = :entityType AND entityId = :entityId ORDER BY publicationSequence DESC")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  List<PublishedSnapshotRecord> listPublished(
      @Bind("entityType") String entityType, @BindUUID("entityId") UUID entityId);

  @SqlUpdate(
      "UPDATE glossary_business_snapshot SET archivedAt = :archivedAt, archivedBy = :archivedBy WHERE snapshotId = :snapshotId AND archivedAt IS NULL")
  int archiveSnapshot(
      @BindUUID("snapshotId") UUID snapshotId,
      @Bind("archivedAt") long archivedAt,
      @Bind("archivedBy") String archivedBy);

  @SqlUpdate(
      "DELETE FROM glossary_published_head WHERE entityType = :entityType AND entityId = :entityId AND snapshotId = :snapshotId")
  int deletePublishedHead(
      @Bind("entityType") String entityType,
      @BindUUID("entityId") UUID entityId,
      @BindUUID("snapshotId") UUID snapshotId);

  @SqlQuery(
      "SELECT snapshotId, entityType, entityId, glossaryId, parentBusinessVersion, businessVersion, nativeVersion, publicationSequence, payload, contentHash, publishedAt, publishedBy, archivedAt, archivedBy "
          + "FROM glossary_business_snapshot WHERE entityType = :entityType AND entityId = :entityId AND archivedAt IS NULL "
          + "ORDER BY publicationSequence DESC LIMIT 1")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  PublishedSnapshotRecord findNewestActivePublished(
      @Bind("entityType") String entityType, @BindUUID("entityId") UUID entityId);

  @SqlUpdate(
      "INSERT INTO glossary_snapshot_term (glossarySnapshotId, termSnapshotId, displayOrder) "
          + "VALUES (:glossarySnapshotId, :termSnapshotId, :displayOrder)")
  void insertSnapshotTerm(
      @BindUUID("glossarySnapshotId") UUID glossarySnapshotId,
      @BindUUID("termSnapshotId") UUID termSnapshotId,
      @Bind("displayOrder") int displayOrder);

  @SqlUpdate(
      "DELETE FROM glossary_snapshot_term WHERE glossarySnapshotId = :glossarySnapshotId")
  int deleteSnapshotTerms(@BindUUID("glossarySnapshotId") UUID glossarySnapshotId);

  @SqlQuery(
      "SELECT s.snapshotId, s.entityType, s.entityId, s.glossaryId, s.parentBusinessVersion, s.businessVersion, s.nativeVersion, s.publicationSequence, s.payload, s.contentHash, s.publishedAt, s.publishedBy, s.archivedAt, s.archivedBy "
          + "FROM glossary_snapshot_term r JOIN glossary_business_snapshot s ON s.snapshotId = r.termSnapshotId "
          + "WHERE r.glossarySnapshotId = :glossarySnapshotId ORDER BY r.displayOrder, s.entityId")
  @RegisterRowMapper(PublishedSnapshotMapper.class)
  List<PublishedSnapshotRecord> listSnapshotTerms(
      @BindUUID("glossarySnapshotId") UUID glossarySnapshotId);

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO glossary_snapshot_outbox (eventId, snapshotId, eventType, payload, createdAt) VALUES (:eventId, :snapshotId, :eventType, :payload, :createdAt)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO glossary_snapshot_outbox (eventId, snapshotId, eventType, payload, createdAt) VALUES (:eventId, :snapshotId, :eventType, (:payload :: jsonb), :createdAt)",
      connectionType = POSTGRES)
  void insertOutbox(
      @BindUUID("eventId") UUID eventId,
      @BindUUID("snapshotId") UUID snapshotId,
      @Bind("eventType") String eventType,
      @Bind("payload") String payload,
      @Bind("createdAt") long createdAt);

  @SqlQuery(
      "SELECT eventId, snapshotId, eventType, payload, createdAt, processedAt, attempts, lastError "
          + "FROM glossary_snapshot_outbox WHERE processedAt IS NULL ORDER BY createdAt, eventId LIMIT :limit")
  @RegisterRowMapper(SnapshotOutboxMapper.class)
  List<SnapshotOutboxRecord> listPendingOutbox(@Bind("limit") int limit);

  @SqlUpdate(
      "UPDATE glossary_snapshot_outbox SET processedAt = :processedAt, lastError = NULL "
          + "WHERE eventId = :eventId AND processedAt IS NULL")
  int markOutboxProcessed(@BindUUID("eventId") UUID eventId, @Bind("processedAt") long processedAt);

  @SqlUpdate(
      "UPDATE glossary_snapshot_outbox SET attempts = attempts + 1, lastError = :lastError "
          + "WHERE eventId = :eventId AND processedAt IS NULL")
  int markOutboxFailed(@BindUUID("eventId") UUID eventId, @Bind("lastError") String lastError);

  record WorkingVersionRecord(
      UUID workingId,
      String entityType,
      UUID entityId,
      UUID glossaryId,
      String parentBusinessVersion,
      String businessVersion,
      String entityStatus,
      long revision,
      Double nativeVersion,
      String payload,
      long createdAt,
      String createdBy,
      long updatedAt,
      String updatedBy,
      Long submittedAt,
      String submittedBy,
      Long rejectedAt,
      String rejectedBy) {}

  record PublishedSnapshotRecord(
      UUID snapshotId,
      String entityType,
      UUID entityId,
      UUID glossaryId,
      String parentBusinessVersion,
      String businessVersion,
      Double nativeVersion,
      long publicationSequence,
      String payload,
      String contentHash,
      long publishedAt,
      String publishedBy,
      Long archivedAt,
      String archivedBy) {}

  record SnapshotOutboxRecord(
      UUID eventId,
      UUID snapshotId,
      String eventType,
      String payload,
      long createdAt,
      Long processedAt,
      int attempts,
      String lastError) {}

  class WorkingVersionMapper implements RowMapper<WorkingVersionRecord> {
    @Override
    public WorkingVersionRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new WorkingVersionRecord(
          UUID.fromString(rs.getString("workingId")),
          rs.getString("entityType"),
          UUID.fromString(rs.getString("entityId")),
          uuidOrNull(rs.getString("glossaryId")),
          rs.getString("parentBusinessVersion"),
          rs.getString("businessVersion"),
          rs.getString("entityStatus"),
          rs.getLong("revision"),
          nullableDouble(rs, "nativeVersion"),
          rs.getString("payload"),
          rs.getLong("createdAt"),
          rs.getString("createdBy"),
          rs.getLong("updatedAt"),
          rs.getString("updatedBy"),
          nullableLong(rs, "submittedAt"),
          rs.getString("submittedBy"),
          nullableLong(rs, "rejectedAt"),
          rs.getString("rejectedBy"));
    }
  }

  class PublishedSnapshotMapper implements RowMapper<PublishedSnapshotRecord> {
    @Override
    public PublishedSnapshotRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new PublishedSnapshotRecord(
          UUID.fromString(rs.getString("snapshotId")),
          rs.getString("entityType"),
          UUID.fromString(rs.getString("entityId")),
          uuidOrNull(rs.getString("glossaryId")),
          rs.getString("parentBusinessVersion"),
          rs.getString("businessVersion"),
          nullableDouble(rs, "nativeVersion"),
          rs.getLong("publicationSequence"),
          rs.getString("payload"),
          rs.getString("contentHash"),
          rs.getLong("publishedAt"),
          rs.getString("publishedBy"),
          nullableLong(rs, "archivedAt"),
          rs.getString("archivedBy"));
    }
  }

  class SnapshotOutboxMapper implements RowMapper<SnapshotOutboxRecord> {
    @Override
    public SnapshotOutboxRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new SnapshotOutboxRecord(
          UUID.fromString(rs.getString("eventId")),
          UUID.fromString(rs.getString("snapshotId")),
          rs.getString("eventType"),
          rs.getString("payload"),
          rs.getLong("createdAt"),
          nullableLong(rs, "processedAt"),
          rs.getInt("attempts"),
          rs.getString("lastError"));
    }
  }

  private static UUID uuidOrNull(String value) {
    return value == null ? null : UUID.fromString(value);
  }

  private static Double nullableDouble(ResultSet rs, String column) throws SQLException {
    double value = rs.getDouble(column);
    return rs.wasNull() ? null : value;
  }

  private static Long nullableLong(ResultSet rs, String column) throws SQLException {
    long value = rs.getLong(column);
    return rs.wasNull() ? null : value;
  }
}
