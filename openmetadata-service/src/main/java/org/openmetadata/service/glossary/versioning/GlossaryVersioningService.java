/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Set;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.SnapshotOutboxRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.GlossaryBusinessVersion;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Application service for isolated glossary working versions and immutable snapshots. */
public class GlossaryVersioningService {
  private static final Logger LOG = LoggerFactory.getLogger(GlossaryVersioningService.class);
  private static final int OUTBOX_BATCH_SIZE = 100;
  public static final String GLOSSARY = "glossary";
  public static final String GLOSSARY_TERM = "glossaryTerm";

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
        businessVersion,
        nativeVersion,
        explicitPayload,
        actor,
        false);
  }

  public WorkingVersionRecord createNextTermWorking(
      UUID entityId,
      UUID glossaryId,
      String businessVersion,
      Double nativeVersion,
      Object identityPayload,
      String actor,
      Consumer<PublishedSnapshotRecord> authorization) {
    return createWorking(
        GLOSSARY_TERM,
        entityId,
        glossaryId,
        businessVersion,
        nativeVersion,
        identityPayload,
        actor,
        true,
        authorization);
  }

  private WorkingVersionRecord createWorking(
      String entityType,
      UUID entityId,
      UUID glossaryId,
      String businessVersion,
      Double nativeVersion,
      Object explicitPayload,
      String actor,
      boolean requirePublished) {
    return createWorking(
        entityType,
        entityId,
        glossaryId,
        businessVersion,
        nativeVersion,
        explicitPayload,
        actor,
        requirePublished,
        null);
  }

  private WorkingVersionRecord createWorking(
      String entityType,
      UUID entityId,
      UUID glossaryId,
      String businessVersion,
      Double nativeVersion,
      Object explicitPayload,
      String actor,
      boolean requirePublished,
      Consumer<PublishedSnapshotRecord> authorization) {
    requireEntityType(entityType);
    String canonicalVersion = requireBusinessVersion(businessVersion);
    WorkingVersionRecord result;
    try {
      result =
          Entity.getJdbi()
              .inTransaction(
                handle -> {
                  GlossaryVersionDAO dao = handle.attach(GlossaryVersionDAO.class);
                  PublishedSnapshotRecord latest = dao.lockLatestPublished(entityType, entityId);
                  if (requirePublished && latest == null) {
                    throw conflict("An Approved version is required before creating a new version");
                  }
                  if (authorization != null) {
                    authorization.accept(latest);
                  }
                  if (dao.lockWorking(entityType, entityId) != null) {
                    throw conflict("A working version already exists");
                  }
                  if (dao.findPublishedVersion(entityType, entityId, canonicalVersion) != null) {
                    throw conflict("businessVersion has already been published");
                  }
                  if (latest != null
                      && GlossaryBusinessVersion.compare(canonicalVersion, latest.businessVersion())
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
                  long now = System.currentTimeMillis();
                  dao.insertWorking(
                      UUID.randomUUID(),
                      entityType,
                      entityId,
                      glossaryId,
                      canonicalVersion,
                      EntityStatus.DRAFT.value(),
                      nativeVersion,
                      JsonUtils.pojoToJson(payload),
                      now,
                      actor);
                  return dao.findWorking(entityType, entityId);
                });
    } catch (UnableToExecuteStatementException exception) {
      if (isConstraintConflict(exception)) {
        throw conflict("A working version was created concurrently");
      }
      throw exception;
    }
    refreshManagerIndexSafely(entityType, entityId);
    return result;
  }

  public WorkingVersionRecord saveWorking(
      String entityType,
      UUID entityId,
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
                    WorkingVersionRecord working = requireWorking(dao, entityType, entityId);
                  if (!EntityStatus.DRAFT.value().equals(working.entityStatus())) {
                    throw new BadRequestException("Only Draft working versions can be edited");
                  }
                  long now = System.currentTimeMillis();
                  int updated =
                      dao.updateWorking(
                          entityType,
                          entityId,
                          expectedRevision,
                          working.entityStatus(),
                          nativeVersion,
                          JsonUtils.pojoToJson(
                              withAudit(
                                  normalizeWorkingPayload(
                                      payload, working.businessVersion(), working.entityStatus()),
                                  actor,
                                  now)),
                          now,
                          actor);
                  requireUpdated(updated);
                  return dao.findWorking(entityType, entityId);
                });
    refreshManagerIndexSafely(entityType, entityId);
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
        entityType, entityId, expectedRevision, expectedStatus, targetStatus, actor, null, false);
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
                  WorkingVersionRecord working = requireWorking(dao, entityType, entityId);
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
                          expectedRevision,
                          expectedStatus.value(),
                          targetStatus.value(),
                          System.currentTimeMillis(),
                          actor);
                  requireUpdated(updated);
                  return dao.findWorking(entityType, entityId);
                });
    refreshManagerIndexSafely(entityType, entityId);
    return result;
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
    requireEntityType(entityType);
    PublishedSnapshotRecord published;
    try {
      published =
          Entity.getJdbi()
              .inTransaction(
                  handle -> {
                    GlossaryVersionDAO dao = handle.attach(GlossaryVersionDAO.class);
                    lockPublicationScope(dao, entityType, entityId);
                    WorkingVersionRecord working = requireWorking(dao, entityType, entityId);
                    if (working.revision() != expectedRevision) {
                      throw conflict("Working version revision conflict");
                    }
                    if (!EntityStatus.IN_REVIEW.value().equals(working.entityStatus())) {
                      throw conflict("Only an InReview working version can be approved");
                    }
                    if (authorizationAndValidation != null) {
                      authorizationAndValidation.accept(working);
                    }
                    if (dao.findPublishedVersion(entityType, entityId, working.businessVersion())
                        != null) {
                      throw conflict("businessVersion has already been published");
                    }

                    UUID snapshotId = UUID.randomUUID();
                    long sequence = dao.nextPublicationSequence(entityType, entityId);
                    long now = System.currentTimeMillis();
                    Object publicationPayload = working.payload();
                    List<TermRevision> termRevisions = List.of();
                    if (GLOSSARY.equals(entityType)) {
                      termRevisions = buildActiveTermRevisions(dao, entityId);
                      publicationPayload = withTermRevisions(working.payload(), termRevisions);
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
                        working.businessVersion(),
                        working.nativeVersion(),
                        sequence,
                        approvedPayload,
                        contentHash,
                        now,
                        actor);
                    if (GLOSSARY.equals(entityType)) {
                      insertGlossaryTermRevisions(dao, snapshotId, termRevisions);
                    }
                    dao.upsertPublishedHead(entityType, entityId, snapshotId, sequence);
                    dao.insertOutbox(
                        UUID.randomUUID(),
                        snapshotId,
                        "PUBLISHED_SNAPSHOT_UPSERT",
                        approvedPayload,
                        now);
                    requireUpdated(dao.deleteWorking(entityType, entityId, expectedRevision));
                    return new PublishedSnapshotRecord(
                        snapshotId,
                        entityType,
                        entityId,
                        working.glossaryId(),
                        working.businessVersion(),
                        working.nativeVersion(),
                        sequence,
                        approvedPayload,
                        contentHash,
                        now,
                        actor,
                        null,
                        null);
                  });
    } catch (UnableToExecuteStatementException exception) {
      if (isConstraintConflict(exception)) {
        throw conflict("The working version was published concurrently");
      }
      throw exception;
    }
    processPendingOutbox();
    refreshManagerIndexSafely(entityType, entityId);
    return published;
  }

  public WorkingVersionRecord getWorking(String entityType, UUID entityId) {
    WorkingVersionRecord record =
        Entity.getJdbi().onDemand(GlossaryVersionDAO.class).findWorking(entityType, entityId);
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

  public PublishedSnapshotRecord getPublished(
      String entityType, UUID entityId, String businessVersion) {
    PublishedSnapshotRecord record =
        Entity.getJdbi()
            .onDemand(GlossaryVersionDAO.class)
            .findPublishedVersion(entityType, entityId, requireBusinessVersion(businessVersion));
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

  public PublishedSnapshotRecord archiveLatest(String entityType, UUID entityId, String actor) {
    requireEntityType(entityType);
    PublishedSnapshotRecord archived =
        Entity.getJdbi()
            .inTransaction(
                handle -> {
                  GlossaryVersionDAO dao = handle.attach(GlossaryVersionDAO.class);
                  lockPublicationScope(dao, entityType, entityId);
                  PublishedSnapshotRecord latest = dao.findLatestPublished(entityType, entityId);
                  if (latest == null) {
                    throw new NotFoundException("No published snapshot exists");
                  }
                  long now = System.currentTimeMillis();
                  requireUpdated(dao.archiveSnapshot(latest.snapshotId(), now, actor));
                  requireUpdated(
                      dao.deletePublishedHead(entityType, entityId, latest.snapshotId()));
                  PublishedSnapshotRecord previous =
                      dao.findNewestActivePublished(entityType, entityId);
                  if (previous != null) {
                    dao.upsertPublishedHead(
                        entityType,
                        entityId,
                        previous.snapshotId(),
                        previous.publicationSequence());
                  }
                  dao.insertOutbox(
                      UUID.randomUUID(),
                      latest.snapshotId(),
                      "PUBLISHED_SNAPSHOT_ARCHIVE",
                      latest.payload(),
                      now);
                  return new PublishedSnapshotRecord(
                      latest.snapshotId(),
                      latest.entityType(),
                      latest.entityId(),
                      latest.glossaryId(),
                      latest.businessVersion(),
                      latest.nativeVersion(),
                      latest.publicationSequence(),
                      latest.payload(),
                      latest.contentHash(),
                      latest.publishedAt(),
                      latest.publishedBy(),
                      now,
                      actor);
                });
    processPendingOutbox();
    refreshManagerIndexSafely(entityType, entityId);
    return archived;
  }

  /** Flushes snapshot outbox events idempotently; failures remain pending for a later request. */
  public void processPendingOutbox() {
    GlossaryVersionDAO dao = Entity.getJdbi().onDemand(GlossaryVersionDAO.class);
    for (SnapshotOutboxRecord event : dao.listPendingOutbox(OUTBOX_BATCH_SIZE)) {
      try {
        PublishedSnapshotRecord changed = dao.findSnapshot(event.snapshotId());
        if (changed == null) {
          throw new IllegalStateException("Snapshot not found for outbox event " + event.eventId());
        }
        refreshPublishedIndex(dao, changed.entityType(), changed.entityId());
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

  private void refreshManagerIndexSafely(String entityType, UUID entityId) {
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

  public List<PublishedSnapshotRecord> listPublishedGlossaryTerms(
      UUID glossaryId, String businessVersion) {
    PublishedSnapshotRecord glossary = getPublished(GLOSSARY, glossaryId, businessVersion);
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

  public boolean isLatestPublished(
      String entityType, UUID entityId, String businessVersion) {
    return businessVersion.equals(getLatestPublished(entityType, entityId).businessVersion());
  }

  public PublishPreview publishPreview(UUID glossaryId, int limit, String after) {
    List<TermRevision> revisions =
        buildActiveTermRevisions(
            Entity.getJdbi().onDemand(GlossaryVersionDAO.class), glossaryId);
    int offset = decodePreviewCursor(after, revisions.size());
    int end = Math.min(offset + limit, revisions.size());
    String next = end < revisions.size() ? Integer.toString(end) : null;
    return new PublishPreview(
        List.copyOf(revisions.subList(offset, end)), revisions.size(), System.currentTimeMillis(), next);
  }

  public record PublishPreview(
      List<TermRevision> data, int termCount, long evaluatedAt, String after) {}

  private static WorkingVersionRecord requireWorking(
      GlossaryVersionDAO dao, String entityType, UUID entityId) {
    WorkingVersionRecord working = dao.lockWorking(entityType, entityId);
    if (working == null) {
      throw new NotFoundException("No working version exists");
    }
    return working;
  }

  private static void requireUpdated(int updated) {
    if (updated != 1) {
      throw conflict("Working version revision conflict");
    }
  }

  private static WebApplicationException conflict(String message) {
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

  private static String requireBusinessVersion(String businessVersion) {
    try {
      return GlossaryBusinessVersion.requireCanonical(businessVersion);
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
                "id", "name", "fullyQualifiedName", "href", "version", "versioningMode", "provider")
            : List.of("id", "name", "fullyQualifiedName", "glossary", "displayName");
    for (String field : identityFields) {
      Object value = "displayName".equals(field) ? snapshot.get(field) : identity.get(field);
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
    }
    return blank;
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

  private static List<PublishedSnapshotRecord> sortTermSnapshotsByName(
      List<PublishedSnapshotRecord> snapshots) {
    return snapshots.stream()
        .sorted(
            Comparator.comparing(
                    snapshot -> snapshotTermName(snapshot).toLowerCase(Locale.ROOT))
                .thenComparing(GlossaryVersioningService::snapshotTermName)
                .thenComparing(PublishedSnapshotRecord::entityId))
        .toList();
  }

  private static String snapshotTermName(PublishedSnapshotRecord snapshot) {
    return JsonUtils.readTree(snapshot.payload()).path("name").asText("");
  }

  private static List<TermRevision> buildActiveTermRevisions(
      GlossaryVersionDAO dao, UUID glossaryId) {
    List<PublishedSnapshotRecord> snapshots =
        sortTermSnapshotsByName(dao.listActiveLatestTermsForGlossary(glossaryId));
    Set<UUID> termIds = new HashSet<>();
    Set<UUID> snapshotIds = new HashSet<>();
    List<TermRevision> revisions = new ArrayList<>(snapshots.size());
    for (int index = 0; index < snapshots.size(); index++) {
      PublishedSnapshotRecord snapshot = snapshots.get(index);
      if (!termIds.add(snapshot.entityId()) || !snapshotIds.add(snapshot.snapshotId())) {
        throw new IllegalStateException("Duplicate active CDE published head");
      }
      revisions.add(
          new TermRevision(
              snapshot.entityId(), snapshot.snapshotId(), snapshot.businessVersion(), index));
    }
    return revisions;
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

  private static void lockPublicationScope(
      GlossaryVersionDAO dao, String entityType, UUID entityId) {
    UUID glossaryId = entityId;
    if (GLOSSARY_TERM.equals(entityType)) {
      WorkingVersionRecord working = dao.findWorking(entityType, entityId);
      PublishedSnapshotRecord published = dao.findLatestPublished(entityType, entityId);
      glossaryId = working != null ? working.glossaryId() : published == null ? null : published.glossaryId();
    }
    if (glossaryId == null || dao.lockGlossaryIdentity(glossaryId) == null) {
      throw new NotFoundException("Data Dictionary identity not found");
    }
  }

  @SuppressWarnings("unchecked")
  private static String withPublishedMetadata(
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

  private static Object normalizeWorkingPayload(
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

  private static String sha256(String value) {
    try {
      byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest);
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }
}
