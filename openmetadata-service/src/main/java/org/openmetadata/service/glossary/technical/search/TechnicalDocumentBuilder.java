/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical.search;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.ws.rs.NotFoundException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.TechnicalCatalog;
import org.openmetadata.service.glossary.technical.TechnicalCdeInfo;
import org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile;
import org.openmetadata.service.glossary.technical.TechnicalSourceStates;
import org.openmetadata.service.glossary.technical.search.TechnicalDocumentAssembler.RecordState;
import org.openmetadata.service.glossary.technical.search.TechnicalSearchIndex.IndexAction;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService.Scope;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService.ScopeType;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.TechnicalRecordQueryDAO;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO;
import org.openmetadata.service.jdbi3.TechnicalSourceStateDAO.RecordIdentity;

/**
 * Reads the complete state of Technical Dictionary records from the database and turns it into
 * index operations: an upsert for a record that has a representation, a delete otherwise.
 */
public final class TechnicalDocumentBuilder {
  private static final int MAX_CACHED_CDES = 1_000;

  private final GlossaryVersioningService versions = new GlossaryVersioningService();
  private final GlossaryFlatListService scopes = new GlossaryFlatListService();

  /** Operations for the given record ids; ids that are not Technical Dictionary records are deleted. */
  public List<IndexAction> build(Collection<UUID> termIds) {
    final Map<UUID, RecordIdentity> identities =
        TechnicalCatalog.findGlossary()
            .map(technical -> identities(technical, termIds))
            .orElse(Map.of());
    final List<IndexAction> actions = new ArrayList<>(buildIdentities(identities.values()));
    termIds.stream()
        .filter(termId -> !identities.containsKey(termId))
        .distinct()
        .forEach(termId -> actions.add(IndexAction.delete(termId.toString())));
    return actions;
  }

  /** Row of the current view of one record, read from the database rather than the index. */
  public Optional<Map<String, Object>> currentRow(UUID termId) {
    return build(List.of(termId)).stream()
        .filter(action -> !action.isDelete())
        .findFirst()
        .map(action -> TechnicalRowMapper.toRow(action.document(), TechnicalIndexFields.CURRENT));
  }

  /** Operations for identities already read from the database. */
  public List<IndexAction> buildIdentities(Collection<RecordIdentity> identities) {
    final List<IndexAction> actions = new ArrayList<>();
    final UUID glossaryId =
        identities.isEmpty() ? null : TechnicalCatalog.requireGlossary().getId();
    identities.stream()
        .filter(identity -> identity.parentBusinessVersion() != null)
        .collect(Collectors.groupingBy(RecordIdentity::parentBusinessVersion))
        .forEach((scope, members) -> actions.addAll(buildScope(glossaryId, scope, members)));
    return actions;
  }

  private static Map<UUID, RecordIdentity> identities(
      Glossary technical, Collection<UUID> termIds) {
    final List<String> ids = termIds.stream().map(UUID::toString).distinct().toList();
    return ids.isEmpty()
        ? Map.of()
        : Entity.getJdbi()
            .onDemand(TechnicalSourceStateDAO.class)
            .listRecordsByIds(TechnicalCatalog.recordHashPrefix(technical), ids)
            .stream()
            .collect(
                Collectors.toMap(RecordIdentity::termId, identity -> identity, (left, right) -> left));
  }

  private List<IndexAction> buildScope(
      UUID glossaryId, String scope, List<RecordIdentity> members) {
    final ScopeRepresentations representations = load(glossaryId, scope, members);
    final Map<String, String> sourceStates = TechnicalSourceStates.statusesOf(glossaryId, scope);
    final Function<UUID, TechnicalCdeInfo> cdes = cdeLookup(scope);
    return members.stream()
        .map(identity -> action(glossaryId, identity, representations, sourceStates, cdes))
        .toList();
  }

  private static IndexAction action(
      UUID glossaryId,
      RecordIdentity identity,
      ScopeRepresentations representations,
      Map<String, String> sourceStates,
      Function<UUID, TechnicalCdeInfo> cdes) {
    final TechnicalRepresentation published = representations.published().get(identity.termId());
    final TechnicalRepresentation current =
        representations.working().getOrDefault(identity.termId(), published);
    final String sourceStatus =
        sourceStates.getOrDefault(identity.columnKey(), TechnicalDictionaryProfile.SOURCE_AVAILABLE);
    return current == null
        ? IndexAction.delete(identity.termId().toString())
        : new IndexAction(
            identity.termId().toString(),
            TechnicalDocumentAssembler.assemble(
                stateOf(glossaryId, identity, current, published, sourceStatus), cdes));
  }

  private static RecordState stateOf(
      UUID glossaryId,
      RecordIdentity identity,
      TechnicalRepresentation current,
      TechnicalRepresentation published,
      String sourceStatus) {
    return new RecordState(
        identity.termId(),
        glossaryId,
        identity.parentBusinessVersion(),
        identity.columnKey(),
        current,
        published,
        sourceStatus);
  }

  private ScopeRepresentations load(UUID glossaryId, String scope, List<RecordIdentity> members) {
    final List<UUID> termIds = members.stream().map(RecordIdentity::termId).toList();
    final Scope catalog = catalogScope(glossaryId, scope);
    return catalog != null && catalog.type() == ScopeType.ARCHIVED
        ? new ScopeRepresentations(archived(catalog, termIds), Map.of())
        : new ScopeRepresentations(published(termIds, scope), working(termIds, scope));
  }

  private Scope catalogScope(UUID glossaryId, String scope) {
    Scope catalog = null;
    try {
      catalog = scopes.resolveScope(glossaryId, scope);
    } catch (NotFoundException | IllegalArgumentException exception) {
      catalog = null;
    }
    return catalog;
  }

  private static Map<UUID, TechnicalRepresentation> archived(Scope catalog, List<UUID> termIds) {
    return Entity.getJdbi()
        .onDemand(TechnicalRecordQueryDAO.class)
        .listManifestSnapshots(
            catalog.published().snapshotId(), termIds.stream().map(UUID::toString).toList())
        .stream()
        .collect(
            Collectors.toMap(
                PublishedSnapshotRecord::entityId,
                TechnicalRepresentation::archived,
                (left, right) -> left));
  }

  private Map<UUID, TechnicalRepresentation> published(List<UUID> termIds, String scope) {
    final Map<UUID, TechnicalRepresentation> result = new LinkedHashMap<>();
    versions
        .getLatestPublishedBatch(GlossaryVersioningService.GLOSSARY_TERM, termIds, scope)
        .forEach(
            (termId, snapshot) -> {
              if (snapshot.archivedAt() == null) {
                result.put(termId, TechnicalRepresentation.published(snapshot));
              }
            });
    return result;
  }

  private Map<UUID, TechnicalRepresentation> working(List<UUID> termIds, String scope) {
    final Map<UUID, TechnicalRepresentation> result = new LinkedHashMap<>();
    versions
        .getWorkingBatch(GlossaryVersioningService.GLOSSARY_TERM, termIds, scope)
        .forEach((termId, working) -> result.put(termId, TechnicalRepresentation.working(working)));
    return result;
  }

  private static Function<UUID, TechnicalCdeInfo> cdeLookup(String scope) {
    final Cache<UUID, TechnicalCdeInfo> cache =
        Caffeine.newBuilder().maximumSize(MAX_CACHED_CDES).build();
    return cdeId -> cache.get(cdeId, id -> TechnicalCdeInfo.resolve(id, scope));
  }

  private record ScopeRepresentations(
      Map<UUID, TechnicalRepresentation> published, Map<UUID, TechnicalRepresentation> working) {}
}
