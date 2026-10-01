/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;

/**
 * Database-backed reference resolution for one import run. Tags, Teams and CDEs are loaded once
 * and matched by display name (or CDE code); an unknown or ambiguous label is a row error.
 */
public final class TechnicalImportLookupsImpl implements TechnicalImportLookups {
  private static final String TAG_NOT_FOUND = "TD_REFERENCE_NOT_FOUND";
  private static final String TAG_AMBIGUOUS = "TD_REFERENCE_AMBIGUOUS";
  private static final int MAX_CACHED_TABLES = 500;

  private final String scope;
  private final TechnicalCdeReferenceResolver cdeResolver = new TechnicalCdeReferenceResolver();
  private Map<String, List<EntityReference>> tags;
  private Map<String, List<EntityReference>> teams;
  private Map<String, PublishedSnapshotRecord> cdes;
  private final Cache<String, List<TechnicalColumnSource>> tableColumns =
      Caffeine.newBuilder().maximumSize(MAX_CACHED_TABLES).build();

  public TechnicalImportLookupsImpl(String scope) {
    this.scope = scope;
  }

  @Override
  public String tag(String classification, String displayName) {
    if (tags == null) {
      tags = load(Entity.TAG);
    }
    final List<EntityReference> matches =
        tags.getOrDefault(normalize(displayName), List.of()).stream()
            .filter(reference -> reference.getFullyQualifiedName().startsWith(classification + "."))
            .toList();
    return unique(matches, classification, displayName).getFullyQualifiedName();
  }

  @Override
  public UUID team(String displayName) {
    if (teams == null) {
      teams = load(Entity.TEAM);
    }
    return unique(teams.getOrDefault(normalize(displayName), List.of()), Entity.TEAM, displayName)
        .getId();
  }

  @Override
  public TechnicalCdeInfo cde(String code) {
    final PublishedSnapshotRecord snapshot = loadCdes().get(code.toLowerCase(Locale.ROOT));
    if (snapshot == null) {
      throw new LookupException(
          TechnicalDictionaryErrors.CDE_SCOPE_NOT_ACTIVE,
          String.format(
              "CDE '%s' không phải CDE đã phê duyệt của Từ điển dữ liệu dùng chung phiên bản %s",
              code, scope));
    }
    return TechnicalCdeInfo.of(snapshot);
  }

  @Override
  public List<TechnicalColumnSource> columns(String database, String schema, String table) {
    return tableColumns.get(
        String.join("|", normalize(database), normalize(schema), normalize(table)),
        key ->
            TechnicalColumnIndex.columnsOfTable(database, schema, table).stream()
                .map(TechnicalColumnIndex.ColumnDocument::toSource)
                .toList());
  }

  @Override
  public TechnicalRecord rankHolder(String cdeId, int rank) {
    final String holderFqn = dao().findRankHolder(cdeId, rank, "");
    return holderFqn == null ? null : dao().findByColumnFqn(holderFqn);
  }

  private Map<String, PublishedSnapshotRecord> loadCdes() {
    if (cdes == null) {
      cdes = cdeResolver.activeCdesByCode(scope);
    }
    return cdes;
  }

  private static TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }

  private static Map<String, List<EntityReference>> load(String type) {
    final EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(type);
    final Include include = repository.supportsSoftDelete ? Include.NON_DELETED : Include.ALL;
    final Map<String, List<EntityReference>> index = new HashMap<>();
    for (EntityInterface entity :
        repository.listAll(repository.getFields("displayName"), new ListFilter(include))) {
      final String label =
          entity.getDisplayName() == null || entity.getDisplayName().isBlank()
              ? entity.getName()
              : entity.getDisplayName();
      index
          .computeIfAbsent(normalize(label), key -> new ArrayList<>())
          .add(entity.getEntityReference());
    }
    return index;
  }

  private static EntityReference unique(List<EntityReference> matches, String kind, String label) {
    if (matches.isEmpty()) {
      throw new LookupException(
          TAG_NOT_FOUND, String.format("Không tìm thấy %s '%s'", kind, label));
    }
    if (matches.size() > 1) {
      throw new LookupException(TAG_AMBIGUOUS, String.format("%s '%s' bị trùng tên", kind, label));
    }
    return matches.getFirst();
  }

  private static String normalize(String value) {
    return Normalizer.normalize(value.trim(), Normalizer.Form.NFKC).toLowerCase(Locale.ROOT);
  }
}
