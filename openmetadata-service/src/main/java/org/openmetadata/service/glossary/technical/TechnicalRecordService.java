/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.StateRow;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Writes Technical Dictionary records. Every write runs in one transaction that holds the state
 * lock, so it cannot interleave with a Data Dictionary cutover; it checks the CDE against the bound
 * Data Dictionary version, the rank and the revision, and records the audit row and the outbox
 * entries. After commit the outbox is flushed, so the search document and the Column tags follow.
 */
public class TechnicalRecordService {
  private static final String TABLE_FIELDS = "columns";

  private final TechnicalRecordValidator validator;
  private final TechnicalCdeReferenceResolver cdeResolver = new TechnicalCdeReferenceResolver();

  public TechnicalRecordService() {
    this(new TechnicalRecordValidator());
  }

  public TechnicalRecordService(TechnicalRecordValidator validator) {
    this.validator = validator;
  }

  /** Declares a Column as a draft; it is reviewed only after it is submitted. */
  public TechnicalRecord declare(TechnicalRecordDeclaration declaration, String actor) {
    final TechnicalColumnSource column = requireColumn(declaration.columnFqn());
    final TechnicalRecordValues values = validator.validate(declaration.values());
    final TechnicalRecord created =
        write(true, (handle, version) -> insert(handle, version, column, values, actor));
    TechnicalOutbox.flush();
    return created;
  }

  /** Replaces the editable values of a record after checking the expected revision. */
  public TechnicalRecord update(
      UUID recordId, long expectedRevision, TechnicalRecordValues requested, String actor) {
    final TechnicalRecord updated =
        write(
            true,
            (handle, version) ->
                replaceValues(handle, version, recordId, expectedRevision, requested, actor));
    TechnicalOutbox.flush();
    return updated;
  }

  public void delete(UUID recordId, long expectedRevision, String actor) {
    write(
        false,
        (handle, version) -> {
          final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
          final TechnicalRecord existing = requireRecord(dao, recordId);
          if (existing.isApproved()) {
            throw TechnicalDictionaryErrors.conflict(
                TechnicalDictionaryErrors.APPROVED_EDIT_REQUIRES_CHANGE_REQUEST,
                "An Approved record must be deleted through a change request");
          }
          if (dao.deleteRecord(existing.id(), expectedRevision) != 1) {
            throw revisionConflict();
          }
          TechnicalRecordAudit.record(
              dao, TechnicalRecordAudit.DELETE, existing, null, version, actor);
          TechnicalOutbox.enqueueRecord(dao, existing);
          return existing;
        });
    TechnicalOutbox.flush();
  }

  /** Sends a draft for independent approval. */
  public TechnicalRecord submit(UUID recordId, long expectedRevision, String actor) {
    final TechnicalRecord submitted = submitWithoutFlush(recordId, expectedRevision, actor);
    TechnicalOutbox.flush();
    return submitted;
  }

  public TechnicalRecord approve(UUID recordId, long expectedRevision, String actor) {
    final TechnicalRecord approved = approveWithoutFlush(recordId, expectedRevision, actor);
    TechnicalOutbox.flush();
    return approved;
  }

  public TechnicalRecord reject(UUID recordId, long expectedRevision, String actor) {
    final TechnicalRecord rejected = rejectWithoutFlush(recordId, expectedRevision, actor);
    TechnicalOutbox.flush();
    return rejected;
  }

  /** Returns a submitted new-record request to Draft. Only its submitter may withdraw it. */
  public TechnicalRecord withdraw(UUID recordId, long expectedRevision, String actor) {
    final TechnicalRecord withdrawn =
        write(
            false,
            (handle, version) -> {
              final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
              final TechnicalRecord existing = requireRecord(dao, recordId);
              if (existing.revision() != expectedRevision) {
                throw revisionConflict();
              }
              if (!existing.isInReview()) {
                throw TechnicalDictionaryErrors.conflict(
                    TechnicalDictionaryErrors.INVALID_STATUS_TRANSITION,
                    "Only a record in review can be withdrawn");
              }
              if (!Objects.equals(existing.submittedBy(), actor)) {
                throw TechnicalDictionaryErrors.forbidden(
                    TechnicalDictionaryErrors.SELF_APPROVAL_FORBIDDEN,
                    "Only the submitter can withdraw this record request");
              }
              final long now = System.currentTimeMillis();
              final TechnicalRecord draft =
                  existing.toBuilder()
                      .status(TechnicalRecord.STATUS_DRAFT)
                      .submittedAt(null)
                      .submittedBy(null)
                      .reviewedAt(null)
                      .reviewedBy(null)
                      .reviewComment(null)
                      .revision(existing.revision() + 1)
                      .updatedAt(now)
                      .updatedBy(actor)
                      .build();
              if (dao.updateEditable(draft, expectedRevision) != 1) {
                throw revisionConflict();
              }
              TechnicalRecordAudit.record(
                  dao, TechnicalRecordAudit.WITHDRAW, existing, draft, version, actor);
              TechnicalOutbox.enqueueRecord(dao, draft);
              return draft;
            });
    TechnicalOutbox.flush();
    return withdrawn;
  }

  /** Submits each item in its own transaction; the outbox is flushed once after the last one. */
  public List<TechnicalBulkReview.Outcome> submitAll(
      List<TechnicalBulkReview.Item> items, String actor) {
    return TechnicalBulkReview.run(
        items,
        (recordId, expectedRevision) -> submitWithoutFlush(recordId, expectedRevision, actor),
        TechnicalOutbox::flush);
  }

  /** Approves each item in its own transaction; the outbox is flushed once after the last one. */
  public List<TechnicalBulkReview.Outcome> approveAll(
      List<TechnicalBulkReview.Item> items, String actor) {
    return TechnicalBulkReview.run(
        items,
        (recordId, expectedRevision) -> approveWithoutFlush(recordId, expectedRevision, actor),
        TechnicalOutbox::flush);
  }

  /** Rejects each item in its own transaction; the outbox is flushed once after the last one. */
  public List<TechnicalBulkReview.Outcome> rejectAll(
      List<TechnicalBulkReview.Item> items, String actor) {
    return TechnicalBulkReview.run(
        items,
        (recordId, expectedRevision) -> rejectWithoutFlush(recordId, expectedRevision, actor),
        TechnicalOutbox::flush);
  }

  private TechnicalRecord submitWithoutFlush(UUID recordId, long expectedRevision, String actor) {
    return write(
        false,
        (handle, version) -> submitDraft(handle, version, recordId, expectedRevision, actor));
  }

  private TechnicalRecord approveWithoutFlush(UUID recordId, long expectedRevision, String actor) {
    return write(
        true,
        (handle, version) -> review(handle, version, recordId, expectedRevision, actor, true));
  }

  private TechnicalRecord rejectWithoutFlush(UUID recordId, long expectedRevision, String actor) {
    return write(
        false,
        (handle, version) -> review(handle, version, recordId, expectedRevision, actor, false));
  }

  /**
   * Runs {@code operation} in a transaction holding the state lock and the active Data Dictionary
   * version. Rank-affecting writes take the lock exclusively, which serializes the rank check.
   */
  <T> T write(boolean affectsRank, TransactionOperation<T> operation) {
    try {
      return Entity.getJdbi()
          .inTransaction(
              handle -> {
                final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
                final StateRow state = lockState(dao, affectsRank);
                final String version = TechnicalDictionaryState.requireActiveVersion(state);
                return operation.run(handle, version);
              });
    } catch (UnableToExecuteStatementException exception) {
      throw translate(exception);
    }
  }

  /** Same transaction contract for callers that already know their statements. */
  static StateRow lockState(TechnicalDictionaryDAO dao, boolean exclusive) {
    if (exclusive) {
      dao.lockStateExclusive();
    } else {
      dao.lockStateShared();
    }
    return dao.findState();
  }

  private TechnicalRecord insert(
      Handle handle,
      String version,
      TechnicalColumnSource column,
      TechnicalRecordValues values,
      String actor) {
    return create(
        handle.attach(TechnicalDictionaryDAO.class),
        version,
        column,
        values,
        TechnicalRecordAudit.CREATE,
        true,
        actor);
  }

  /** Creates the record of a Column; {@code checkRank} is false while an import is applied. */
  TechnicalRecord create(
      TechnicalDictionaryDAO dao,
      String version,
      TechnicalColumnSource column,
      TechnicalRecordValues values,
      String action,
      boolean checkRank,
      String actor) {
    if (!dao.findByColumnKeys(List.of(column.columnKey())).isEmpty()) {
      throw alreadyDeclared(column.columnFqn());
    }
    final long now = System.currentTimeMillis();
    final TechnicalRecord record =
        withValues(newRecord(column, actor, now), values, null, actor, now).toBuilder()
            .cdeAssignedAt(null)
            .cdeAssignedBy(null)
            .build();
    requireAssignableCde(record, version);
    if (checkRank && record.isApproved()) {
      requireUniqueRank(dao, record);
    }
    dao.insertRecord(record);
    TechnicalRecordAudit.record(dao, action, null, record, version, actor);
    TechnicalOutbox.enqueueRecord(dao, record);
    return record;
  }

  private TechnicalRecord replaceValues(
      Handle handle,
      String version,
      UUID recordId,
      long expectedRevision,
      TechnicalRecordValues values,
      String actor) {
    final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
    final TechnicalRecord existing = requireRecord(dao, recordId);
    if (existing.revision() != expectedRevision) {
      throw revisionConflict();
    }
    if (existing.isApproved()) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.APPROVED_EDIT_REQUIRES_CHANGE_REQUEST,
          "An Approved record must be changed through a change request");
    }
    return change(
        dao,
        version,
        existing,
        validator.validate(values),
        TechnicalRecordAudit.UPDATE,
        true,
        actor);
  }

  /** Applies new editable values to a record; returns the record unchanged when nothing differs. */
  TechnicalRecord change(
      TechnicalDictionaryDAO dao,
      String version,
      TechnicalRecord existing,
      TechnicalRecordValues values,
      String action,
      boolean checkRank,
      String actor) {
    final long now = System.currentTimeMillis();
    TechnicalRecord record = withValues(existing, values, existing, actor, now);
    final boolean resubmitted = existing.isRejected();
    if (resubmitted) {
      record =
          record.toBuilder()
              .status(TechnicalRecord.STATUS_IN_REVIEW)
              .submittedAt(now)
              .submittedBy(actor)
              .reviewedAt(null)
              .reviewedBy(null)
              .reviewComment(null)
              .build();
    }
    final boolean changed = resubmitted || !sameEditable(existing, record);
    if (changed) {
      requireAssignableCde(record, version);
      if (checkRank && record.isApproved()) {
        requireUniqueRank(dao, record);
      }
      if (dao.updateEditable(record, existing.revision()) != 1) {
        throw revisionConflict();
      }
      if (action != null) {
        TechnicalRecordAudit.record(
            dao,
            resubmitted ? TechnicalRecordAudit.RESUBMIT : action,
            existing,
            record,
            version,
            actor);
      }
      TechnicalOutbox.enqueueRecord(dao, record);
    }
    return changed ? record : existing;
  }

  /** Checks the final state of an import: no rank of a CDE is held by two Available records. */
  void requireFinalRanks(TechnicalDictionaryDAO dao, List<TechnicalRecord> touched) {
    touched.forEach(record -> requireUniqueRank(dao, record));
  }

  /** The record with the requested values; the CDE assignment time changes only with the CDE. */
  private static TechnicalRecord withValues(
      TechnicalRecord base,
      TechnicalRecordValues values,
      TechnicalRecord previous,
      String actor,
      long now) {
    final String cde = values.cde() == null ? null : values.cde().toString();
    final boolean cdeChanged = previous == null || !Objects.equals(previous.cdeTermId(), cde);
    final boolean effective = base.isApproved();
    return base.toBuilder()
        .cdeTermId(cde)
        .cdeAssignedAt(
            cde == null || !effective ? null : cdeChanged ? (Long) now : base.cdeAssignedAt())
        .cdeAssignedBy(cde == null || !effective ? null : cdeChanged ? actor : base.cdeAssignedBy())
        .rank(values.rank())
        .elementType(values.elementType())
        .generationType(values.generationType())
        .creationMethod(values.creationMethod())
        .timeliness(values.timeliness())
        .systemOwnerId(TechnicalOwners.serialize(values.systemOwners()))
        .revision(previous == null ? 1L : previous.revision() + 1)
        .updatedAt(now)
        .updatedBy(actor)
        .build();
  }

  private static boolean sameEditable(TechnicalRecord left, TechnicalRecord right) {
    return TechnicalRecordValues.of(left).equals(TechnicalRecordValues.of(right));
  }

  void requireAssignableCde(TechnicalRecord record, String version) {
    if (record.hasCde()) {
      cdeResolver.requireAssignable(UUID.fromString(record.cdeTermId()), version);
    }
  }

  static void requireUniqueRank(TechnicalDictionaryDAO dao, TechnicalRecord record) {
    if (record.isApproved() && record.hasCde() && record.rank() != null && record.isAvailable()) {
      final String holder = dao.findRankHolder(record.cdeTermId(), record.rank(), record.id());
      if (holder != null) {
        throw TechnicalDictionaryErrors.conflict(
            TechnicalDictionaryErrors.RANK_DUPLICATE,
            String.format(
                "Rank %d of this CDE is already held by Column '%s'", record.rank(), holder));
      }
    }
  }

  static TechnicalRecord requireRecord(TechnicalDictionaryDAO dao, UUID recordId) {
    final TechnicalRecord record = dao.findById(recordId.toString());
    if (record == null) {
      throw TechnicalDictionaryErrors.notFound(
          TechnicalDictionaryErrors.RECORD_NOT_FOUND,
          String.format("Technical Dictionary record %s was not found", recordId));
    }
    return record;
  }

  private static TechnicalRecord newRecord(TechnicalColumnSource column, String actor, long now) {
    return column
        .into(TechnicalRecord.builder())
        .id(UUID.randomUUID().toString())
        .sourceStatus(TechnicalDictionaryProfile.SOURCE_AVAILABLE)
        .status(TechnicalRecord.STATUS_DRAFT)
        .createdAt(now)
        .createdBy(actor)
        .build();
  }

  private TechnicalRecord submitDraft(
      Handle handle, String version, UUID recordId, long expectedRevision, String actor) {
    final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
    final TechnicalRecord existing = requireRecord(dao, recordId);
    if (existing.revision() != expectedRevision) {
      throw revisionConflict();
    }
    if (!existing.isDraft()) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.INVALID_STATUS_TRANSITION,
          "Only a draft can be submitted for review");
    }
    final long now = System.currentTimeMillis();
    final TechnicalRecord submitted =
        existing.toBuilder()
            .status(TechnicalRecord.STATUS_IN_REVIEW)
            .submittedAt(now)
            .submittedBy(actor)
            .revision(existing.revision() + 1)
            .updatedAt(now)
            .updatedBy(actor)
            .build();
    requireAssignableCde(submitted, version);
    if (dao.updateEditable(submitted, expectedRevision) != 1) {
      throw revisionConflict();
    }
    TechnicalRecordAudit.record(
        dao, TechnicalRecordAudit.SUBMIT, existing, submitted, version, actor);
    TechnicalOutbox.enqueueRecord(dao, submitted);
    return submitted;
  }

  private TechnicalRecord review(
      Handle handle,
      String version,
      UUID recordId,
      long expectedRevision,
      String actor,
      boolean approve) {
    final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
    final TechnicalRecord existing = requireRecord(dao, recordId);
    if (existing.revision() != expectedRevision) {
      throw revisionConflict();
    }
    if (!existing.isInReview()) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.INVALID_STATUS_TRANSITION,
          "Only a record in review can be approved or rejected");
    }
    if (Objects.equals(existing.createdBy(), actor)) {
      throw TechnicalDictionaryErrors.forbidden(
          TechnicalDictionaryErrors.SELF_APPROVAL_FORBIDDEN,
          "The creator cannot review their own Technical Dictionary record");
    }
    final long now = System.currentTimeMillis();
    TechnicalRecord reviewed =
        existing.toBuilder()
            .status(approve ? TechnicalRecord.STATUS_APPROVED : TechnicalRecord.STATUS_REJECTED)
            .reviewedAt(now)
            .reviewedBy(actor)
            .reviewComment(null)
            .revision(existing.revision() + 1)
            .updatedAt(now)
            .updatedBy(actor)
            .build();
    if (approve) {
      requireAssignableCde(reviewed, version);
      requireUniqueRank(dao, reviewed);
      reviewed =
          reviewed.toBuilder()
              .cdeAssignedAt(reviewed.hasCde() ? now : null)
              .cdeAssignedBy(reviewed.hasCde() ? actor : null)
              .build();
    }
    if (dao.updateEditable(reviewed, expectedRevision) != 1) {
      throw revisionConflict();
    }
    TechnicalRecordAudit.record(
        dao,
        approve ? TechnicalRecordAudit.APPROVE : TechnicalRecordAudit.REJECT,
        existing,
        reviewed,
        version,
        actor);
    TechnicalOutbox.enqueueRecord(dao, reviewed);
    return reviewed;
  }

  /** The top-level Column as stored in `table_entity`. */
  static TechnicalColumnSource requireColumn(String columnFqn) {
    if (nullOrEmpty(columnFqn)) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.INVALID_FIELD, "columnFqn is required");
    }
    final Table table = findTable(FullyQualifiedName.getParentFQN(columnFqn));
    final List<TechnicalColumnSource> columns =
        table == null ? List.of() : TechnicalColumnSource.columnsOf(table);
    return columns.stream()
        .filter(column -> columnFqn.equals(column.columnFqn()))
        .findFirst()
        .orElseThrow(
            () ->
                TechnicalDictionaryErrors.notFound(
                    TechnicalDictionaryErrors.COLUMN_NOT_FOUND,
                    String.format("Column '%s' was not found", columnFqn)));
  }

  private static Table findTable(String tableFqn) {
    Table table = null;
    try {
      table =
          nullOrEmpty(tableFqn)
              ? null
              : Entity.getEntityByName(Entity.TABLE, tableFqn, TABLE_FIELDS, Include.NON_DELETED);
    } catch (EntityNotFoundException exception) {
      table = null;
    }
    return table;
  }

  private static RuntimeException translate(UnableToExecuteStatementException exception) {
    if (isChangeRequestConstraint(exception)) {
      return TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.CHANGE_REQUEST_EXISTS,
          "The record already has an open change request");
    }
    return isConstraintViolation(exception)
        ? TechnicalDictionaryErrors.conflict(
            TechnicalDictionaryErrors.COLUMN_ALREADY_DECLARED,
            "The Column was declared by another user at the same time")
        : exception;
  }

  private static boolean isChangeRequestConstraint(Throwable exception) {
    Throwable current = exception;
    boolean match = false;
    while (current != null && !match) {
      final String message = current.getMessage();
      match =
          message != null
              && (message.contains("uq_technical_change_record")
                  || message.contains("technical_record_change_request.recordId"));
      current = current.getCause();
    }
    return match;
  }

  static boolean isConstraintViolation(Throwable exception) {
    Throwable current = exception;
    boolean violation = false;
    while (current != null && !violation) {
      violation =
          current instanceof java.sql.SQLException sql
              && sql.getSQLState() != null
              && sql.getSQLState().startsWith("23");
      current = current.getCause();
    }
    return violation;
  }

  static RuntimeException alreadyDeclared(String columnFqn) {
    return TechnicalDictionaryErrors.conflict(
        TechnicalDictionaryErrors.COLUMN_ALREADY_DECLARED,
        String.format("Column '%s' is already declared in the Technical Dictionary", columnFqn));
  }

  static RuntimeException revisionConflict() {
    return TechnicalDictionaryErrors.conflict(
        TechnicalDictionaryErrors.RECORD_REVISION_CONFLICT,
        "The record was changed by someone else; reload it and try again");
  }

  /** One unit of work of {@link #write}. */
  @FunctionalInterface
  interface TransactionOperation<T> {
    T run(Handle handle, String dataDictionaryVersion);
  }
}
