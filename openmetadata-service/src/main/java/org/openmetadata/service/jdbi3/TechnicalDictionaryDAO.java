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
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.BindMethods;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.glossary.technical.TechnicalRecord;
import org.openmetadata.service.glossary.technical.TechnicalRecordChangeRequest;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

/** Persistence of the unversioned Technical Dictionary: records, state, audit and snapshots. */
public interface TechnicalDictionaryDAO {
  String RECORD_COLUMNS =
      "id, columnKey, columnFqn, sourceService, sourceDatabase, sourceSchema, sourceTable, "
          + "sourceColumn, dataType, dataLength, dataPrecision, dataScale, description, "
          + "sourceStatus, cdeTermId, cdeAssignedAt, cdeAssignedBy, survivorshipRank, elementType, "
          + "generationType, creationMethod, timeliness, systemOwnerId, "
          + "status, submittedAt, submittedBy, reviewedAt, reviewedBy, reviewComment, "
          + "revision, createdAt, createdBy, updatedAt, updatedBy";

  // ---- state -------------------------------------------------------------------------------

  /** Shared lock taken by every write, so a Data Dictionary cutover cannot interleave with it. */
  @SqlQuery("SELECT id FROM technical_dictionary_state WHERE id = 1 FOR SHARE")
  Integer lockStateShared();

  /** Exclusive lock of the cutover and of writes that assign ranks. */
  @SqlQuery("SELECT id FROM technical_dictionary_state WHERE id = 1 FOR UPDATE")
  Integer lockStateExclusive();

  @SqlQuery("SELECT * FROM technical_dictionary_state WHERE id = 1")
  @RegisterRowMapper(StateMapper.class)
  StateRow findState();

  @SqlUpdate("UPDATE technical_dictionary_state SET dataDictionaryVersion = :version WHERE id = 1")
  int setActiveVersion(@Bind("version") String version);

  @SqlUpdate(
      "UPDATE technical_dictionary_state SET dataDictionaryVersion = :version, "
          + "previousDataDictionaryVersion = :previous, resetAt = :resetAt, resetBy = :resetBy "
          + "WHERE id = 1")
  int recordReset(
      @Bind("version") String version,
      @Bind("previous") String previous,
      @Bind("resetAt") long resetAt,
      @Bind("resetBy") String resetBy);

  // ---- records -----------------------------------------------------------------------------

  @SqlUpdate(
      "INSERT INTO technical_record (id, columnKey, columnFqn, sourceService, sourceDatabase, "
          + "sourceSchema, sourceTable, sourceColumn, dataType, dataLength, dataPrecision, "
          + "dataScale, description, sourceStatus, cdeTermId, cdeAssignedAt, cdeAssignedBy, "
          + "survivorshipRank, elementType, generationType, creationMethod, timeliness, "
          + "systemOwnerId, status, submittedAt, submittedBy, reviewedAt, reviewedBy, "
          + "reviewComment, revision, createdAt, createdBy, updatedAt, updatedBy) VALUES (:id, "
          + ":columnKey, :columnFqn, :sourceService, :sourceDatabase, :sourceSchema, :sourceTable, "
          + ":sourceColumn, :dataType, :dataLength, :dataPrecision, :dataScale, :description, "
          + ":sourceStatus, :cdeTermId, :cdeAssignedAt, :cdeAssignedBy, :rank, :elementType, "
          + ":generationType, :creationMethod, :timeliness, :systemOwnerId, "
          + ":status, :submittedAt, :submittedBy, :reviewedAt, :reviewedBy, :reviewComment, "
          + ":revision, :createdAt, :createdBy, :updatedAt, :updatedBy)")
  void insertRecord(@BindMethods TechnicalRecord record);

  /** Writes the user-editable values; succeeds only when the revision is the expected one. */
  @SqlUpdate(
      "UPDATE technical_record SET cdeTermId = :cdeTermId, cdeAssignedAt = :cdeAssignedAt, "
          + "cdeAssignedBy = :cdeAssignedBy, survivorshipRank = :rank, elementType = :elementType, "
          + "generationType = :generationType, creationMethod = :creationMethod, "
          + "timeliness = :timeliness, systemOwnerId = :systemOwnerId, status = :status, "
          + "submittedAt = :submittedAt, submittedBy = :submittedBy, reviewedAt = :reviewedAt, "
          + "reviewedBy = :reviewedBy, reviewComment = :reviewComment, revision = :revision, "
          + "updatedAt = :updatedAt, updatedBy = :updatedBy WHERE id = :id "
          + "AND revision = :expectedRevision")
  int updateEditable(
      @BindMethods TechnicalRecord record, @Bind("expectedRevision") long expectedRevision);

  /** Refreshes the source snapshot after ingestion changed the Column. */
  @SqlUpdate(
      "UPDATE technical_record SET dataType = :dataType, dataLength = :dataLength, "
          + "dataPrecision = :dataPrecision, dataScale = :dataScale, description = :description, "
          + "sourceStatus = :sourceStatus, revision = :revision, updatedAt = :updatedAt, "
          + "updatedBy = :updatedBy WHERE id = :id")
  int updateSource(@BindMethods TechnicalRecord record);

  @SqlUpdate("DELETE FROM technical_record WHERE id = :id AND revision = :expectedRevision")
  int deleteRecord(@Bind("id") String id, @Bind("expectedRevision") long expectedRevision);

  @SqlUpdate("DELETE FROM technical_record")
  int deleteAllRecords();

  @SqlQuery("SELECT " + RECORD_COLUMNS + " FROM technical_record WHERE id = :id")
  @RegisterRowMapper(RecordMapper.class)
  TechnicalRecord findById(@Bind("id") String id);

  @SqlQuery("SELECT " + RECORD_COLUMNS + " FROM technical_record WHERE id = :id FOR UPDATE")
  @RegisterRowMapper(RecordMapper.class)
  TechnicalRecord findByIdForUpdate(@Bind("id") String id);

  @SqlQuery("SELECT " + RECORD_COLUMNS + " FROM technical_record WHERE id IN (<ids>)")
  @RegisterRowMapper(RecordMapper.class)
  List<TechnicalRecord> findByIds(@BindList("ids") List<String> ids);

  @SqlQuery("SELECT " + RECORD_COLUMNS + " FROM technical_record WHERE columnKey IN (<keys>)")
  @RegisterRowMapper(RecordMapper.class)
  List<TechnicalRecord> findByColumnKeys(@BindList("keys") List<String> columnKeys);

  @SqlQuery("SELECT " + RECORD_COLUMNS + " FROM technical_record WHERE columnFqn = :columnFqn")
  @RegisterRowMapper(RecordMapper.class)
  TechnicalRecord findByColumnFqn(@Bind("columnFqn") String columnFqn);

  /** Keyset page of every record ordered by id. */
  @SqlQuery(
      "SELECT "
          + RECORD_COLUMNS
          + " FROM technical_record WHERE id > :after ORDER BY id LIMIT :limit")
  @RegisterRowMapper(RecordMapper.class)
  List<TechnicalRecord> listAfter(@Bind("after") String afterId, @Bind("limit") int limit);

  @SqlQuery("SELECT id FROM technical_record WHERE cdeTermId IN (<cdeIds>)")
  List<String> listIdsByCde(@BindList("cdeIds") List<String> cdeIds);

  @SqlQuery("SELECT COUNT(*) FROM technical_record")
  long countRecords();

  // ---- approved-record change requests ----------------------------------------------------

  @SqlUpdate(
      "INSERT INTO technical_record_change_request (id, recordId, operation, baseRevision, "
          + "proposedValues, status, revision, createdAt, createdBy, updatedAt, updatedBy, "
          + "submittedAt, submittedBy, reviewedAt, reviewedBy, reviewComment) VALUES (:id, "
          + ":recordId, :operation, :baseRevision, :proposedValues, :status, :revision, "
          + ":createdAt, :createdBy, :updatedAt, :updatedBy, :submittedAt, :submittedBy, "
          + ":reviewedAt, :reviewedBy, :reviewComment)")
  void insertChangeRequest(@BindMethods TechnicalRecordChangeRequest request);

  @SqlUpdate(
      "UPDATE technical_record_change_request SET operation = :operation, "
          + "baseRevision = :baseRevision, proposedValues = :proposedValues, status = :status, "
          + "revision = :revision, updatedAt = :updatedAt, updatedBy = :updatedBy, "
          + "submittedAt = :submittedAt, submittedBy = :submittedBy, reviewedAt = :reviewedAt, "
          + "reviewedBy = :reviewedBy, reviewComment = :reviewComment WHERE recordId = :recordId "
          + "AND revision = :expectedRevision")
  int updateChangeRequest(
      @BindMethods TechnicalRecordChangeRequest request,
      @Bind("expectedRevision") long expectedRevision);

  @SqlQuery("SELECT * FROM technical_record_change_request WHERE recordId = :recordId")
  @RegisterRowMapper(ChangeRequestMapper.class)
  TechnicalRecordChangeRequest findChangeRequest(@Bind("recordId") String recordId);

  @SqlQuery("SELECT * FROM technical_record_change_request WHERE recordId = :recordId FOR UPDATE")
  @RegisterRowMapper(ChangeRequestMapper.class)
  TechnicalRecordChangeRequest findChangeRequestForUpdate(@Bind("recordId") String recordId);

  @SqlQuery("SELECT * FROM technical_record_change_request WHERE recordId IN (<recordIds>)")
  @RegisterRowMapper(ChangeRequestMapper.class)
  List<TechnicalRecordChangeRequest> findChangeRequestsByRecordIds(
      @BindList("recordIds") List<String> recordIds);

  @SqlUpdate(
      "DELETE FROM technical_record_change_request WHERE recordId = :recordId "
          + "AND revision = :expectedRevision")
  int deleteChangeRequest(
      @Bind("recordId") String recordId, @Bind("expectedRevision") long expectedRevision);

  @SqlUpdate("DELETE FROM technical_record_change_request")
  int deleteAllChangeRequests();

  @SqlQuery("SELECT COUNT(*) FROM technical_record_change_request")
  long countChangeRequests();

  @SqlQuery(
      "SELECT COUNT(*) FROM technical_record WHERE cdeTermId IS NOT NULL AND status = 'Approved'")
  long countMappedRecords();

  /** The record holding a rank in one CDE, other than {@code exceptId}; Column FQN or null. */
  @SqlQuery(
      "SELECT columnFqn FROM technical_record WHERE cdeTermId = :cdeTermId "
          + "AND survivorshipRank = :rank AND sourceStatus = 'Available' "
          + "AND status = 'Approved' AND id <> :exceptId "
          + "LIMIT 1")
  String findRankHolder(
      @Bind("cdeTermId") String cdeTermId,
      @Bind("rank") int rank,
      @Bind("exceptId") String exceptId);

  /** Records of one table, matched by case-insensitive location names. */
  @SqlQuery(
      "SELECT "
          + RECORD_COLUMNS
          + " FROM technical_record WHERE LOWER(sourceDatabase) = :database "
          + "AND LOWER(sourceSchema) = :schema AND LOWER(sourceTable) = :table")
  @RegisterRowMapper(RecordMapper.class)
  List<TechnicalRecord> listByTable(
      @Bind("database") String database,
      @Bind("schema") String schema,
      @Bind("table") String table);

  // ---- audit -------------------------------------------------------------------------------

  @SqlUpdate(
      "INSERT INTO technical_record_audit (id, recordId, columnFqn, dataDictionaryVersion, "
          + "action, changes, actor, changedAt) VALUES (:id, :recordId, :columnFqn, "
          + ":dataDictionaryVersion, :action, :changes, :actor, :at)")
  void insertAudit(@BindMethods AuditRow audit);

  @SqlQuery(
      "SELECT * FROM technical_record_audit WHERE recordId = :recordId "
          + "ORDER BY changedAt DESC, id DESC LIMIT :limit OFFSET :offset")
  @RegisterRowMapper(AuditMapper.class)
  List<AuditRow> listAudit(
      @Bind("recordId") String recordId, @Bind("limit") int limit, @Bind("offset") int offset);

  /** Effective history: only the approvals, the moments a value became the approved one. */
  @SqlQuery(
      "SELECT * FROM technical_record_audit WHERE recordId = :recordId "
          + "AND action IN ('APPROVE', 'APPROVE_CHANGE') "
          + "ORDER BY changedAt DESC, id DESC LIMIT :limit OFFSET :offset")
  @RegisterRowMapper(AuditMapper.class)
  List<AuditRow> listEffectiveAudit(
      @Bind("recordId") String recordId, @Bind("limit") int limit, @Bind("offset") int offset);

  @SqlQuery("SELECT COUNT(*) FROM technical_record_audit WHERE recordId = :recordId")
  long countAudit(@Bind("recordId") String recordId);

  @SqlQuery(
      "SELECT COUNT(*) FROM technical_record_audit WHERE recordId = :recordId "
          + "AND action IN ('APPROVE', 'APPROVE_CHANGE')")
  long countEffectiveAudit(@Bind("recordId") String recordId);

  /** Keyset page of the records removed by the reset that replaced one Data Dictionary version. */
  @SqlQuery(
      "SELECT * FROM technical_record_audit WHERE action = 'RESET' "
          + "AND dataDictionaryVersion = :version AND id > :after ORDER BY id LIMIT :limit")
  @RegisterRowMapper(AuditMapper.class)
  List<AuditRow> listResetAfter(
      @Bind("version") String version, @Bind("after") String afterId, @Bind("limit") int limit);

  // ---- snapshots ---------------------------------------------------------------------------

  @SqlUpdate(
      "INSERT INTO technical_binding_snapshot (dataDictionaryVersion, recordId, columnKey, "
          + "cdeTermId, cdeCode, cdeName, survivorshipRank, columnFqn, payload, frozenAt) VALUES "
          + "(:dataDictionaryVersion, :recordId, :columnKey, :cdeTermId, :cdeCode, :cdeName, "
          + ":rank, :columnFqn, :payload, :frozenAt)")
  void insertSnapshot(@BindMethods SnapshotRow snapshot);

  @SqlQuery(
      "SELECT * FROM technical_binding_snapshot WHERE cdeTermId = :cdeTermId "
          + "AND dataDictionaryVersion = :version ORDER BY survivorshipRank, columnFqn "
          + "LIMIT :limit OFFSET :offset")
  @RegisterRowMapper(SnapshotMapper.class)
  List<SnapshotRow> listSnapshotsByCde(
      @Bind("cdeTermId") String cdeTermId,
      @Bind("version") String version,
      @Bind("limit") int limit,
      @Bind("offset") int offset);

  @SqlQuery(
      "SELECT COUNT(*) FROM technical_binding_snapshot WHERE cdeTermId = :cdeTermId "
          + "AND dataDictionaryVersion = :version")
  long countSnapshotsByCde(@Bind("cdeTermId") String cdeTermId, @Bind("version") String version);

  @SqlQuery(
      "SELECT * FROM technical_binding_snapshot WHERE dataDictionaryVersion = :version "
          + "AND recordId > :after ORDER BY recordId LIMIT :limit")
  @RegisterRowMapper(SnapshotMapper.class)
  List<SnapshotRow> listSnapshotsAfter(
      @Bind("version") String version, @Bind("after") String afterId, @Bind("limit") int limit);

  @SqlQuery(
      "SELECT * FROM technical_binding_snapshot WHERE dataDictionaryVersion = :version "
          + "AND (LOWER(columnFqn) LIKE :pattern OR LOWER(COALESCE(cdeCode, '')) LIKE :pattern "
          + "OR LOWER(COALESCE(cdeName, '')) LIKE :pattern) "
          + "ORDER BY columnFqn, recordId LIMIT :limit OFFSET :offset")
  @RegisterRowMapper(SnapshotMapper.class)
  List<SnapshotRow> searchSnapshots(
      @Bind("version") String version,
      @Bind("pattern") String pattern,
      @Bind("limit") int limit,
      @Bind("offset") int offset);

  @SqlQuery(
      "SELECT COUNT(*) FROM technical_binding_snapshot WHERE dataDictionaryVersion = :version "
          + "AND (LOWER(columnFqn) LIKE :pattern OR LOWER(COALESCE(cdeCode, '')) LIKE :pattern "
          + "OR LOWER(COALESCE(cdeName, '')) LIKE :pattern)")
  long countSearchedSnapshots(@Bind("version") String version, @Bind("pattern") String pattern);

  @SqlQuery(
      "SELECT * FROM technical_binding_snapshot WHERE dataDictionaryVersion = :version "
          + "AND recordId = :recordId")
  @RegisterRowMapper(SnapshotMapper.class)
  SnapshotRow findSnapshot(@Bind("version") String version, @Bind("recordId") String recordId);

  @SqlQuery(
      "SELECT * FROM technical_binding_snapshot WHERE dataDictionaryVersion = :version "
          + "AND columnKey = :columnKey")
  @RegisterRowMapper(SnapshotMapper.class)
  SnapshotRow findSnapshotByColumnKey(
      @Bind("version") String version, @Bind("columnKey") String columnKey);

  @SqlQuery(
      "SELECT * FROM technical_binding_snapshot WHERE recordId = :recordId "
          + "ORDER BY frozenAt DESC LIMIT 1")
  @RegisterRowMapper(SnapshotMapper.class)
  SnapshotRow findLatestSnapshotOfRecord(@Bind("recordId") String recordId);

  @SqlQuery(
      "SELECT DISTINCT dataDictionaryVersion FROM technical_binding_snapshot "
          + "WHERE columnKey = :columnKey")
  List<String> listSnapshotVersionsOfColumn(@Bind("columnKey") String columnKey);

  @SqlQuery(
      "SELECT dataDictionaryVersion, COUNT(*) AS bindings, MAX(frozenAt) AS frozenAt "
          + "FROM technical_binding_snapshot GROUP BY dataDictionaryVersion")
  @RegisterRowMapper(SnapshotSummaryMapper.class)
  List<SnapshotSummary> listSnapshotSummaries();

  // ---- outbox ------------------------------------------------------------------------------

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO technical_outbox (kind, subjectKey, payload, enqueuedAt, attempts) "
              + "VALUES (:kind, :subjectKey, :payload, :now, 0) ON DUPLICATE KEY UPDATE "
              + "payload = VALUES(payload), enqueuedAt = VALUES(enqueuedAt)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO technical_outbox (kind, subjectKey, payload, enqueuedAt, attempts) "
              + "VALUES (:kind, :subjectKey, :payload, :now, 0) ON CONFLICT (kind, subjectKey) "
              + "DO UPDATE SET payload = EXCLUDED.payload, enqueuedAt = EXCLUDED.enqueuedAt",
      connectionType = POSTGRES)
  void enqueue(
      @Bind("kind") String kind,
      @Bind("subjectKey") String subjectKey,
      @Bind("payload") String payload,
      @Bind("now") long now);

  @SqlQuery(
      "SELECT kind, subjectKey, payload, enqueuedAt, attempts, lastError FROM technical_outbox "
          + "ORDER BY attempts, enqueuedAt, subjectKey LIMIT :limit")
  @RegisterRowMapper(OutboxMapper.class)
  List<OutboxEntry> listPending(@Bind("limit") int limit);

  @SqlQuery("SELECT COUNT(*) FROM technical_outbox")
  long countPending();

  /** Removes a processed entry unless it was enqueued again after it was read. */
  @SqlUpdate(
      "DELETE FROM technical_outbox WHERE kind = :kind AND subjectKey = :subjectKey "
          + "AND enqueuedAt <= :cutoff")
  int deleteProcessed(
      @Bind("kind") String kind,
      @Bind("subjectKey") String subjectKey,
      @Bind("cutoff") long cutoff);

  @SqlUpdate(
      "UPDATE technical_outbox SET attempts = attempts + 1, lastError = :lastError "
          + "WHERE kind = :kind AND subjectKey = :subjectKey")
  int markFailed(
      @Bind("kind") String kind,
      @Bind("subjectKey") String subjectKey,
      @Bind("lastError") String lastError);

  // ---- rows --------------------------------------------------------------------------------

  record StateRow(
      String dataDictionaryVersion,
      String previousDataDictionaryVersion,
      Long resetAt,
      String resetBy) {}

  record AuditRow(
      String id,
      String recordId,
      String columnFqn,
      String dataDictionaryVersion,
      String action,
      String changes,
      String actor,
      long at) {}

  record SnapshotRow(
      String dataDictionaryVersion,
      String recordId,
      String columnKey,
      String cdeTermId,
      String cdeCode,
      String cdeName,
      Integer rank,
      String columnFqn,
      String payload,
      long frozenAt) {}

  record SnapshotSummary(String dataDictionaryVersion, long bindings, long frozenAt) {}

  record OutboxEntry(
      String kind,
      String subjectKey,
      String payload,
      long enqueuedAt,
      int attempts,
      String lastError) {}

  class ChangeRequestMapper implements RowMapper<TechnicalRecordChangeRequest> {
    @Override
    public TechnicalRecordChangeRequest map(ResultSet rs, StatementContext ctx)
        throws SQLException {
      return TechnicalRecordChangeRequest.builder()
          .id(rs.getString("id"))
          .recordId(rs.getString("recordId"))
          .operation(rs.getString("operation"))
          .baseRevision(rs.getLong("baseRevision"))
          .proposedValues(rs.getString("proposedValues"))
          .status(rs.getString("status"))
          .revision(rs.getLong("revision"))
          .createdAt(rs.getLong("createdAt"))
          .createdBy(rs.getString("createdBy"))
          .updatedAt(rs.getLong("updatedAt"))
          .updatedBy(rs.getString("updatedBy"))
          .submittedAt(nullableLong(rs, "submittedAt"))
          .submittedBy(rs.getString("submittedBy"))
          .reviewedAt(nullableLong(rs, "reviewedAt"))
          .reviewedBy(rs.getString("reviewedBy"))
          .reviewComment(rs.getString("reviewComment"))
          .build();
    }
  }

  class StateMapper implements RowMapper<StateRow> {
    @Override
    public StateRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new StateRow(
          rs.getString("dataDictionaryVersion"),
          rs.getString("previousDataDictionaryVersion"),
          nullableLong(rs, "resetAt"),
          rs.getString("resetBy"));
    }
  }

  class RecordMapper implements RowMapper<TechnicalRecord> {
    @Override
    public TechnicalRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
      return TechnicalRecord.builder()
          .id(rs.getString("id"))
          .columnKey(rs.getString("columnKey"))
          .columnFqn(rs.getString("columnFqn"))
          .sourceService(rs.getString("sourceService"))
          .sourceDatabase(rs.getString("sourceDatabase"))
          .sourceSchema(rs.getString("sourceSchema"))
          .sourceTable(rs.getString("sourceTable"))
          .sourceColumn(rs.getString("sourceColumn"))
          .dataType(rs.getString("dataType"))
          .dataLength(nullableInt(rs, "dataLength"))
          .dataPrecision(nullableInt(rs, "dataPrecision"))
          .dataScale(nullableInt(rs, "dataScale"))
          .description(rs.getString("description"))
          .sourceStatus(rs.getString("sourceStatus"))
          .cdeTermId(rs.getString("cdeTermId"))
          .cdeAssignedAt(nullableLong(rs, "cdeAssignedAt"))
          .cdeAssignedBy(rs.getString("cdeAssignedBy"))
          .rank(nullableInt(rs, "survivorshipRank"))
          .elementType(rs.getString("elementType"))
          .generationType(rs.getString("generationType"))
          .creationMethod(rs.getString("creationMethod"))
          .timeliness(rs.getString("timeliness"))
          .systemOwnerId(rs.getString("systemOwnerId"))
          .status(rs.getString("status"))
          .submittedAt(nullableLong(rs, "submittedAt"))
          .submittedBy(rs.getString("submittedBy"))
          .reviewedAt(nullableLong(rs, "reviewedAt"))
          .reviewedBy(rs.getString("reviewedBy"))
          .reviewComment(rs.getString("reviewComment"))
          .revision(rs.getLong("revision"))
          .createdAt(rs.getLong("createdAt"))
          .createdBy(rs.getString("createdBy"))
          .updatedAt(rs.getLong("updatedAt"))
          .updatedBy(rs.getString("updatedBy"))
          .build();
    }
  }

  class AuditMapper implements RowMapper<AuditRow> {
    @Override
    public AuditRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new AuditRow(
          rs.getString("id"),
          rs.getString("recordId"),
          rs.getString("columnFqn"),
          rs.getString("dataDictionaryVersion"),
          rs.getString("action"),
          rs.getString("changes"),
          rs.getString("actor"),
          rs.getLong("changedAt"));
    }
  }

  class SnapshotMapper implements RowMapper<SnapshotRow> {
    @Override
    public SnapshotRow map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new SnapshotRow(
          rs.getString("dataDictionaryVersion"),
          rs.getString("recordId"),
          rs.getString("columnKey"),
          rs.getString("cdeTermId"),
          rs.getString("cdeCode"),
          rs.getString("cdeName"),
          nullableInt(rs, "survivorshipRank"),
          rs.getString("columnFqn"),
          rs.getString("payload"),
          rs.getLong("frozenAt"));
    }
  }

  class SnapshotSummaryMapper implements RowMapper<SnapshotSummary> {
    @Override
    public SnapshotSummary map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new SnapshotSummary(
          rs.getString("dataDictionaryVersion"), rs.getLong("bindings"), rs.getLong("frozenAt"));
    }
  }

  class OutboxMapper implements RowMapper<OutboxEntry> {
    @Override
    public OutboxEntry map(ResultSet rs, StatementContext ctx) throws SQLException {
      return new OutboxEntry(
          rs.getString("kind"),
          rs.getString("subjectKey"),
          rs.getString("payload"),
          rs.getLong("enqueuedAt"),
          rs.getInt("attempts"),
          rs.getString("lastError"));
    }
  }

  private static Integer nullableInt(ResultSet rs, String column) throws SQLException {
    final int value = rs.getInt(column);
    return rs.wasNull() ? null : value;
  }

  private static Long nullableLong(ResultSet rs, String column) throws SQLException {
    final long value = rs.getLong(column);
    return rs.wasNull() ? null : value;
  }
}
