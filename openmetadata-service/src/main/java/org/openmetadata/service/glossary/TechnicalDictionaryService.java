/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary;

import static org.openmetadata.service.Entity.GLOSSARY;
import static org.openmetadata.service.Entity.GLOSSARY_TERM;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.ColumnBindingRecord;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO.ScopeRecord;
import org.openmetadata.service.util.FullyQualifiedName;

/** Scope-aware application service for the Technical Dictionary governed glossary profile. */
public class TechnicalDictionaryService {
  private static final String DATA_DICTIONARY = "Data Dictionary";
  private final GlossaryVersioningService versions = new GlossaryVersioningService();

  public List<ScopeRecord> listScopes() {
    return dao().listScopes(technicalGlossary().getId());
  }

  public ScopeRecord getScope(UUID scopeId) {
    ScopeRecord scope = dao().findScope(scopeId);
    if (scope == null || !technicalGlossary().getId().equals(scope.technicalGlossaryId())) {
      throw error(Response.Status.NOT_FOUND, "SCOPE_NOT_FOUND", "Technical scope was not found");
    }
    return scope;
  }

  public ScopeRecord createScope(UUID dataDictionaryVersionId, String actor) {
    if (dataDictionaryVersionId == null) {
      throw new BadRequestException("dataDictionaryVersionId is required");
    }
    Glossary technical = technicalGlossary();
    WorkingVersionRecord technicalWorking =
        versions.getWorking(GlossaryVersioningService.GLOSSARY, technical.getId());
    PublishedSnapshotRecord dictionarySnapshot =
        Entity.getJdbi().onDemand(GlossaryVersionDAO.class).findSnapshot(dataDictionaryVersionId);
    if (dictionarySnapshot == null
        || !GlossaryVersioningService.GLOSSARY.equals(dictionarySnapshot.entityType())
        || dictionarySnapshot.archivedAt() != null) {
      throw error(
          Response.Status.CONFLICT,
          "SCOPE_VERSION_MISMATCH",
          "The bound Data Dictionary version is not an active published snapshot");
    }
    Glossary dictionary =
        Entity.getEntity(GLOSSARY, dictionarySnapshot.entityId(), "id,name", Include.ALL);
    if (!DATA_DICTIONARY.equals(dictionary.getName())) {
      throw error(
          Response.Status.CONFLICT,
          "SCOPE_MISMATCH",
          "The bound version does not belong to Data Dictionary");
    }
    UUID scopeId = UUID.randomUUID();
    try {
      dao().insertScope(
          scopeId,
          technical.getId(),
          technicalWorking.workingId(),
          technicalWorking.businessVersion(),
          dictionary.getId(),
          dictionarySnapshot.snapshotId(),
          dictionarySnapshot.businessVersion(),
          System.currentTimeMillis(),
          actor);
    } catch (org.jdbi.v3.core.statement.UnableToExecuteStatementException exception) {
      throw error(
          Response.Status.CONFLICT,
          "SCOPE_VERSION_MISMATCH",
          "A Technical or Data Dictionary version is already bound to a scope");
    }
    org.openmetadata.service.util.AsyncService.getInstance()
        .execute(() -> bootstrap(scopeId, actor));
    return getScope(scopeId);
  }

  /** Idempotently establishes one technical identity and N.0 working row for every Column. */
  public void bootstrap(UUID scopeId, String actor) {
    ScopeRecord scope = requireBuilding(scopeId);
    List<ColumnSource> columns = loadColumns();
    long processed = 0;
    long failed = 0;
    for (ColumnSource source : columns) {
      try {
        createInitialRecord(scope, source, actor);
        processed++;
      } catch (RuntimeException exception) {
        failed++;
      }
      dao().updateBootstrapProgress(
          scopeId, columns.size(), processed, failed, System.currentTimeMillis(), actor);
    }
    if (failed == 0 && dao().activateScope(scopeId, System.currentTimeMillis(), actor) != 1) {
      throw error(
          Response.Status.CONFLICT,
          "SCOPE_VERSION_MISMATCH",
          "Technical scope could not be activated after bootstrap");
    }
  }

  public ScopeRecord archive(UUID scopeId, long expectedRevision, String actor) {
    getScope(scopeId);
    if (dao().archiveScope(scopeId, expectedRevision, System.currentTimeMillis(), actor) != 1) {
      throw error(
          Response.Status.CONFLICT,
          "WORKING_REVISION_CONFLICT",
          "Technical scope changed before it could be archived");
    }
    return getScope(scopeId);
  }

  public List<RecordView> listRecords(
      UUID scopeId, String search, String status, boolean allVersions, boolean includeWorking) {
    ScopeRecord scope = getScope(scopeId);
    String needle = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
    List<RecordView> rows = new ArrayList<>();
    GlossaryVersionDAO versionDao = Entity.getJdbi().onDemand(GlossaryVersionDAO.class);
    for (ColumnBindingRecord binding : dao().listColumnBindings(scopeId)) {
      boolean hasWorking = false;
      if (includeWorking) {
        WorkingVersionRecord working =
            versionDao.findWorking(
                GlossaryVersioningService.GLOSSARY_TERM,
                binding.recordId(),
                scope.technicalBusinessVersion());
        if (working != null) {
          rows.add(view(scope, binding, working));
          hasWorking = true;
        }
      }
      List<PublishedSnapshotRecord> published =
          versionDao.listPublished(GlossaryVersioningService.GLOSSARY_TERM, binding.recordId()).stream()
              .filter(row -> scope.technicalBusinessVersion().equals(row.parentBusinessVersion()))
              .sorted(Comparator.comparing(PublishedSnapshotRecord::publicationSequence).reversed())
              .toList();
      if (!published.isEmpty() && (!hasWorking || allVersions)) {
        if (allVersions) {
          published.forEach(row -> rows.add(view(scope, binding, row)));
        } else {
          rows.add(view(scope, binding, published.get(0)));
        }
      }
    }
    return rows.stream()
        .filter(row -> status == null || status.isBlank() || status.equalsIgnoreCase(row.status()))
        .filter(row -> needle.isEmpty() || JsonUtils.pojoToJson(row).toLowerCase(Locale.ROOT).contains(needle))
        .sorted(Comparator.comparing(RecordView::columnFqn))
        .toList();
  }

  public Map<String, Long> stats(UUID scopeId, boolean includeWorking) {
    List<RecordView> rows = listRecords(scopeId, null, null, false, includeWorking);
    long mapped = rows.stream().filter(row -> row.cdeSnapshotId() != null).count();
    long tables =
        rows.stream()
            .map(row -> sourceValue(row, "tableFqn"))
            .filter(value -> !value.isBlank())
            .distinct()
            .count();
    long sources =
        rows.stream()
            .map(row -> sourceReferenceName(row, "service"))
            .filter(value -> !value.isBlank())
            .distinct()
            .count();
    return Map.of(
        "totalColumns", (long) dao().listColumnBindings(scopeId).size(),
        "totalTables", tables,
        "totalSources", sources,
        "visibleRecords", (long) rows.size(),
        "mappedCde", mapped,
        "unmappedCde", rows.size() - mapped);
  }

  private static String sourceValue(RecordView row, String key) {
    Object extension = row.payload().get("extension");
    if (!(extension instanceof Map<?, ?> extensionMap)
        || !(extensionMap.get("source") instanceof Map<?, ?> source)) {
      return "";
    }
    return source.get(key) == null ? "" : String.valueOf(source.get(key));
  }

  private static String sourceReferenceName(RecordView row, String key) {
    Object extension = row.payload().get("extension");
    if (!(extension instanceof Map<?, ?> extensionMap)
        || !(extensionMap.get("source") instanceof Map<?, ?> source)
        || !(source.get(key) instanceof Map<?, ?> reference)) {
      return "";
    }
    Object name = reference.get("name");
    return name == null ? "" : String.valueOf(name);
  }

  public List<CdeOption> cdeOptions(UUID scopeId, String search, int limit, int offset) {
    ScopeRecord scope = getScope(scopeId);
    String needle = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
    List<CdeOption> options =
        Entity.getJdbi()
            .onDemand(GlossaryVersionDAO.class)
            .listActiveLatestTermsForGlossaryAndParent(
                scope.dataDictionaryGlossaryId(), scope.dataDictionaryBusinessVersion())
            .stream()
            .map(
                snapshot -> {
                  GlossaryTerm term = JsonUtils.readValue(snapshot.payload(), GlossaryTerm.class);
                  return new CdeOption(
                      term.getId(), snapshot.snapshotId(), snapshot.businessVersion(),
                      scope.dataDictionaryBusinessVersion(), scope.dataDictionaryVersionId(),
                      term.getName(), term.getDisplayName());
                })
            .filter(option -> needle.isEmpty() || JsonUtils.pojoToJson(option).toLowerCase(Locale.ROOT).contains(needle))
            .sorted(Comparator.comparing(CdeOption::code))
            .toList();
    int from = Math.min(Math.max(0, offset), options.size());
    int to = Math.min(from + Math.max(1, Math.min(limit, 100)), options.size());
    return options.subList(from, to);
  }

  private void createInitialRecord(ScopeRecord scope, ColumnSource source, String actor) {
    UUID columnId =
        UUID.nameUUIDFromBytes((scope.scopeId() + ":" + source.columnFqn()).getBytes(StandardCharsets.UTF_8));
    if (dao().findColumnBinding(scope.scopeId(), columnId) != null) {
      return;
    }
    UUID recordId = UUID.nameUUIDFromBytes((scope.scopeId() + ":record:" + columnId).getBytes(StandardCharsets.UTF_8));
    ColumnBindingRecord existingRecord = dao().findRecordBinding(scope.scopeId(), recordId);
    if (existingRecord != null) {
      return;
    }
    Glossary technical = technicalGlossary();
    EntityReference glossaryRef =
        new EntityReference()
            .withId(technical.getId())
            .withType(GLOSSARY)
            .withName(technical.getName())
            .withFullyQualifiedName(technical.getFullyQualifiedName());
    Map<String, Object> extension = new LinkedHashMap<>();
    extension.put("technicalDictionarySchemaVersion", 1);
    extension.put("scopeId", scope.scopeId());
    extension.put("columnId", columnId);
    extension.put("source", source.snapshot());
    GlossaryTerm term =
        new GlossaryTerm()
            .withId(recordId)
            .withName("td_" + recordId.toString().replace("-", ""))
            .withDisplayName(source.columnName())
            .withDescription("")
            .withGlossary(glossaryRef)
            .withEntityStatus(EntityStatus.DRAFT)
            .withProvider(ProviderType.SYSTEM)
            .withDeleted(false)
            .withExtension(extension);
    GlossaryTermRepository repository =
        (GlossaryTermRepository) Entity.getEntityRepository(GLOSSARY_TERM);
    try {
      repository.createInitialDraft(term, scope.technicalBusinessVersion(), actor);
    } catch (org.jdbi.v3.core.statement.UnableToExecuteStatementException exception) {
      // A deterministic record identity may have been committed before a retry established binding.
    }
    dao().insertColumnBinding(
        scope.scopeId(), recordId, columnId, source.columnFqn(), System.currentTimeMillis(), actor);
  }

  private List<ColumnSource> loadColumns() {
    List<ColumnSource> result = new ArrayList<>();
    for (String tableJson : dao().listTableJson()) {
      Table table = JsonUtils.readValue(tableJson, Table.class);
      flatten(table, table.getColumns(), result);
    }
    return result;
  }

  private static void flatten(Table table, List<Column> columns, List<ColumnSource> result) {
    if (columns == null) {
      return;
    }
    for (Column column : columns) {
      String fqn = column.getFullyQualifiedName();
      if (fqn != null) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("service", table.getService());
        snapshot.put("database", table.getDatabase());
        snapshot.put("schema", table.getDatabaseSchema());
        snapshot.put("tableId", table.getId());
        snapshot.put("tableName", table.getName());
        snapshot.put("tableFqn", table.getFullyQualifiedName());
        snapshot.put("columnName", column.getName());
        snapshot.put("columnFqn", fqn);
        snapshot.put("dataType", column.getDataType());
        snapshot.put("displayType", column.getDataTypeDisplay());
        snapshot.put("length", column.getDataLength());
        snapshot.put("precision", column.getPrecision());
        snapshot.put("scale", column.getScale());
        result.add(new ColumnSource(column.getName(), fqn, snapshot));
      }
      flatten(table, column.getChildren(), result);
    }
  }

  private RecordView view(ScopeRecord scope, ColumnBindingRecord binding, WorkingVersionRecord row) {
    return view(scope, binding, row.businessVersion(), row.entityStatus(), row.revision(), null, row.payload());
  }

  private RecordView view(ScopeRecord scope, ColumnBindingRecord binding, PublishedSnapshotRecord row) {
    return view(scope, binding, row.businessVersion(), "Approved", null, row.snapshotId(), row.payload());
  }

  private RecordView view(
      ScopeRecord scope,
      ColumnBindingRecord binding,
      String businessVersion,
      String status,
      Long revision,
      UUID snapshotId,
      String payloadJson) {
    Map<String, Object> payload = JsonUtils.readValue(payloadJson, new com.fasterxml.jackson.core.type.TypeReference<>() {});
    UUID cdeSnapshotId = null;
    Object related = payload.get("relatedTerms");
    if (related instanceof List<?> relations && !relations.isEmpty()) {
      Object context = ((Map<?, ?>) relations.get(0)).get("versionContext");
      if (context instanceof Map<?, ?> map && map.get("snapshotId") != null) {
        cdeSnapshotId = UUID.fromString(String.valueOf(map.get("snapshotId")));
      }
    }
    return new RecordView(
        binding.recordId(), scope.scopeId(), binding.columnId(), binding.columnFqnSnapshot(),
        binding.sourceAvailable(), businessVersion, status, revision, snapshotId, cdeSnapshotId, payload);
  }

  private ScopeRecord requireBuilding(UUID scopeId) {
    ScopeRecord scope = getScope(scopeId);
    if (!"Building".equals(scope.scopeStatus())) {
      throw error(Response.Status.CONFLICT, "SCOPE_NOT_ACTIVE", "Scope is not Building");
    }
    return scope;
  }

  private Glossary technicalGlossary() {
    return Entity.getJdbi()
        .onDemand(CollectionDAO.class)
        .glossaryDAO()
        .findEntityByName(
            FullyQualifiedName.quoteName(
                GovernedGlossaryProfileRegistry.Profile.TECHNICAL_DICTIONARY.glossaryName()),
            Include.ALL);
  }

  private TechnicalDictionaryDAO dao() {
    return Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
  }

  public static WebApplicationException error(Response.Status status, String code, String message) {
    return new WebApplicationException(
        Response.status(status).entity(Map.of("code", code, "message", message)).build());
  }

  private record ColumnSource(String columnName, String columnFqn, Map<String, Object> snapshot) {}

  public record RecordView(
      UUID recordId,
      UUID scopeId,
      UUID columnId,
      String columnFqn,
      boolean sourceAvailable,
      String businessVersion,
      String status,
      Long workingRevision,
      UUID snapshotId,
      UUID cdeSnapshotId,
      Map<String, Object> payload) {}

  public record CdeOption(
      UUID termId,
      UUID snapshotId,
      String businessVersion,
      String parentBusinessVersion,
      UUID dataDictionaryVersionId,
      String code,
      String name) {}
}
