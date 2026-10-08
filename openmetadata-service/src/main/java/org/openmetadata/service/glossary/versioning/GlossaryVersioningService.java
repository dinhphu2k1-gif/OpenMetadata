/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry;
import org.openmetadata.service.glossary.dq.DqCatalog;
import org.openmetadata.service.glossary.dq.DqTestOutbox;
import org.openmetadata.service.glossary.technical.TechnicalCutover;
import org.openmetadata.service.glossary.technical.TechnicalOutbox;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.SnapshotHistoryRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.SnapshotOutboxRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.GlossaryBusinessVersion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Application service for isolated glossary working versions and immutable snapshots. */
public class GlossaryVersioningService {
  private static final Logger LOG = LoggerFactory.getLogger(GlossaryVersioningService.class);
  private static final int OUTBOX_BATCH_SIZE = 100;
  private static final int MAX_FLUSH_ROUNDS = 500;
  private static final ThreadLocal<Boolean> DEFER_SIDE_EFFECTS =
      ThreadLocal.withInitial(() -> false);
  public static final String GLOSSARY = "glossary";
  public static final String GLOSSARY_TERM = "glossaryTerm";
  public static final String SNAPSHOT_UPSERT_EVENT = "PUBLISHED_SNAPSHOT_UPSERT";
  static final String SNAPSHOT_ARCHIVE_EVENT = "PUBLISHED_SNAPSHOT_ARCHIVE";

  public WorkingVersionRecord createWorking(
      String entityType,
      UUID entityId,
      UUID glossaryId,
      String businessVersion,
      Double nativeVersion,
      Object explicitPayload,
      String actor) {
    return createWorking(
        entityType,
        entityId,
        glossaryId,
        null,
        businessVersion,
        nativeVersion,
        explicitPayload,
        actor,
        false,
        null,
        false);
  }

  public WorkingVersionRecord createNextTermWorking(
      UUID entityId,
      UUID glossaryId,
      String businessVersion,
      String parentBusinessVersion,
      Double nativeVersion,
      Object identityPayload,
      String actor,
      Consumer<PublishedSnapshotRecord> authorization) {
    return createWorking(
        GLOSSARY_TERM,
        entityId,
        glossaryId,
        requireParentScope(parentBusinessVersion),
        businessVersion,
        nativeVersion,
        identityPayload,
        actor,
        true,
        authorization,
        false);
  }

  /** Creates the next scoped Technical Dictionary minor from its immutable Approved payload. */
  public WorkingVersionRecord createNextTermWorkingFromPublished(
      UUID entityId,
      UUID glossaryId,
      String businessVersion,
      String parentBusinessVersion,
      Double nativeVersion,
      Object identityPayload,
      String actor,
      Consumer<PublishedSnapshotRecord> authorization) {
    return createWorking(
        GLOSSARY_TERM,
        entityId,
        glossaryId,
        requireParentScope(parentBusinessVersion),
        businessVersion,
        nativeVersion,
        identityPayload,
        actor,
        true,
        authorization,
        true);
  }

  private WorkingVersionRecord createWorking(
      String entityType,
      UUID entityId,
      UUID glossaryId,
      String parentBusinessVersion,
      String businessVersion,
      Double nativeVersion,
      Object explicitPayload,
      String actor,
      boolean requirePublished) {
    return createWorking(
        entityType,
        entityId,
        glossaryId,
        parentBusinessVersion,
        businessVersion,
        nativeVersion,
        explicitPayload,
        actor,
        requirePublished,
        null,
        false);
  }

  private WorkingVersionRecord createWorking(
      String entityType,
      UUID entityId,
      UUID glossaryId,
      String parentBusinessVersion,
      String businessVersion,
      Double nativeVersion,
      Object explicitPayload,
      String actor,
      boolean requirePublished,
      Consumer<PublishedSnapshotRecord> authorization,
      boolean copyPublishedPayload) {
    requireEntityType(entityType);
    String canonicalVersion = requireBusinessVersion(entityType, businessVersion);
    if (GLOSSARY_TERM.equals(entityType)) {
      try {
        GlossaryBusinessVersion.requireCdeInScope(canonicalVersion, parentBusinessVersion);
      } catch (IllegalArgumentException exception) {
        throw new BadRequestException(exception.getMessage());
      }
    }
    WorkingVersionRecord result;
    try {
      result =
          Entity.getJdbi()
              .inTransaction(
                  handle -> {
                    GlossaryVersionDAO dao = handle.attach(GlossaryVersionDAO.class);
                    PublishedSnapshotRecord latest =
                        GLOSSARY_TERM.equals(entityType)
                            ? dao.lockLatestPublishedByParent(
                                entityType, entityId, parentBusinessVersion)
                            : dao.lockLatestPublished(entityType, entityId);
                    if (requirePublished && latest == null) {
                      throw conflict(
                          "An Approved version is required before creating a new version");
                    }
                    if (authorization != null) {
                      authorization.accept(latest);
                    }
                    if (dao.lockWorking(entityType, entityId, parentBusinessVersion) != null) {
                      throw conflict("A working version already exists");
                    }
                    if (dao.findPublishedVersion(entityType, entityId, canonicalVersion) != null) {
                      throw conflict("businessVersion has already been published");
                    }
                    if (latest != null
                        && GLOSSARY.equals(entityType)
                        && !new BigInteger(canonicalVersion)
                            .equals(new BigInteger(latest.businessVersion()).add(BigInteger.ONE))) {
                      throw conflict("Data Dictionary businessVersion must be exactly N+1");
                    }
                    if (latest != null
                        && GLOSSARY_TERM.equals(entityType)
                        && GlossaryBusinessVersion.compare(
                                canonicalVersion, latest.businessVersion())
                            <= 0) {
                      throw conflict(
                          "businessVersion must be greater than the latest published version");
                    }
                    // The first business version starts from the newly-created identity payload.
                    // Every later business version starts as a blank draft and retains only the
                    // stable identity fields required to address the same Glossary/GlossaryTerm.
                    Object payload =
                        latest == null
                            ? explicitPayload
                            : copyPublishedPayload
                                ? latest.payload()
                                : emptyWorkingPayload(entityType, explicitPayload, latest);
                    if (payload == null) {
                      throw new BadRequestException(
                          "payload is required when no published snapshot exists");
                    }
                    if (GLOSSARY.equals(entityType)) {
                      payload = withEmptyTermRevisions(payload);
                    }
                    payload =
                        normalizeWorkingPayload(
                            payload, canonicalVersion, EntityStatus.DRAFT.value());
                    if (GLOSSARY_TERM.equals(entityType)) {
                      payload = CdeReleaseVersionType.apply(payload, canonicalVersion);
                      payload = withParentBusinessVersion(payload, parentBusinessVersion);
                    }
                    long now = System.currentTimeMillis();
                    dao.insertWorking(
                        UUID.randomUUID(),
                        entityType,
                        entityId,
                        glossaryId,
                        parentBusinessVersion,
                        canonicalVersion,
                        EntityStatus.DRAFT.value(),
                        nativeVersion,
                        JsonUtils.pojoToJson(payload),
                        now,
                        actor);
                    return dao.findWorking(entityType, entityId, parentBusinessVersion);
                  });
    } catch (UnableToExecuteStatementException exception) {
      if (isConstraintConflict(exception)) {
        throw conflict("A working version was created concurrently");
      }
      throw exception;
    }
    refreshIndexes(entityType, entityId, result.payload());
    return result;
  }

  public WorkingVersionRecord saveWorking(
      String entityType,
      UUID entityId,
      long expectedRevision,
      Double nativeVersion,
      Object payload,
      String actor) {
    return saveWorking(entityType, entityId, null, expectedRevision, nativeVersion, payload, actor);
  }

  public WorkingVersionRecord saveWorking(
      String entityType,
      UUID entityId,
      String parentBusinessVersion,
      long expectedRevision,
      Double nativeVersion,
      Object payload,
      String actor) {
    if (payload == null) {
      throw new BadRequestException("payload is required");
    }
    WorkingVersionRecord result =
        Entity.getJdbi()
            .inTransaction(
                handle -> {
                  GlossaryVersionDAO dao = handle.attach(GlossaryVersionDAO.class);
                  WorkingVersionRecord working =
                      requireWorking(dao, entityType, entityId, parentBusinessVersion);
                  if (!EntityStatus.DRAFT.value().equals(working.entityStatus())) {
                    throw new BadRequestException("Only Draft working versions can be edited");
                  }
                  long now = System.currentTimeMillis();
                  int updated =
                      dao.updateWorking(
                          entityType,
                          entityId,
                          parentBusinessVersion,
                          expectedRevision,
                          working.entityStatus(),
                          nativeVersion,
                          JsonUtils.pojoToJson(
                              withAudit(
                                  GLOSSARY_TERM.equals(entityType)
                                      ? CdeReleaseVersionType.apply(
                                          normalizeWorkingPayload(
                                              payload,
                                              working.businessVersion(),
                                              working.entityStatus()),
                                          working.businessVersion())
                                      : normalizeWorkingPayload(
                                          payload,
                                          working.businessVersion(),
                                          working.entityStatus()),
                                  actor,
                                  now)),
                          now,
                          actor);
                  requireUpdated(updated);
                  return dao.findWorking(entityType, entityId, parentBusinessVersion);
                });
    refreshIndexes(entityType, entityId, result.payload());
    return result;
  }

  public WorkingVersionRecord transition(
      String entityType,
      UUID entityId,
      long expectedRevision,
      EntityStatus expectedStatus,
      EntityStatus targetStatus,
      String actor) {
    return transition(
        entityType,
        entityId,
        null,
        expectedRevision,
        expectedStatus,
        targetStatus,
        actor,
        null,
        false);
  }

  public WorkingVersionRecord transition(
      String entityType,
      UUID entityId,
      long expectedRevision,
      EntityStatus expectedStatus,
      EntityStatus targetStatus,
      String actor,
      Consumer<WorkingVersionRecord> authorizationAndValidation) {
    return transition(
        entityType,
        entityId,
        null,
        expectedRevision,
        expectedStatus,
        targetStatus,
        actor,
        authorizationAndValidation);
  }

  public WorkingVersionRecord transition(
      String entityType,
      UUID entityId,
      String parentBusinessVersion,
      long expectedRevision,
      EntityStatus expectedStatus,
      EntityStatus targetStatus,
      String actor,
      Consumer<WorkingVersionRecord> authorizationAndValidation) {
    return transition(
        entityType,
        entityId,
        parentBusinessVersion,
        expectedRevision,
        expectedStatus,
        targetStatus,
        actor,
        authorizationAndValidation,
        true);
  }

  private WorkingVersionRecord transition(
      String entityType,
      UUID entityId,
      String parentBusinessVersion,
      long expectedRevision,
      EntityStatus expectedStatus,
      EntityStatus targetStatus,
      String actor,
      Consumer<WorkingVersionRecord> authorizationAndValidation,
      boolean invalidStateIsConflict) {
    WorkingVersionRecord result =
        Entity.getJdbi()
            .inTransaction(
                handle -> {
                  GlossaryVersionDAO dao = handle.attach(GlossaryVersionDAO.class);
                  WorkingVersionRecord working =
                      requireWorking(dao, entityType, entityId, parentBusinessVersion);
                  if (authorizationAndValidation != null) {
                    authorizationAndValidation.accept(working);
                  }
                  if (working.revision() != expectedRevision) {
                    throw conflict("Working version revision conflict");
                  }
                  if (!expectedStatus.value().equals(working.entityStatus())) {
                    String message =
                        "Invalid working transition "
                            + working.entityStatus()
                            + " -> "
                            + targetStatus;
                    if (invalidStateIsConflict) {
                      throw conflict(message);
                    }
                    throw new BadRequestException(message);
                  }
                  int updated =
                      dao.transitionWorking(
                          entityType,
                          entityId,
                          parentBusinessVersion,
                          expectedRevision,
                          expectedStatus.value(),
                          targetStatus.value(),
                          EntityStatus.IN_REVIEW.value(),
                          EntityStatus.REJECTED.value(),
                          System.currentTimeMillis(),
                          actor);
                  requireUpdated(updated);
                  return dao.findWorking(entityType, entityId, parentBusinessVersion);
                });
    refreshIndexes(entityType, entityId, result.payload());
    return result;
  }

  /**
   * Withdraws an In Review working version on behalf of the user who submitted it. A deletion
   * request is removed (null is returned), because a Draft deletion would still be approvable; any
   * other request returns to Draft with its content kept.
   */
  public WorkingVersionRecord withdraw(
      String entityType,
      UUID entityId,
      String parentBusinessVersion,
      long expectedRevision,
      String actor) {
    final WorkingVersionRecord result =
        Entity.getJdbi()
            .inTransaction(
                handle -> {
                  GlossaryVersionDAO dao = handle.attach(GlossaryVersionDAO.class);
                  WorkingVersionRecord working =
                      requireWorking(dao, entityType, entityId, parentBusinessVersion);
                  requireSubmitter(working, actor);
                  if (working.revision() != expectedRevision) {
                    throw conflict("Working version revision conflict");
                  }
                  if (!EntityStatus.IN_REVIEW.value().equals(working.entityStatus())) {
                    throw conflict(
                        "Invalid working transition " + working.entityStatus() + " -> withdrawn");
                  }
                  if (GlossaryTermDeletion.isRequested(working)) {
                    requireUpdated(
                        dao.deleteWorking(
                            entityType, entityId, parentBusinessVersion, expectedRevision));
                    return null;
                  }
                  requireUpdated(
                      dao.transitionWorking(
                          entityType,
                          entityId,
                          parentBusinessVersion,
                          expectedRevision,
                          EntityStatus.IN_REVIEW.value(),
                          EntityStatus.DRAFT.value(),
                          EntityStatus.IN_REVIEW.value(),
                          EntityStatus.REJECTED.value(),
                          System.currentTimeMillis(),
                          actor));
                  return dao.findWorking(entityType, entityId, parentBusinessVersion);
                });
    refreshIndexes(entityType, entityId, result == null ? null : result.payload());
    return result;
  }

  private static void requireSubmitter(WorkingVersionRecord working, String actor) {
    if (actor == null || !actor.equals(working.submittedBy())) {
      throw new WebApplicationException(
          "Only the user who submitted the request can withdraw it",
          Response.status(Response.Status.FORBIDDEN)
              .entity(Map.of("code", "NOT_SUBMITTER"))
              .build());
    }
  }

  public PublishedSnapshotRecord publish(
      String entityType, UUID entityId, long expectedRevision, String actor) {
    return publish(entityType, entityId, expectedRevision, actor, null);
  }

  public PublishedSnapshotRecord publish(
      String entityType,
      UUID entityId,
      long expectedRevision,
      String actor,
      Consumer<WorkingVersionRecord> authorizationAndValidation) {
    return publish(
        entityType, entityId, null, expectedRevision, actor, authorizationAndValidation, null);
  }

  public PublishedSnapshotRecord publish(
      String entityType,
      UUID entityId,
      String parentBusinessVersion,
      long expectedRevision,
      String actor,
      Consumer<WorkingVersionRecord> authorizationAndValidation) {
    return publish(
        entityType,
        entityId,
        parentBusinessVersion,
        expectedRevision,
        actor,
        authorizationAndValidation,
        null);
  }

  public PublishedSnapshotRecord publish(
      String entityType,
      UUID entityId,
      String parentBusinessVersion,
      long expectedRevision,
      String actor,
      Consumer<WorkingVersionRecord> authorizationAndValidation,
      PublicationHook publicationHook) {
    requireEntityType(entityType);
    PublishedSnapshotRecord published;
    List<PublishedSnapshotRecord> termsPublishedWithGlossary = new ArrayList<>();
    try {
      published =
          Entity.getJdbi()
              .inTransaction(
                  handle -> {
                    GlossaryVersionDAO dao = handle.attach(GlossaryVersionDAO.class);
                    lockPublicationScope(dao, entityType, entityId, parentBusinessVersion);
                    WorkingVersionRecord working =
                        requireWorking(dao, entityType, entityId, parentBusinessVersion);
                    if (working.revision() != expectedRevision) {
                      throw conflict("Working version revision conflict");
                    }
                    if (!EntityStatus.IN_REVIEW.value().equals(working.entityStatus())) {
                      throw conflict("Only an In Review working version can be approved");
                    }
                    if (authorizationAndValidation != null) {
                      authorizationAndValidation.accept(working);
                    }
                    if (GlossaryTermDeletion.isRequested(working)) {
                      return GlossaryTermDeletion.apply(handle, dao, working, actor);
                    }
                    PublishedSnapshotRecord corrected =
                        dao.lockPublishedVersion(entityType, entityId, working.businessVersion());
                    if (corrected != null) {
                      return publishCorrection(
                          handle, dao, working, corrected, actor, publicationHook);
                    }

                    PublishedSnapshotRecord predecessor = null;
                    if (GLOSSARY.equals(entityType)) {
                      predecessor = dao.lockLatestPublished(entityType, entityId);
                      if (predecessor != null
                          && !new BigInteger(working.businessVersion())
                              .equals(
                                  new BigInteger(predecessor.businessVersion())
                                      .add(BigInteger.ONE))) {
                        throw conflict("Data Dictionary businessVersion must be exactly N+1");
                      }
                    }

                    UUID snapshotId = UUID.randomUUID();
                    long sequence = dao.nextPublicationSequence(entityType, entityId);
                    long now = System.currentTimeMillis();
                    Object publicationPayload = working.payload();
                    List<TermRevision> termRevisions = List.of();
                    if (GLOSSARY.equals(entityType)) {
                      termsPublishedWithGlossary.addAll(
                          publishWorkingTerms(
                              handle, dao, entityId, working.businessVersion(), actor));
                      termRevisions =
                          buildActiveTermRevisions(dao, entityId, working.businessVersion());
                      publicationPayload = withTermRevisions(working.payload(), termRevisions);
                    } else if (GLOSSARY_TERM.equals(entityType)) {
                      PublishedSnapshotRecord latestTerm =
                          dao.findLatestPublished(entityType, entityId);
                      publicationPayload =
                          restoreMissingTermRelations(working.payload(), latestTerm);
                    }
                    String approvedPayload =
                        withPublishedMetadata(
                            publicationPayload, working, snapshotId, sequence, now, actor);
                    String contentHash = sha256(approvedPayload);
                    dao.insertSnapshot(
                        snapshotId,
                        entityType,
                        entityId,
                        working.glossaryId(),
                        working.parentBusinessVersion(),
                        working.businessVersion(),
                        working.nativeVersion(),
                        sequence,
                        approvedPayload,
                        contentHash,
                        now,
                        actor);
                    if (GLOSSARY.equals(entityType)) {
                      insertGlossaryTermRevisions(dao, snapshotId, termRevisions);
                      if (predecessor != null) {
                        cutOverPredecessor(dao, predecessor, entityId, now, actor);
                      }
                      TechnicalCutover.onGlossaryPublished(
                          handle,
                          entityId,
                          predecessor == null ? null : predecessor.businessVersion(),
                          working.businessVersion(),
                          actor);
                      advanceDataQualityCatalog(
                          dao, entityId, working.businessVersion(), now, actor);
                    }
                    dao.upsertPublishedHead(
                        entityType,
                        entityId,
                        working.parentBusinessVersion(),
                        snapshotId,
                        sequence);
                    dao.insertOutbox(
                        UUID.randomUUID(),
                        snapshotId,
                        "PUBLISHED_SNAPSHOT_UPSERT",
                        approvedPayload,
                        now);
                    PublishedSnapshotRecord result =
                        new PublishedSnapshotRecord(
                            snapshotId,
                            entityType,
                            entityId,
                            working.glossaryId(),
                            working.parentBusinessVersion(),
                            working.businessVersion(),
                            working.nativeVersion(),
                            sequence,
                            approvedPayload,
                            contentHash,
                            now,
                            actor,
                            null,
                            null);
                    if (publicationHook != null) {
                      publicationHook.onPublished(handle, working, result);
                    }
                    DqTestOutbox.onPublished(handle, result);
                    requireUpdated(
                        dao.deleteWorking(
                            entityType, entityId, parentBusinessVersion, expectedRevision));
                    return result;
                  });
    } catch (UnableToExecuteStatementException exception) {
      if (isConstraintConflict(exception)) {
        throw conflict("The working version was published concurrently");
      }
      throw exception;
    }
    if (!DEFER_SIDE_EFFECTS.get()) {
      if (termsPublishedWithGlossary.isEmpty()) {
        processPendingOutbox();
      } else {
        flushSideEffects(
            GLOSSARY_TERM,
            termsPublishedWithGlossary.stream().map(PublishedSnapshotRecord::entityId).toList());
      }
    }
    refreshIndexes(entityType, entityId, published.payload());
    if (GLOSSARY.equals(entityType)) {
      TechnicalOutbox.drainAsync();
    }
    DqTestOutbox.drainAsync();
    return published;
  }

  /**
   * Publishes every working record in the glossary version as part of catalog approval.
   *
   * <p>The caller already holds the glossary identity lock, so term snapshots, their published
   * heads, and the catalog manifest are committed atomically in the surrounding transaction.
   * Record workflow status is intentionally not checked: approving the catalog is the authoritative
   * approval for every record contained in that version.
   */
  static List<PublishedSnapshotRecord> publishWorkingTerms(
      Handle handle,
      GlossaryVersionDAO dao,
      UUID glossaryId,
      String parentBusinessVersion,
      String actor) {
    List<WorkingVersionRecord> workingTerms =
        dao.listWorkingByGlossaryAndParent(
            GLOSSARY_TERM, glossaryId, requireParentScope(parentBusinessVersion));
    List<PublishedSnapshotRecord> publishedTerms = new ArrayList<>(workingTerms.size());
    for (WorkingVersionRecord working : workingTerms) {
      if (GlossaryTermDeletion.isRequested(working)) {
        GlossaryTermDeletion.apply(handle, dao, working, actor);
        continue;
      }
      PublishedSnapshotRecord corrected =
          dao.lockPublishedVersion(GLOSSARY_TERM, working.entityId(), working.businessVersion());
      if (corrected != null) {
        publishedTerms.add(GlossaryVersionCorrection.apply(dao, working, corrected, actor));
        requireUpdated(
            dao.deleteWorking(
                GLOSSARY_TERM, working.entityId(), parentBusinessVersion, working.revision()));
        continue;
      }

      UUID snapshotId = UUID.randomUUID();
      long sequence = dao.nextPublicationSequence(GLOSSARY_TERM, working.entityId());
      long now = System.currentTimeMillis();
      PublishedSnapshotRecord latestTerm =
          dao.findLatestPublishedByParent(GLOSSARY_TERM, working.entityId(), parentBusinessVersion);
      Object publicationPayload = restoreMissingTermRelations(working.payload(), latestTerm);
      String approvedPayload =
          withPublishedMetadata(publicationPayload, working, snapshotId, sequence, now, actor);
      String contentHash = sha256(approvedPayload);

      dao.insertSnapshot(
          snapshotId,
          GLOSSARY_TERM,
          working.entityId(),
          glossaryId,
          parentBusinessVersion,
          working.businessVersion(),
          working.nativeVersion(),
          sequence,
          approvedPayload,
          contentHash,
          now,
          actor);
      dao.upsertPublishedHead(
          GLOSSARY_TERM, working.entityId(), parentBusinessVersion, snapshotId, sequence);
      dao.insertOutbox(UUID.randomUUID(), snapshotId, SNAPSHOT_UPSERT_EVENT, approvedPayload, now);
      requireUpdated(
          dao.deleteWorking(
              GLOSSARY_TERM, working.entityId(), parentBusinessVersion, working.revision()));
      publishedTerms.add(
          new PublishedSnapshotRecord(
              snapshotId,
              GLOSSARY_TERM,
              working.entityId(),
              glossaryId,
              parentBusinessVersion,
              working.businessVersion(),
              working.nativeVersion(),
              sequence,
              approvedPayload,
              contentHash,
              now,
              actor,
              null,
              null));
    }
    return publishedTerms;
  }

  private static PublishedSnapshotRecord publishCorrection(
      Handle handle,
      GlossaryVersionDAO dao,
      WorkingVersionRecord working,
      PublishedSnapshotRecord corrected,
      String actor,
      PublicationHook publicationHook) {
    final PublishedSnapshotRecord result =
        GlossaryVersionCorrection.apply(dao, working, corrected, actor);
    if (publicationHook != null) {
      publicationHook.onPublished(handle, working, result);
    }
    DqTestOutbox.onPublished(handle, result);
    requireUpdated(
        dao.deleteWorking(
            working.entityType(),
            working.entityId(),
            working.parentBusinessVersion(),
            working.revision()));
    return result;
  }

  /**
   * Opens a Draft that corrects an existing Approved glossary term version in place. The Draft
   * starts from the content of that version and keeps its businessVersion.
   */
  public WorkingVersionRecord createCorrectionWorking(
      UUID entityId,
      String businessVersion,
      String parentBusinessVersion,
      String actor,
      Consumer<PublishedSnapshotRecord> authorization) {
    final GlossaryVersionCorrection.CorrectionRequest request =
        new GlossaryVersionCorrection.CorrectionRequest(
            entityId, businessVersion, parentBusinessVersion, actor, authorization);
    final WorkingVersionRecord result;
    try {
      result =
          Entity.getJdbi()
              .inTransaction(
                  handle ->
                      GlossaryVersionCorrection.createWorking(
                          handle.attach(GlossaryVersionDAO.class), request));
    } catch (UnableToExecuteStatementException exception) {
      if (isConstraintConflict(exception)) {
        throw conflict("A working version was created concurrently");
      }
      throw exception;
    }
    refreshIndexes(GLOSSARY_TERM, entityId, result.payload());
    return result;
  }

  /**
   * Opens a Draft that proposes deleting an Approved CDE. The CDE stays effective until the Draft
   * is approved; see {@link GlossaryTermDeletion}.
   */
  public WorkingVersionRecord createDeletionWorking(
      UUID entityId,
      String parentBusinessVersion,
      String actor,
      Consumer<PublishedSnapshotRecord> authorization) {
    final GlossaryTermDeletion.DeletionRequest request =
        new GlossaryTermDeletion.DeletionRequest(
            entityId, parentBusinessVersion, actor, authorization);
    final WorkingVersionRecord result;
    try {
      result =
          Entity.getJdbi()
              .inTransaction(
                  handle ->
                      GlossaryTermDeletion.createWorking(
                          handle.attach(GlossaryVersionDAO.class), request));
    } catch (UnableToExecuteStatementException exception) {
      if (isConstraintConflict(exception)) {
        throw conflict("A working version was created concurrently");
      }
      throw exception;
    }
    refreshIndexes(GLOSSARY_TERM, entityId, result.payload());
    return result;
  }

  public static boolean isDeletionRequest(WorkingVersionRecord working) {
    return GlossaryTermDeletion.isRequested(working);
  }

  public List<SnapshotHistoryRecord> listCorrectionHistory(
      String entityType, UUID entityId, String businessVersion) {
    return Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .listSnapshotHistory(
            entityType, entityId, requireBusinessVersion(entityType, businessVersion));
  }

  @FunctionalInterface
  public interface PublicationHook {
    void onPublished(
        Handle handle, WorkingVersionRecord working, PublishedSnapshotRecord published);
  }

  public WorkingVersionRecord getWorking(String entityType, UUID entityId) {
    return getWorking(entityType, entityId, null);
  }

  public WorkingVersionRecord getWorking(
      String entityType, UUID entityId, String parentBusinessVersion) {
    WorkingVersionRecord record =
        Entity.getJdbi()
            .onDemand(GlossaryVersionDAO.class)
            .findWorking(entityType, entityId, parentBusinessVersion);
    if (record == null) {
      throw new NotFoundException("No working version exists");
    }
    return record;
  }

  public PublishedSnapshotRecord getLatestPublished(String entityType, UUID entityId) {
    PublishedSnapshotRecord record =
        Entity.getJdbi()
            .onDemand(GlossaryVersionDAO.class)
            .findLatestPublished(entityType, entityId);
    if (record == null) {
      throw new NotFoundException("No published snapshot exists");
    }
    return record;
  }

  /**
   * Returns the newest Approved representation inside one governed glossary scope. Active
   * snapshots take precedence over revoked ones. If the whole parent scope has been frozen, the
   * newest archived snapshot remains its latest Approved representation.
   */
  public PublishedSnapshotRecord getLatestPublishedInScope(
      String entityType, UUID entityId, String parentBusinessVersion) {
    String requiredScope = requireParentScope(parentBusinessVersion);
    return selectLatestPublishedInScope(
        Entity.getJdbi().onDemand(GlossaryVersionDAO.class).listPublished(entityType, entityId),
        requiredScope);
  }

  static PublishedSnapshotRecord selectLatestPublishedInScope(
      List<PublishedSnapshotRecord> published, String requiredScope) {
    List<PublishedSnapshotRecord> scoped =
        published.stream()
            .filter(record -> requiredScope.equals(record.parentBusinessVersion()))
            .toList();
    if (scoped.isEmpty()) {
      throw new NotFoundException("No Approved version exists in scope " + requiredScope);
    }
    List<PublishedSnapshotRecord> active =
        scoped.stream().filter(record -> record.archivedAt() == null).toList();
    return (active.isEmpty() ? scoped : active)
        .stream()
            .max(
                Comparator.comparing(
                    PublishedSnapshotRecord::businessVersion, GlossaryBusinessVersion::compare))
            .orElseThrow();
  }

  public PublishedSnapshotRecord getPublished(
      String entityType, UUID entityId, String businessVersion) {
    PublishedSnapshotRecord record =
        Entity.getJdbi()
            .onDemand(GlossaryVersionDAO.class)
            .findPublishedVersion(
                entityType, entityId, requireBusinessVersion(entityType, businessVersion));
    if (record == null) {
      throw new NotFoundException("Published business version not found");
    }
    return record;
  }

  public List<PublishedSnapshotRecord> listPublished(String entityType, UUID entityId) {
    return Entity.getJdbi().onDemand(GlossaryVersionDAO.class).listPublished(entityType, entityId);
  }

  public void assertDeletable(String entityType, UUID entityId) {
    requireEntityType(entityType);
    GlossaryVersionDAO dao = Entity.getJdbi().onDemand(GlossaryVersionDAO.class);
    if (!dao.listPublished(entityType, entityId).isEmpty()) {
      throw new BadRequestException(
          "Published glossary content cannot be deleted; archive the published snapshot instead");
    }
    WorkingVersionRecord working = dao.findWorking(entityType, entityId);
    if (working != null
        && !EntityStatus.DRAFT.value().equals(working.entityStatus())
        && !EntityStatus.REJECTED.value().equals(working.entityStatus())) {
      throw new BadRequestException("Only Draft or Rejected working content can be deleted");
    }
  }

  /** Checks that a Draft or Rejected working version exists in the scope and can be discarded. */
  public WorkingVersionRecord requireDiscardableWorking(
      String entityType, UUID entityId, String parentBusinessVersion) {
    requireEntityType(entityType);
    final WorkingVersionRecord working = getWorking(entityType, entityId, parentBusinessVersion);
    if (!EntityStatus.DRAFT.value().equals(working.entityStatus())
        && !EntityStatus.REJECTED.value().equals(working.entityStatus())) {
      throw new BadRequestException("Only a Draft or Rejected working version can be discarded");
    }
    return working;
  }

  /** Deletes the working version only; the published versions of the entity stay untouched. */
  public void discardWorking(
      String entityType, UUID entityId, String parentBusinessVersion, long expectedRevision) {
    final GlossaryVersionDAO dao = Entity.getJdbi().onDemand(GlossaryVersionDAO.class);
    if (dao.deleteWorking(entityType, entityId, parentBusinessVersion, expectedRevision) == 0) {
      throw conflict("The working version was changed; reload it before discarding");
    }
    refreshIndexes(entityType, entityId, null);
  }

  /** Flushes snapshot outbox events idempotently; failures remain pending for a later request. */
  public void processPendingOutbox() {
    GlossaryVersionDAO dao = Entity.getJdbi().onDemand(GlossaryVersionDAO.class);
    Map<String, Set<UUID>> changedCdes = new LinkedHashMap<>();
    for (SnapshotOutboxRecord event : dao.listPendingOutbox(OUTBOX_BATCH_SIZE)) {
      try {
        PublishedSnapshotRecord changed = dao.findSnapshot(event.snapshotId());
        if (changed == null) {
          throw new IllegalStateException("Snapshot not found for outbox event " + event.eventId());
        }
        refreshPublishedIndex(dao, changed.entityType(), changed.entityId());
        collectApprovedCde(event, changed, changedCdes);
        dao.markOutboxProcessed(event.eventId(), System.currentTimeMillis());
      } catch (Exception exception) {
        String message =
            exception.getMessage() == null
                ? exception.getClass().getSimpleName()
                : exception.getMessage();
        dao.markOutboxFailed(event.eventId(), message);
        LOG.warn("Failed to process glossary snapshot outbox event {}", event.eventId(), exception);
      }
    }
    TechnicalOutbox.onCdesApproved(changedCdes);
  }

  /** A newly Approved Data Dictionary CDE changes the CDE data stored in Technical documents. */
  private static void collectApprovedCde(
      SnapshotOutboxRecord event,
      PublishedSnapshotRecord changed,
      Map<String, Set<UUID>> changedCdes) {
    if (SNAPSHOT_UPSERT_EVENT.equals(event.eventType())
        && TechnicalOutbox.isDataDictionaryTerm(changed)) {
      changedCdes
          .computeIfAbsent(changed.parentBusinessVersion(), scope -> new HashSet<>())
          .add(changed.entityId());
    }
  }

  private static void refreshPublishedIndex(
      GlossaryVersionDAO dao, String entityType, UUID entityId) throws java.io.IOException {
    SearchRepository searchRepository = Entity.getSearchRepository();
    String indexAlias = GLOSSARY.equals(entityType) ? "glossaryPublished" : "glossaryTermPublished";
    String indexName = searchRepository.getIndexOrAliasName(indexAlias);
    PublishedSnapshotRecord latest = dao.findLatestPublished(entityType, entityId);
    if (latest == null) {
      searchRepository.getSearchClient().deleteEntity(indexName, entityId.toString());
      return;
    }
    Map<String, Object> document =
        JsonUtils.readValue(
            latest.payload(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
    document.put("entityType", entityType);
    searchRepository
        .getSearchClient()
        .createEntity(indexName, entityId.toString(), JsonUtils.pojoToJson(document));
  }

  /**
   * Runs a batch of mutations without per-record outbox processing or search refresh; the caller
   * must invoke {@link #flushSideEffects} once afterwards.
   */
  public static void runWithDeferredSideEffects(Runnable batch) {
    final boolean previous = DEFER_SIDE_EFFECTS.get();
    DEFER_SIDE_EFFECTS.set(true);
    try {
      batch.run();
    } finally {
      DEFER_SIDE_EFFECTS.set(previous);
    }
  }

  /** Drains the snapshot outbox and refreshes the manager index of the given entities. */
  public void flushSideEffects(String entityType, java.util.Collection<UUID> entityIds) {
    final GlossaryVersionDAO dao = Entity.getJdbi().onDemand(GlossaryVersionDAO.class);
    for (int round = 0; round < MAX_FLUSH_ROUNDS && !dao.listPendingOutbox(1).isEmpty(); round++) {
      processPendingOutbox();
    }
    entityIds.forEach(entityId -> refreshManagerIndexSafely(entityType, entityId));
  }

  /**
   * Refreshes the search documents of one written entity. Technical Dictionary records are written
   * only to their own index (TDX-11); every other profile keeps the manager index refresh.
   */
  private void refreshIndexes(String entityType, UUID entityId, String payload) {
    refreshManagerIndexSafely(entityType, entityId);
  }

  private void refreshManagerIndexSafely(String entityType, UUID entityId) {
    if (DEFER_SIDE_EFFECTS.get()) {
      return;
    }
    try {
      GlossaryVersionDAO dao = Entity.getJdbi().onDemand(GlossaryVersionDAO.class);
      SearchRepository searchRepository = Entity.getSearchRepository();
      String indexAlias = GLOSSARY.equals(entityType) ? GLOSSARY : GLOSSARY_TERM;
      String indexName = searchRepository.getIndexOrAliasName(indexAlias);
      WorkingVersionRecord working = dao.findWorking(entityType, entityId);
      Map<String, Object> document;
      if (working != null) {
        document =
            JsonUtils.readValue(
                working.payload(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
        document.put("businessVersion", working.businessVersion());
        document.put("workingRevision", working.revision());
        document.put("entityStatus", working.entityStatus());
      } else {
        PublishedSnapshotRecord published = dao.findLatestPublished(entityType, entityId);
        if (published == null) {
          searchRepository.getSearchClient().deleteEntity(indexName, entityId.toString());
          return;
        }
        document =
            JsonUtils.readValue(
                published.payload(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
      }
      document.put("entityType", entityType);
      searchRepository
          .getSearchClient()
          .createEntity(indexName, entityId.toString(), JsonUtils.pojoToJson(document));
    } catch (Exception exception) {
      LOG.warn(
          "Failed to refresh manager glossary index for {} {}", entityType, entityId, exception);
    }
  }

  public Map<UUID, PublishedSnapshotRecord> getLatestPublishedBatch(
      String entityType, List<UUID> entityIds) {
    if (entityIds == null || entityIds.isEmpty()) {
      return Map.of();
    }
    return Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .findLatestPublishedBatch(entityType, entityIds.stream().map(UUID::toString).toList())
        .stream()
        .collect(Collectors.toMap(PublishedSnapshotRecord::entityId, Function.identity()));
  }

  public Map<UUID, PublishedSnapshotRecord> getLatestPublishedBatch(
      String entityType, List<UUID> entityIds, String parentBusinessVersion) {
    if (entityIds == null || entityIds.isEmpty()) {
      return Map.of();
    }
    return Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .findLatestPublishedBatchByParent(
            entityType, entityIds.stream().map(UUID::toString).toList(), parentBusinessVersion)
        .stream()
        .collect(Collectors.toMap(PublishedSnapshotRecord::entityId, Function.identity()));
  }

  public Map<UUID, WorkingVersionRecord> getWorkingBatch(String entityType, List<UUID> entityIds) {
    if (entityIds == null || entityIds.isEmpty()) {
      return Map.of();
    }
    return Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .findWorkingBatch(entityType, entityIds.stream().map(UUID::toString).toList())
        .stream()
        .collect(Collectors.toMap(WorkingVersionRecord::entityId, Function.identity()));
  }

  public Map<UUID, WorkingVersionRecord> getWorkingBatch(
      String entityType, List<UUID> entityIds, String parentBusinessVersion) {
    if (entityIds == null || entityIds.isEmpty()) {
      return Map.of();
    }
    return Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .findWorkingBatchByParent(
            entityType, entityIds.stream().map(UUID::toString).toList(), parentBusinessVersion)
        .stream()
        .collect(Collectors.toMap(WorkingVersionRecord::entityId, Function.identity()));
  }

  public List<PublishedSnapshotRecord> listPublishedGlossaryTerms(
      UUID glossaryId, String businessVersion) {
    PublishedSnapshotRecord glossary = getPublished(GLOSSARY, glossaryId, businessVersion);
    if (glossary.archivedAt() == null && isLatestPublished(GLOSSARY, glossaryId, businessVersion)) {
      return sortTermSnapshotsByName(
          Entity.getJdbi()
              .onDemand(GlossaryVersionDAO.class)
              .listActiveLatestTermsForGlossaryAndParent(glossaryId, businessVersion));
    }
    return sortTermSnapshotsByName(
        Entity.getJdbi()
            .onDemand(GlossaryVersionDAO.class)
            .listSnapshotTerms(glossary.snapshotId()));
  }

  public List<WorkingVersionRecord> listWorkingTermsByGlossary(UUID glossaryId) {
    return Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .listWorkingByGlossary(GLOSSARY_TERM, glossaryId);
  }

  public List<WorkingVersionRecord> listWorkingTermsByGlossary(
      UUID glossaryId, String parentBusinessVersion) {
    return Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .listWorkingByGlossaryAndParent(
            GLOSSARY_TERM, glossaryId, requireParentScope(parentBusinessVersion));
  }

  public boolean isLatestPublished(String entityType, UUID entityId, String businessVersion) {
    return businessVersion.equals(getLatestPublished(entityType, entityId).businessVersion());
  }

  /** Repairs the pre-cutover state produced before Data Dictionary scope isolation was enforced. */
  public static boolean repairDataDictionaryCutover(
      GlossaryVersionDAO dao, UUID glossaryId, String actor) {
    PublishedSnapshotRecord active = dao.lockLatestPublished(GLOSSARY, glossaryId);
    if (active == null) {
      return false;
    }

    List<PublishedSnapshotRecord> snapshots = dao.listPublished(GLOSSARY, glossaryId);
    List<PublishedSnapshotRecord> unarchivedPredecessors =
        snapshots.stream()
            .filter(snapshot -> !snapshot.snapshotId().equals(active.snapshotId()))
            .filter(snapshot -> snapshot.archivedAt() == null)
            .toList();
    List<PublishedSnapshotRecord> archivedPredecessorsWithMissingManifest =
        snapshots.stream()
            .filter(snapshot -> !snapshot.snapshotId().equals(active.snapshotId()))
            .filter(snapshot -> snapshot.archivedAt() != null)
            .filter(snapshot -> dao.listSnapshotTerms(snapshot.snapshotId()).isEmpty())
            .filter(
                snapshot ->
                    !dao.listArchivedTermSnapshotsForGlossaryAndParent(
                            glossaryId, snapshot.businessVersion())
                        .isEmpty())
            .toList();
    if (unarchivedPredecessors.isEmpty() && archivedPredecessorsWithMissingManifest.isEmpty()) {
      return false;
    }

    List<TermRevision> desired =
        buildActiveTermRevisions(dao, glossaryId, active.businessVersion());
    long now = System.currentTimeMillis();
    for (PublishedSnapshotRecord predecessor : unarchivedPredecessors) {
      cutOverPredecessor(dao, predecessor, glossaryId, now, actor);
    }
    for (PublishedSnapshotRecord predecessor : archivedPredecessorsWithMissingManifest) {
      rebuildArchivedManifest(dao, predecessor, glossaryId, now);
    }

    dao.deleteSnapshotTerms(active.snapshotId());
    insertGlossaryTermRevisions(dao, active.snapshotId(), desired);
    String repairedPayload =
        JsonUtils.pojoToJson(canonicalize(withTermRevisions(active.payload(), desired)));
    requireUpdated(
        dao.updateSnapshotPayload(active.snapshotId(), repairedPayload, sha256(repairedPayload)));
    dao.insertOutbox(
        UUID.randomUUID(), active.snapshotId(), "PUBLISHED_SNAPSHOT_UPSERT", repairedPayload, now);
    return true;
  }

  private static void rebuildArchivedManifest(
      GlossaryVersionDAO dao, PublishedSnapshotRecord predecessor, UUID glossaryId, long now) {
    Map<UUID, PublishedSnapshotRecord> latestByTerm = new LinkedHashMap<>();
    for (PublishedSnapshotRecord term :
        dao.listArchivedTermSnapshotsForGlossaryAndParent(
            glossaryId, predecessor.businessVersion())) {
      latestByTerm.putIfAbsent(term.entityId(), term);
    }
    List<PublishedSnapshotRecord> archivedTerms =
        sortTermSnapshotsByName(new ArrayList<>(latestByTerm.values()));
    List<TermRevision> revisions = new ArrayList<>(archivedTerms.size());
    dao.deleteSnapshotTerms(predecessor.snapshotId());
    for (int index = 0; index < archivedTerms.size(); index++) {
      PublishedSnapshotRecord term = archivedTerms.get(index);
      dao.insertSnapshotTerm(predecessor.snapshotId(), term.snapshotId(), index);
      revisions.add(
          new TermRevision(term.entityId(), term.snapshotId(), term.businessVersion(), index));
    }
    String repairedPayload =
        JsonUtils.pojoToJson(canonicalize(withTermRevisions(predecessor.payload(), revisions)));
    requireUpdated(
        dao.updateSnapshotPayload(
            predecessor.snapshotId(), repairedPayload, sha256(repairedPayload)));
    dao.insertOutbox(
        UUID.randomUUID(), predecessor.snapshotId(), SNAPSHOT_ARCHIVE_EVENT, repairedPayload, now);
  }

  public PublishPreview publishPreview(UUID glossaryId, int limit, String after) {
    WorkingVersionRecord working = getWorking(GLOSSARY, glossaryId);
    List<TermRevision> revisions =
        buildActiveTermRevisions(
            Entity.getJdbi().onDemand(GlossaryVersionDAO.class),
            glossaryId,
            working.businessVersion());
    int offset = decodePreviewCursor(after, revisions.size());
    int end = Math.min(offset + limit, revisions.size());
    String next = end < revisions.size() ? Integer.toString(end) : null;
    return new PublishPreview(
        List.copyOf(revisions.subList(offset, end)),
        revisions.size(),
        System.currentTimeMillis(),
        next);
  }

  public record PublishPreview(
      List<TermRevision> data, int termCount, long evaluatedAt, String after) {}

  private static WorkingVersionRecord requireWorking(
      GlossaryVersionDAO dao, String entityType, UUID entityId, String parentBusinessVersion) {
    WorkingVersionRecord working = dao.lockWorking(entityType, entityId, parentBusinessVersion);
    if (working == null) {
      throw new NotFoundException("No working version exists");
    }
    return working;
  }

  static void requireUpdated(int updated) {
    if (updated != 1) {
      throw conflict("Working version revision conflict");
    }
  }

  static WebApplicationException conflict(String message) {
    return new WebApplicationException(
        Response.status(Response.Status.CONFLICT).entity(message).build());
  }

  private static boolean isConstraintConflict(Throwable exception) {
    for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
      if (cause instanceof SQLException sqlException
          && sqlException.getSQLState() != null
          && sqlException.getSQLState().startsWith("23")) {
        return true;
      }
    }
    return false;
  }

  private static void requireEntityType(String entityType) {
    if (!GLOSSARY.equals(entityType) && !GLOSSARY_TERM.equals(entityType)) {
      throw new BadRequestException("Unsupported glossary version entity type: " + entityType);
    }
  }

  private static String requireBusinessVersion(String entityType, String businessVersion) {
    try {
      return GLOSSARY.equals(entityType)
          ? GlossaryBusinessVersion.requireCanonicalDictionary(businessVersion)
          : GlossaryBusinessVersion.requireCanonical(businessVersion);
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(exception.getMessage());
    }
  }

  static String requireParentScope(String parentBusinessVersion) {
    try {
      return GlossaryBusinessVersion.requireCanonicalDictionary(parentBusinessVersion);
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException(exception.getMessage());
    }
  }

  private static Object emptyWorkingPayload(
      String entityType, Object explicitPayload, PublishedSnapshotRecord latest) {
    Object parsedIdentity =
        explicitPayload instanceof String
            ? JsonUtils.readValue((String) explicitPayload, Object.class)
            : JsonUtils.readValue(JsonUtils.pojoToJson(explicitPayload), Object.class);
    Object parsedSnapshot = JsonUtils.readValue(latest.payload(), Object.class);
    if (!(parsedIdentity instanceof java.util.Map<?, ?> identityRaw)
        || !(parsedSnapshot instanceof java.util.Map<?, ?> snapshotRaw)) {
      throw new BadRequestException("Working payload must be a JSON object");
    }

    java.util.Map<String, Object> identity = new java.util.LinkedHashMap<>();
    identityRaw.forEach((key, value) -> identity.put(String.valueOf(key), value));
    java.util.Map<String, Object> snapshot = new java.util.LinkedHashMap<>();
    snapshotRaw.forEach((key, value) -> snapshot.put(String.valueOf(key), value));
    java.util.Map<String, Object> blank = new java.util.LinkedHashMap<>();
    List<String> identityFields =
        GLOSSARY.equals(entityType)
            ? List.of(
                "id",
                "name",
                "displayName",
                "fullyQualifiedName",
                "href",
                "version",
                "versioningMode",
                "provider")
            : List.of("id", "name", "fullyQualifiedName", "glossary", "displayName");
    for (String field : identityFields) {
      Object value =
          "displayName".equals(field) && !GLOSSARY.equals(entityType)
              ? snapshot.get(field)
              : identity.get(field);
      if (value == null && GLOSSARY.equals(entityType) && "displayName".equals(field)) {
        value = snapshot.get(field);
      }
      if (value != null) {
        blank.put(field, value);
      }
    }
    // Description is required by both entity schemas, but a blank draft must not inherit it.
    blank.put("description", "");
    if (GLOSSARY.equals(entityType)) {
      blank.put("termRevisions", List.of());
    } else {
      blank.put("tags", List.of());
      blank.put("owners", List.of());
      blank.put("reviewers", List.of());
      blank.put("domains", List.of());
      // The canonical CDE selection is structural identity for a Data Quality
      // rule, not editable content. Preserve it when creating the next blank
      // working version so clients never have to reconstruct the relation from
      // the DQ term itself.
      Object relatedTerms = snapshot.get("relatedTerms");
      if (relatedTerms != null) {
        blank.put("relatedTerms", relatedTerms);
      }
    }
    return blank;
  }

  @SuppressWarnings("unchecked")
  static Object restoreMissingTermRelations(Object sourcePayload, PublishedSnapshotRecord latest) {
    if (latest == null) {
      return sourcePayload;
    }
    Object parsed =
        sourcePayload instanceof String
            ? JsonUtils.readValue((String) sourcePayload, Object.class)
            : JsonUtils.readValue(JsonUtils.pojoToJson(sourcePayload), Object.class);
    if (!(parsed instanceof Map<?, ?> raw)) {
      return sourcePayload;
    }
    Map<String, Object> payload = new LinkedHashMap<>();
    raw.forEach((key, value) -> payload.put(String.valueOf(key), value));
    Object relations = payload.get("relatedTerms");
    boolean missing = !(relations instanceof List<?> relationList) || relationList.isEmpty();
    boolean selfReference = false;
    if (!missing
        && relations instanceof List<?> relationList
        && relationList.size() == 1
        && relationList.get(0) instanceof Map<?, ?> relation
        && relation.get("term") instanceof Map<?, ?> term) {
      selfReference = java.util.Objects.equals(payload.get("id"), term.get("id"));
      selfReference =
          selfReference
              || java.util.Objects.equals(
                  payload.get("fullyQualifiedName"), term.get("fullyQualifiedName"))
              || java.util.Objects.equals(payload.get("name"), term.get("name"));
    }
    if (!missing && !selfReference) {
      return payload;
    }
    Object published = JsonUtils.readValue(latest.payload(), Object.class);
    if (published instanceof Map<?, ?> publishedValues
        && publishedValues.get("relatedTerms") instanceof List<?> publishedRelations
        && publishedRelations.size() == 1) {
      payload.put("relatedTerms", publishedRelations);
    }
    return payload;
  }

  private static Object withEmptyTermRevisions(Object sourcePayload) {
    Object parsed =
        sourcePayload instanceof String
            ? JsonUtils.readValue((String) sourcePayload, Object.class)
            : JsonUtils.readValue(JsonUtils.pojoToJson(sourcePayload), Object.class);
    if (!(parsed instanceof java.util.Map<?, ?> raw)) {
      throw new BadRequestException("Glossary working payload must be a JSON object");
    }
    java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
    raw.forEach((key, value) -> payload.put(String.valueOf(key), value));
    payload.put("termRevisions", List.of());
    payload.put("termCount", 0);
    return payload;
  }

  static Object withParentBusinessVersion(Object sourcePayload, String parentBusinessVersion) {
    Object parsed =
        sourcePayload instanceof String
            ? JsonUtils.readValue((String) sourcePayload, Object.class)
            : JsonUtils.readValue(JsonUtils.pojoToJson(sourcePayload), Object.class);
    if (!(parsed instanceof Map<?, ?> raw)) {
      throw new BadRequestException("Glossary term working payload must be a JSON object");
    }
    Map<String, Object> payload = new LinkedHashMap<>();
    raw.forEach((key, value) -> payload.put(String.valueOf(key), value));
    payload.put("parentBusinessVersion", parentBusinessVersion);
    Object name = payload.get("name");
    Object glossary = payload.get("glossary");
    if (name instanceof String termName && glossary instanceof Map<?, ?> glossaryValues) {
      Object glossaryFqn = glossaryValues.get("fullyQualifiedName");
      if (glossaryFqn instanceof String parentFqn && !parentFqn.isBlank()) {
        payload.put(
            "fullyQualifiedName",
            FullyQualifiedName.build(parentFqn, termName + "@v" + parentBusinessVersion));
      }
    }
    return payload;
  }

  private static List<PublishedSnapshotRecord> sortTermSnapshotsByName(
      List<PublishedSnapshotRecord> snapshots) {
    return snapshots.stream()
        .sorted(
            Comparator.comparing(
                    (PublishedSnapshotRecord snapshot) ->
                        snapshotTermName(snapshot).toLowerCase(Locale.ROOT))
                .thenComparing(GlossaryVersioningService::snapshotTermName)
                .thenComparing(PublishedSnapshotRecord::entityId))
        .toList();
  }

  private static String snapshotTermName(PublishedSnapshotRecord snapshot) {
    return JsonUtils.readTree(snapshot.payload()).path("name").asText("");
  }

  private static List<TermRevision> buildActiveTermRevisions(
      GlossaryVersionDAO dao, UUID glossaryId, String parentBusinessVersion) {
    List<PublishedSnapshotRecord> snapshots =
        sortTermSnapshotsByName(
            dao.listActiveLatestTermsForGlossaryAndParent(
                glossaryId, requireParentScope(parentBusinessVersion)));
    Set<UUID> termIds = new HashSet<>();
    Set<UUID> snapshotIds = new HashSet<>();
    List<TermRevision> revisions = new ArrayList<>(snapshots.size());
    for (int index = 0; index < snapshots.size(); index++) {
      PublishedSnapshotRecord snapshot = snapshots.get(index);
      if (!termIds.add(snapshot.entityId()) || !snapshotIds.add(snapshot.snapshotId())) {
        throw new IllegalStateException("Duplicate active glossary term published head");
      }
      revisions.add(
          new TermRevision(
              snapshot.entityId(), snapshot.snapshotId(), snapshot.businessVersion(), index));
    }
    return revisions;
  }

  /**
   * Approving a Data Dictionary version replaces the Data Quality catalog with it: the Approved
   * catalog is archived and an empty Draft of the same business version is opened, so Rules are
   * authored again against the new Data Dictionary scope.
   */
  private static void advanceDataQualityCatalog(
      GlossaryVersionDAO dao, UUID dictionaryId, String newVersion, long now, String actor) {
    try {
      final Glossary dictionary = Entity.getEntity(Entity.GLOSSARY, dictionaryId, "", Include.ALL);
      final boolean isDataDictionary =
          GovernedGlossaryProfileRegistry.find(dictionary)
              .filter(GovernedGlossaryProfileRegistry.Profile.DATA_DICTIONARY::equals)
              .isPresent();
      if (!isDataDictionary) {
        return;
      }
      final Glossary catalog = DqCatalog.requireGlossary();
      final PublishedSnapshotRecord predecessor =
          dao.lockLatestPublished(GLOSSARY, catalog.getId());
      if (predecessor == null
          || predecessor.archivedAt() != null
          || dao.lockWorking(GLOSSARY, catalog.getId(), null) != null) {
        return;
      }
      if (!new BigInteger(newVersion)
          .equals(new BigInteger(predecessor.businessVersion()).add(BigInteger.ONE))) {
        LOG.warn(
            "Data Quality catalog {} is not the predecessor of Data Dictionary {}; it was left"
                + " unchanged",
            predecessor.businessVersion(),
            newVersion);
        return;
      }
      cutOverPredecessor(dao, predecessor, catalog.getId(), now, actor);
      final Object payload =
          normalizeWorkingPayload(
              withEmptyTermRevisions(emptyWorkingPayload(GLOSSARY, catalog, predecessor)),
              newVersion,
              EntityStatus.DRAFT.value());
      dao.insertWorking(
          UUID.randomUUID(),
          GLOSSARY,
          catalog.getId(),
          null,
          null,
          newVersion,
          EntityStatus.DRAFT.value(),
          catalog.getVersion(),
          JsonUtils.pojoToJson(payload),
          now,
          actor);
    } catch (EntityNotFoundException exception) {
      // No Data Quality glossary exists yet, so there is no catalog to advance.
    }
  }

  /** Archives every unarchived term snapshot of a glossary in one Data Dictionary scope. */
  private static void archiveScopedTerms(
      GlossaryVersionDAO dao,
      UUID glossaryId,
      String parentBusinessVersion,
      long now,
      String actor) {
    for (PublishedSnapshotRecord term :
        dao.listUnarchivedTermSnapshotsForGlossaryAndParent(glossaryId, parentBusinessVersion)) {
      requireUpdated(dao.archiveSnapshot(term.snapshotId(), now, actor));
      dao.deletePublishedHead(GLOSSARY_TERM, term.entityId(), term.snapshotId());
      dao.insertOutbox(
          UUID.randomUUID(), term.snapshotId(), SNAPSHOT_ARCHIVE_EVENT, term.payload(), now);
    }
    dao.deleteWorkingByGlossaryAndParent(GLOSSARY_TERM, glossaryId, parentBusinessVersion);
  }

  /**
   * Data Quality Rules are bound to one Data Dictionary scope, so the Rules of the replaced
   * version are archived with it instead of staying Approved while no longer effective.
   */
  private static void archiveDataQualityRules(
      GlossaryVersionDAO dao, UUID glossaryId, String replacedVersion, long now, String actor) {
    try {
      final Glossary replaced = Entity.getEntity(Entity.GLOSSARY, glossaryId, "", Include.ALL);
      final boolean isDataDictionary =
          GovernedGlossaryProfileRegistry.find(replaced)
              .filter(GovernedGlossaryProfileRegistry.Profile.DATA_DICTIONARY::equals)
              .isPresent();
      if (isDataDictionary) {
        archiveScopedTerms(dao, DqCatalog.requireGlossary().getId(), replacedVersion, now, actor);
      }
    } catch (EntityNotFoundException exception) {
      // No Data Quality glossary exists yet, so there are no Rules to archive.
    }
  }

  private static void cutOverPredecessor(
      GlossaryVersionDAO dao,
      PublishedSnapshotRecord predecessor,
      UUID glossaryId,
      long now,
      String actor) {
    String predecessorVersion = predecessor.businessVersion();
    List<PublishedSnapshotRecord> approvedTerms =
        sortTermSnapshotsByName(
            dao.listActiveLatestTermsForGlossaryAndParent(glossaryId, predecessorVersion));

    // The archive manifest represents the final Approved membership at cutover, not the
    // membership that happened to exist when the predecessor was first published.
    dao.deleteSnapshotTerms(predecessor.snapshotId());
    for (int index = 0; index < approvedTerms.size(); index++) {
      PublishedSnapshotRecord term = approvedTerms.get(index);
      dao.insertSnapshotTerm(predecessor.snapshotId(), term.snapshotId(), index);
    }
    archiveScopedTerms(dao, glossaryId, predecessorVersion, now, actor);
    archiveDataQualityRules(dao, glossaryId, predecessorVersion, now, actor);
    requireUpdated(dao.archiveSnapshot(predecessor.snapshotId(), now, actor));
    // During a live cutover this removes the predecessor head; during repair the old buggy
    // publish may already have replaced that head with the successor.
    dao.deletePublishedHead(GLOSSARY, predecessor.entityId(), predecessor.snapshotId());
    dao.insertOutbox(
        UUID.randomUUID(),
        predecessor.snapshotId(),
        SNAPSHOT_ARCHIVE_EVENT,
        predecessor.payload(),
        now);
  }

  private static Object withTermRevisions(Object sourcePayload, List<TermRevision> revisions) {
    Object parsed =
        sourcePayload instanceof String
            ? JsonUtils.readValue((String) sourcePayload, Object.class)
            : JsonUtils.readValue(JsonUtils.pojoToJson(sourcePayload), Object.class);
    Map<String, Object> payload = new LinkedHashMap<>();
    ((Map<?, ?>) parsed).forEach((key, value) -> payload.put(String.valueOf(key), value));
    payload.put("termRevisions", revisions);
    payload.put("termCount", revisions.size());
    return payload;
  }

  private static void insertGlossaryTermRevisions(
      GlossaryVersionDAO dao, UUID glossarySnapshotId, List<TermRevision> revisions) {
    revisions.forEach(
        revision ->
            dao.insertSnapshotTerm(
                glossarySnapshotId, revision.termSnapshotId(), revision.displayOrder()));
  }

  public record TermRevision(
      UUID termId, UUID termSnapshotId, String termBusinessVersion, int displayOrder) {}

  private static int decodePreviewCursor(String after, int size) {
    if (after == null || after.isBlank()) {
      return 0;
    }
    try {
      int offset = Integer.parseInt(after);
      if (offset < 0 || offset > size) {
        throw new NumberFormatException();
      }
      return offset;
    } catch (NumberFormatException exception) {
      throw new BadRequestException("Invalid publish preview cursor");
    }
  }

  static void lockPublicationScope(
      GlossaryVersionDAO dao, String entityType, UUID entityId, String parentBusinessVersion) {
    UUID glossaryId = entityId;
    if (GLOSSARY_TERM.equals(entityType)) {
      WorkingVersionRecord working = dao.findWorking(entityType, entityId, parentBusinessVersion);
      PublishedSnapshotRecord published =
          dao.findLatestPublishedByParent(entityType, entityId, parentBusinessVersion);
      glossaryId =
          working != null
              ? working.glossaryId()
              : published == null ? null : published.glossaryId();
    }
    if (glossaryId == null || dao.lockGlossaryIdentity(glossaryId) == null) {
      throw new NotFoundException("Data Dictionary identity not found");
    }
  }

  @SuppressWarnings("unchecked")
  static String withPublishedMetadata(
      Object sourcePayload,
      WorkingVersionRecord working,
      UUID snapshotId,
      long publicationSequence,
      long publishedAt,
      String publishedBy) {
    Object parsed =
        sourcePayload instanceof String
            ? JsonUtils.readValue((String) sourcePayload, Object.class)
            : JsonUtils.readValue(JsonUtils.pojoToJson(sourcePayload), Object.class);
    if (!(parsed instanceof java.util.Map<?, ?> raw)) {
      throw new BadRequestException("Working payload must be a JSON object");
    }
    java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
    raw.forEach((key, value) -> payload.put(String.valueOf(key), value));
    payload.put("businessVersion", working.businessVersion());
    payload.put("snapshotId", snapshotId);
    payload.put("publicationSequence", publicationSequence);
    payload.put("entityStatus", EntityStatus.APPROVED.value());
    payload.put("publishedAt", publishedAt);
    payload.put("publishedBy", publishedBy);
    payload.remove("workingRevision");
    payload.remove("archivedAt");
    payload.remove("archivedBy");
    return JsonUtils.pojoToJson(canonicalize(payload));
  }

  private static Object canonicalize(Object value) {
    if (value instanceof Map<?, ?> map) {
      Map<String, Object> sorted = new TreeMap<>();
      map.forEach((key, child) -> sorted.put(String.valueOf(key), canonicalize(child)));
      return sorted;
    }
    if (value instanceof List<?> list) {
      List<Object> canonical = new ArrayList<>(list.size());
      list.forEach(child -> canonical.add(canonicalize(child)));
      return canonical;
    }
    return value;
  }

  /** Draft payload of the next minor version, starting from an immutable Approved payload. */
  public static GlossaryTerm nextDraftFromPublished(
      String publishedPayload, String businessVersion, String parentBusinessVersion) {
    Object payload =
        normalizeWorkingPayload(publishedPayload, businessVersion, EntityStatus.DRAFT.value());
    payload = CdeReleaseVersionType.apply(payload, businessVersion);
    payload = withParentBusinessVersion(payload, parentBusinessVersion);
    return JsonUtils.convertValue(payload, GlossaryTerm.class);
  }

  static Object normalizeWorkingPayload(
      Object sourcePayload, String businessVersion, String entityStatus) {
    Object parsed =
        sourcePayload instanceof String
            ? JsonUtils.readValue((String) sourcePayload, Object.class)
            : JsonUtils.readValue(JsonUtils.pojoToJson(sourcePayload), Object.class);
    if (!(parsed instanceof java.util.Map<?, ?> raw)) {
      throw new BadRequestException("Working payload must be a JSON object");
    }
    java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
    raw.forEach((key, value) -> payload.put(String.valueOf(key), value));
    payload.put("businessVersion", businessVersion);
    payload.put("entityStatus", entityStatus);
    payload.remove("workingRevision");
    payload.remove("snapshotId");
    payload.remove("publicationSequence");
    payload.remove("publishedAt");
    payload.remove("publishedBy");
    payload.remove("archivedAt");
    payload.remove("archivedBy");
    return payload;
  }

  @SuppressWarnings("unchecked")
  private static Object withAudit(Object sourcePayload, String actor, long updatedAt) {
    java.util.Map<String, Object> payload =
        new java.util.LinkedHashMap<>((java.util.Map<String, Object>) sourcePayload);
    payload.put("updatedBy", actor);
    payload.put("updatedAt", updatedAt);
    payload.remove("createdBy");
    payload.remove("createdAt");
    return payload;
  }

  static String sha256(String value) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
