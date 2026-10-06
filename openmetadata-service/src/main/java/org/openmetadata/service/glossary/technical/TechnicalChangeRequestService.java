/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.Objects;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;

/** Maker-checker lifecycle for proposed updates and deletions of Approved records. */
public final class TechnicalChangeRequestService {
  private final TechnicalRecordValidator validator = new TechnicalRecordValidator();
  private final TechnicalRecordService records = new TechnicalRecordService();

  public TechnicalRecordChangeRequest save(
      UUID recordId, TechnicalChangeRequestCreate input, String actor) {
    requireExpectedRevision(input.expectedRevision());
    final String operation = normalizeOperation(input.operation());
    final TechnicalRecordValues values =
        TechnicalRecordChangeRequest.OPERATION_UPDATE.equals(operation)
            ? validator.validate(input.values())
            : null;
    final TechnicalRecordChangeRequest result =
        records.write(
            true,
            (handle, version) ->
                saveInTransaction(
                    handle, version, recordId, input.expectedRevision(), operation, values, actor));
    TechnicalOutbox.flush();
    return result;
  }

  public TechnicalRecordChangeRequest get(UUID recordId) {
    final TechnicalRecordChangeRequest request = dao().findChangeRequest(recordId.toString());
    if (request == null) {
      throw notFound(recordId);
    }
    return request;
  }

  public TechnicalRecordChangeRequest submit(UUID recordId, long expectedRevision, String actor) {
    final TechnicalRecordChangeRequest result =
        records.write(
            false,
            (handle, version) -> {
              final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
              final TechnicalRecord active = TechnicalRecordService.requireRecord(dao, recordId);
              final TechnicalRecordChangeRequest existing = requireRequest(dao, recordId);
              requireRequestRevision(existing, expectedRevision);
              if (!existing.isDraft() && !existing.isRejected()) {
                throw invalidTransition("Only a Draft or Rejected change can be submitted");
              }
              requireCurrentBase(active, existing);
              if (existing.isUpdate()) {
                final TechnicalRecordValues proposed = validator.validate(values(existing));
                records.requireAssignableCde(proposed(active, proposed), version);
              }
              final long now = System.currentTimeMillis();
              final boolean resubmit = existing.isRejected();
              final TechnicalRecordChangeRequest submitted =
                  existing.toBuilder()
                      .status(TechnicalRecordChangeRequest.STATUS_IN_REVIEW)
                      .revision(existing.revision() + 1)
                      .updatedAt(now)
                      .updatedBy(actor)
                      .submittedAt(now)
                      .submittedBy(actor)
                      .reviewedAt(null)
                      .reviewedBy(null)
                      .reviewComment(null)
                      .build();
              update(dao, submitted, expectedRevision);
              audit(
                  dao,
                  resubmit
                      ? TechnicalRecordAudit.RESUBMIT_CHANGE
                      : TechnicalRecordAudit.SUBMIT_CHANGE,
                  active,
                  submitted,
                  version,
                  actor);
              TechnicalOutbox.enqueueIndex(dao, active.id());
              return submitted;
            });
    TechnicalOutbox.flush();
    return result;
  }

  public TechnicalRecordChangeRequest reject(UUID recordId, long expectedRevision, String actor) {
    final TechnicalRecordChangeRequest result =
        records.write(
            false,
            (handle, version) -> {
              final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
              final TechnicalRecord active = TechnicalRecordService.requireRecord(dao, recordId);
              final TechnicalRecordChangeRequest existing = requireRequest(dao, recordId);
              requireReviewable(existing, expectedRevision, actor);
              final long now = System.currentTimeMillis();
              final TechnicalRecordChangeRequest rejected =
                  existing.toBuilder()
                      .status(TechnicalRecordChangeRequest.STATUS_REJECTED)
                      .revision(existing.revision() + 1)
                      .updatedAt(now)
                      .updatedBy(actor)
                      .reviewedAt(now)
                      .reviewedBy(actor)
                      .reviewComment(null)
                      .build();
              update(dao, rejected, expectedRevision);
              audit(dao, TechnicalRecordAudit.REJECT_CHANGE, active, rejected, version, actor);
              TechnicalOutbox.enqueueIndex(dao, active.id());
              return rejected;
            });
    TechnicalOutbox.flush();
    return result;
  }

  /** Applies a proposal atomically and returns the resulting Approved record, or null for delete. */
  public TechnicalRecord approve(UUID recordId, long expectedRevision, String actor) {
    final TechnicalRecord result =
        records.write(
            true,
            (handle, version) -> {
              final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
              final TechnicalRecord active = dao.findByIdForUpdate(recordId.toString());
              if (active == null) {
                throw TechnicalDictionaryErrors.notFound(
                    TechnicalDictionaryErrors.RECORD_NOT_FOUND,
                    "Technical Dictionary record " + recordId + " was not found");
              }
              final TechnicalRecordChangeRequest existing = requireRequestForUpdate(dao, recordId);
              requireReviewable(existing, expectedRevision, actor);
              requireCurrentBase(active, existing);

              final TechnicalRecord approved;
              if (existing.isDelete()) {
                if (dao.deleteRecord(active.id(), active.revision()) != 1) {
                  throw stale();
                }
                TechnicalRecordAudit.recordChange(
                    dao,
                    TechnicalRecordAudit.APPROVE_CHANGE,
                    existing,
                    active,
                    null,
                    version,
                    actor);
                TechnicalOutbox.enqueueRecord(dao, active);
                approved = null;
              } else {
                final TechnicalRecordValues proposed = validator.validate(values(existing));
                if (TechnicalRecordValues.of(active).equals(proposed)) {
                  final long now = System.currentTimeMillis();
                  approved =
                      active.toBuilder()
                          .revision(active.revision() + 1)
                          .updatedAt(now)
                          .updatedBy(actor)
                          .build();
                  if (dao.updateEditable(approved, active.revision()) != 1) {
                    throw stale();
                  }
                  TechnicalRecordAudit.recordChange(
                      dao,
                      TechnicalRecordAudit.APPROVE_CHANGE,
                      existing,
                      active,
                      approved,
                      version,
                      actor);
                  TechnicalOutbox.enqueueRecord(dao, approved);
                } else {
                  approved = records.change(dao, version, active, proposed, null, true, actor);
                  TechnicalRecordAudit.recordChange(
                      dao,
                      TechnicalRecordAudit.APPROVE_CHANGE,
                      existing,
                      active,
                      approved,
                      version,
                      actor);
                }
              }
              if (dao.deleteChangeRequest(active.id(), expectedRevision) != 1) {
                throw stale();
              }
              TechnicalOutbox.enqueueIndex(dao, active.id());
              return approved;
            });
    TechnicalOutbox.flush();
    return result;
  }

  public void cancel(UUID recordId, long expectedRevision, String actor) {
    records.write(
        false,
        (handle, version) -> {
          final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
          final TechnicalRecord active = TechnicalRecordService.requireRecord(dao, recordId);
          final TechnicalRecordChangeRequest existing = requireRequest(dao, recordId);
          requireRequestRevision(existing, expectedRevision);
          if (existing.isInReview()) {
            throw invalidTransition("A change in review cannot be cancelled");
          }
          if (dao.deleteChangeRequest(active.id(), expectedRevision) != 1) {
            throw stale();
          }
          audit(dao, TechnicalRecordAudit.CANCEL_CHANGE, active, existing, version, actor);
          TechnicalOutbox.enqueueIndex(dao, active.id());
          return active;
        });
    TechnicalOutbox.flush();
  }

  private TechnicalRecordChangeRequest saveInTransaction(
      Handle handle,
      String version,
      UUID recordId,
      long expectedRecordRevision,
      String operation,
      TechnicalRecordValues values,
      String actor) {
    final TechnicalDictionaryDAO dao = handle.attach(TechnicalDictionaryDAO.class);
    final TechnicalRecord active = TechnicalRecordService.requireRecord(dao, recordId);
    return saveDraft(dao, version, active, expectedRecordRevision, operation, values, actor);
  }

  /** Import integration: Approved rows become proposals in the import transaction. */
  TechnicalRecordChangeRequest saveImported(
      TechnicalDictionaryDAO dao,
      String version,
      TechnicalRecord active,
      TechnicalRecordValues values,
      Long expectedChangeRevision,
      String actor) {
    return saveDraft(
        dao,
        version,
        active,
        expectedChangeRevision == null ? active.revision() : expectedChangeRevision,
        TechnicalRecordChangeRequest.OPERATION_UPDATE,
        validator.validate(values),
        actor);
  }

  private TechnicalRecordChangeRequest saveDraft(
      TechnicalDictionaryDAO dao,
      String version,
      TechnicalRecord active,
      long expectedRecordRevision,
      String operation,
      TechnicalRecordValues values,
      String actor) {
    if (!active.isApproved()) {
      throw invalidTransition("Change requests apply only to Approved records");
    }
    if (values != null) {
      records.requireAssignableCde(proposed(active, values), version);
    }
    final TechnicalRecordChangeRequest existing = dao.findChangeRequestForUpdate(active.id());
    if ((existing == null && active.revision() != expectedRecordRevision)
        || (existing != null && existing.revision() != expectedRecordRevision)) {
      throw stale();
    }
    if (existing != null && existing.isInReview()) {
      throw TechnicalDictionaryErrors.conflict(
          TechnicalDictionaryErrors.CHANGE_REQUEST_EXISTS,
          "The record already has a change request in review");
    }
    if (existing != null && existing.baseRevision() != active.revision()) {
      throw stale();
    }
    final long now = System.currentTimeMillis();
    final TechnicalRecordChangeRequest saved =
        TechnicalRecordChangeRequest.builder()
            .id(existing == null ? UUID.randomUUID().toString() : existing.id())
            .recordId(active.id())
            .operation(operation)
            .baseRevision(active.revision())
            .proposedValues(values == null ? null : JsonUtils.pojoToJson(values))
            .status(TechnicalRecordChangeRequest.STATUS_DRAFT)
            .revision(existing == null ? 1L : existing.revision() + 1)
            .createdAt(existing == null ? now : existing.createdAt())
            .createdBy(existing == null ? actor : existing.createdBy())
            .updatedAt(now)
            .updatedBy(actor)
            .build();
    if (existing == null) {
      dao.insertChangeRequest(saved);
    } else {
      update(dao, saved, existing.revision());
    }
    audit(
        dao,
        existing == null ? TechnicalRecordAudit.CREATE_CHANGE : TechnicalRecordAudit.UPDATE_CHANGE,
        active,
        saved,
        version,
        actor);
    TechnicalOutbox.enqueueIndex(dao, active.id());
    return saved;
  }

  private static void audit(
      TechnicalDictionaryDAO dao,
      String action,
      TechnicalRecord active,
      TechnicalRecordChangeRequest request,
      String version,
      String actor) {
    TechnicalRecordAudit.recordChange(
        dao,
        action,
        request,
        active,
        request.isDelete() ? null : proposed(active, values(request)),
        version,
        actor);
  }

  private static TechnicalRecord proposed(TechnicalRecord active, TechnicalRecordValues values) {
    return active.toBuilder()
        .cdeTermId(values.cde() == null ? null : values.cde().toString())
        .rank(values.rank())
        .elementType(values.elementType())
        .generationType(values.generationType())
        .creationMethod(values.creationMethod())
        .timeliness(values.timeliness())
        .systemOwnerId(TechnicalOwners.serialize(values.systemOwners()))
        .build();
  }

  public static TechnicalRecordValues values(TechnicalRecordChangeRequest request) {
    return request.proposedValues() == null
        ? TechnicalRecordValues.EMPTY
        : JsonUtils.readValue(request.proposedValues(), TechnicalRecordValues.class);
  }

  /** Approved row with the proposal overlaid, for reviewer comparison; null for DELETE. */
  public TechnicalRecord proposedRecord(TechnicalRecordChangeRequest request) {
    if (request.isDelete()) {
      return null;
    }
    final TechnicalRecord active =
        TechnicalRecordService.requireRecord(dao(), UUID.fromString(request.recordId()));
    return proposed(active, values(request));
  }

  private static String normalizeOperation(String operation) {
    final String normalized = operation == null ? "" : operation.trim().toUpperCase();
    if (!TechnicalRecordChangeRequest.OPERATION_UPDATE.equals(normalized)
        && !TechnicalRecordChangeRequest.OPERATION_DELETE.equals(normalized)) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.INVALID_FIELD, "operation must be UPDATE or DELETE");
    }
    return normalized;
  }

  private static void requireExpectedRevision(Long revision) {
    if (revision == null) {
      throw TechnicalDictionaryErrors.badRequest(
          TechnicalDictionaryErrors.INVALID_FIELD, "expectedRevision is required");
    }
  }

  private static void requireReviewable(
      TechnicalRecordChangeRequest request, long expectedRevision, String actor) {
    requireRequestRevision(request, expectedRevision);
    if (!request.isInReview()) {
      throw invalidTransition("Only a change in review can be approved or rejected");
    }
    if (Objects.equals(request.createdBy(), actor)) {
      throw TechnicalDictionaryErrors.forbidden(
          TechnicalDictionaryErrors.SELF_APPROVAL_FORBIDDEN,
          "The proposer cannot review their own change request");
    }
  }

  private static void requireCurrentBase(
      TechnicalRecord active, TechnicalRecordChangeRequest request) {
    if (active.revision() != request.baseRevision()) {
      throw stale();
    }
  }

  private static void requireRequestRevision(
      TechnicalRecordChangeRequest request, long expectedRevision) {
    if (request.revision() != expectedRevision) {
      throw stale();
    }
  }

  private static void update(
      TechnicalDictionaryDAO dao, TechnicalRecordChangeRequest request, long expectedRevision) {
    if (dao.updateChangeRequest(request, expectedRevision) != 1) {
      throw stale();
    }
  }

  private static TechnicalRecordChangeRequest requireRequest(
      TechnicalDictionaryDAO dao, UUID recordId) {
    final TechnicalRecordChangeRequest request = dao.findChangeRequest(recordId.toString());
    if (request == null) {
      throw notFound(recordId);
    }
    return request;
  }

  private static TechnicalRecordChangeRequest requireRequestForUpdate(
      TechnicalDictionaryDAO dao, UUID recordId) {
    final TechnicalRecordChangeRequest request =
        dao.findChangeRequestForUpdate(recordId.toString());
    if (request == null) {
      throw notFound(recordId);
    }
    return request;
  }

  private static RuntimeException notFound(UUID recordId) {
    return TechnicalDictionaryErrors.notFound(
        TechnicalDictionaryErrors.CHANGE_REQUEST_NOT_FOUND,
        "No change request exists for Technical Dictionary record " + recordId);
  }

  private static RuntimeException stale() {
    return TechnicalDictionaryErrors.conflict(
        TechnicalDictionaryErrors.CHANGE_REQUEST_STALE,
        "The Approved record or its change request changed; reload and try again");
  }

  private static RuntimeException invalidTransition(String message) {
    return TechnicalDictionaryErrors.conflict(
        TechnicalDictionaryErrors.INVALID_STATUS_TRANSITION, message);
  }

  private static TechnicalDictionaryDAO dao() {
    return org.openmetadata.service.Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }
}
