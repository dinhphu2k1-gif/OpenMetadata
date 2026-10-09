/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry;
import org.openmetadata.service.glossary.GovernedGlossaryProfileRegistry.Profile;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService.Candidates;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService.Scope;
import org.openmetadata.service.glossary.versioning.GlossaryFlatListService.ScopeType;
import org.openmetadata.service.governance.search.GovernanceSearchIndex.IndexAction;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.resources.glossary.GovernedGlossaryRowMapper;

/** Builds complete flat-row documents from the same records and projection used by the DB API. */
public final class GovernedGlossaryDocumentBuilder {
  private static final int VERSION_PART_WIDTH = 40;
  private final GlossaryFlatListService flatListService = new GlossaryFlatListService();

  public List<IndexAction> buildScope(
      final UUID glossaryId, final String parentBusinessVersion, final boolean reconcile) {
    final Scope scope = flatListService.resolveScope(glossaryId, parentBusinessVersion);
    final List<Map<String, Object>> rows = rows(glossaryId, scope);
    final List<IndexAction> actions = new ArrayList<>();
    final Set<String> expected = new LinkedHashSet<>();
    for (Map<String, Object> row : rows) {
      final String id = id(row);
      expected.add(id);
      actions.add(new IndexAction(id, document(glossaryId, row)));
    }
    if (reconcile) {
      GovernedGlossarySearchIndex.idsInScope(glossaryId, parentBusinessVersion).stream()
          .filter(id -> !expected.contains(id))
          .map(IndexAction::delete)
          .forEach(actions::add);
    }
    return actions;
  }

  public List<Map<String, Object>> rows(final UUID glossaryId, final Scope scope) {
    final Candidates candidates = flatListService.loadCandidates(glossaryId, scope);
    final List<Map<String, Object>> rows = new ArrayList<>();
    final String publishedType =
        scope.type() == ScopeType.ARCHIVED
            ? GovernedGlossaryRowMapper.ARCHIVED
            : GovernedGlossaryRowMapper.PUBLISHED;
    candidates.published().stream()
        .map(record -> published(record, scope, publishedType))
        .forEach(rows::add);
    candidates.working().stream()
        .map(record -> GovernedGlossaryRowMapper.working(record, scope.parentBusinessVersion()))
        .forEach(rows::add);
    addDeleted(glossaryId, scope, rows);
    return rows;
  }

  private void addDeleted(
      final UUID glossaryId, final Scope scope, final Collection<Map<String, Object>> rows) {
    if (scope.type() == ScopeType.ACTIVE && isDataDictionary(scope)) {
      flatListService.loadDeleted(glossaryId, scope).stream()
          .map(
              record ->
                  GovernedGlossaryRowMapper.published(
                      record, scope.parentBusinessVersion(), GovernedGlossaryRowMapper.DELETED))
          .forEach(rows::add);
    }
  }

  private static Map<String, Object> published(
      final PublishedSnapshotRecord record, final Scope scope, final String recordType) {
    return GovernedGlossaryRowMapper.published(record, scope.parentBusinessVersion(), recordType);
  }

  private static boolean isDataDictionary(final Scope scope) {
    final String glossaryName = JsonUtils.readTree(scope.payload()).path("name").asText();
    return GovernedGlossaryProfileRegistry.requireName(glossaryName) == Profile.DATA_DICTIONARY;
  }

  public static Map<String, Object> document(final UUID glossaryId, final Map<String, Object> row) {
    final Map<String, Object> document = new LinkedHashMap<>(row);
    document.put(GovernedGlossaryIndexFields.GLOSSARY_ID, glossaryId.toString());
    document.put(
        GovernedGlossaryIndexFields.NAME_SEARCH,
        GovernedGlossaryText.normalize(row.get(GovernedGlossaryIndexFields.NAME)));
    document.put(
        GovernedGlossaryIndexFields.DISPLAY_NAME_SEARCH,
        GovernedGlossaryText.normalize(row.get(GovernedGlossaryIndexFields.DISPLAY_NAME)));
    document.put(
        GovernedGlossaryIndexFields.DESCRIPTION_SEARCH,
        GovernedGlossaryText.normalize(row.get(GovernedGlossaryIndexFields.DESCRIPTION)));
    document.put(
        GovernedGlossaryIndexFields.BUSINESS_VERSION_SORT,
        versionSort(row.get(GovernedGlossaryIndexFields.BUSINESS_VERSION)));
    document.put(GovernedGlossaryIndexFields.REVISION_MARKER, revisionMarker(row));
    document.put(GovernedGlossaryIndexFields.OWNER_IDS, referenceValues(row.get("owners"), "id"));
    document.put(GovernedGlossaryIndexFields.DOMAIN_IDS, referenceValues(row.get("domains"), "id"));
    final List<String> tags = referenceValues(row.get("tags"), "tagFQN");
    document.put(GovernedGlossaryIndexFields.DATA_SOURCE_TAGS, tags);
    document.put(GovernedGlossaryIndexFields.CLASSIFICATION_TAGS, tags);
    return document;
  }

  static String id(final Map<String, Object> row) {
    return String.join(
        "|",
        String.valueOf(row.get(GovernedGlossaryIndexFields.TERM_ID)),
        String.valueOf(row.get(GovernedGlossaryIndexFields.PARENT_BUSINESS_VERSION)),
        String.valueOf(row.get(GovernedGlossaryIndexFields.RECORD_TYPE)));
  }

  static String versionSort(final Object value) {
    final String[] parts = String.valueOf(value).split("\\.");
    final List<String> padded = new ArrayList<>();
    for (String part : parts) {
      padded.add(
          String.format("%" + VERSION_PART_WIDTH + "s", new BigInteger(part)).replace(' ', '0'));
    }
    return String.join(".", padded);
  }

  static long revisionMarker(final Map<String, Object> row) {
    final Object working = row.get("workingRevision");
    final Object published = row.get("publicationSequence");
    final Object value = working == null ? published : working;
    return value instanceof Number number ? number.longValue() : 0L;
  }

  /** Both tag filters match any tag of the row, exactly as the database filter does. */
  private static List<String> referenceValues(final Object raw, final String key) {
    final List<String> values = new ArrayList<>();
    if (raw instanceof List<?> references) {
      for (Object item : references) {
        if (item instanceof Map<?, ?> reference && reference.get(key) != null) {
          values.add(String.valueOf(reference.get(key)));
        }
      }
    }
    return List.copyOf(values);
  }
}
