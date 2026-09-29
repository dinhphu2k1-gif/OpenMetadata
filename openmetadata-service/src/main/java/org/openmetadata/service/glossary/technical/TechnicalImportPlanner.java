/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import jakarta.ws.rs.BadRequestException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.glossary.technical.TechnicalImportLookups.LookupException;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.Field;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.ImportError;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.PlannedRow;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.RowPatch;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.UpdatePolicy;

/**
 * Turns a parsed import sheet into row plans. Rows are matched to existing records by source
 * location; only columns present in the file are applied, and an empty cell clears the value.
 */
public final class TechnicalImportPlanner {
  public static final String DATABASE = "Tên cơ sở dữ liệu";
  public static final String SCHEMA = "Tên Schema";
  public static final String TABLE = "Tên Bảng";
  public static final String COLUMN = "Tên cột";
  public static final String SERVICE = "Nguồn";
  public static final String CDE_CODE = "Mã CDE quy chiếu";
  public static final String RANK = "Thứ hạng";
  public static final String ELEMENT_TYPE = "Loại thành tố";
  public static final String GENERATION_TYPE = "Loại trường dữ liệu";
  public static final String CREATION_METHOD = "Phương thức tạo";
  public static final String TIMELINESS = "Thời gian";
  public static final String SYSTEM_OWNER = "Chủ sở hữu hệ thống";

  static final List<String> LOCATION_HEADERS = List.of(DATABASE, SCHEMA, TABLE, COLUMN);
  static final Map<String, String> TAG_HEADERS = tagHeaders();
  private static final List<String> EDITABLE_HEADERS =
      List.of(
          CDE_CODE, RANK, ELEMENT_TYPE, GENERATION_TYPE, CREATION_METHOD, TIMELINESS, SYSTEM_OWNER);

  private static Map<String, String> tagHeaders() {
    final Map<String, String> headers = new LinkedHashMap<>();
    headers.put(ELEMENT_TYPE, TechnicalDictionaryProfile.ELEMENT_TYPE_CLASSIFICATION);
    headers.put(GENERATION_TYPE, TechnicalDictionaryProfile.GENERATION_TYPE_CLASSIFICATION);
    headers.put(CREATION_METHOD, TechnicalDictionaryProfile.CREATION_METHOD_CLASSIFICATION);
    headers.put(TIMELINESS, TechnicalDictionaryProfile.TIMELINESS_CLASSIFICATION);
    return headers;
  }

  private final Map<String, List<Map<String, Object>>> rowsByLocation;
  private final TechnicalImportLookups lookups;
  private final UpdatePolicy policy;

  public TechnicalImportPlanner(
      Map<String, List<Map<String, Object>>> rowsByLocation,
      TechnicalImportLookups lookups,
      UpdatePolicy policy) {
    this.rowsByLocation = rowsByLocation;
    this.lookups = lookups;
    this.policy = policy;
  }

  /** Indexes the latest visible row of every record by normalized source location. */
  public static Map<String, List<Map<String, Object>>> indexRows(
      List<Map<String, Object>> latestRows) {
    final Map<String, List<Map<String, Object>>> index = new HashMap<>();
    for (Map<String, Object> row : latestRows) {
      index.computeIfAbsent(locationOf(row), key -> new ArrayList<>()).add(row);
    }
    return index;
  }

  public static void requireHeaders(List<String> headers) {
    final List<String> missing =
        LOCATION_HEADERS.stream().filter(header -> !headers.contains(header)).toList();
    if (!missing.isEmpty()) {
      throw new BadRequestException("Missing required columns: " + String.join(", ", missing));
    }
    if (EDITABLE_HEADERS.stream().noneMatch(headers::contains)) {
      throw new BadRequestException("The file has no editable column to import");
    }
  }

  public List<PlannedRow> plan(TechnicalImportSheet sheet) {
    requireHeaders(sheet.headers());
    final List<PlannedRow> planned = new ArrayList<>(sheet.rows().size());
    final Map<String, Integer> firstSeen = new HashMap<>();
    for (TechnicalImportSheet.Row row : sheet.rows()) {
      planned.add(planRow(row, firstSeen));
    }
    return warnDuplicateRanks(planned);
  }

  private PlannedRow planRow(TechnicalImportSheet.Row row, Map<String, Integer> firstSeen) {
    final String location = locationOf(row);
    final List<ImportError> errors = new ArrayList<>();
    final Integer earlier = firstSeen.putIfAbsent(location, row.rowNumber());
    final Map<String, Object> target = earlier == null ? matchTarget(row, location, errors) : null;
    if (earlier != null) {
      errors.add(error(row, COLUMN, "DUPLICATE_ROW", "Cột đã xuất hiện ở dòng " + earlier));
    }
    final RowPatch patch = errors.isEmpty() ? buildPatch(row, errors) : null;
    return errors.isEmpty() ? decide(row, location, target, patch) : failed(row, location, errors);
  }

  private Map<String, Object> matchTarget(
      TechnicalImportSheet.Row row, String location, List<ImportError> errors) {
    final List<Map<String, Object>> candidates = candidatesFor(row, location);
    if (candidates.size() != 1) {
      errors.add(
          error(
              row,
              COLUMN,
              TechnicalDictionaryErrors.IMPORT_ROW_NOT_MATCHED,
              candidates.isEmpty()
                  ? "Không tìm thấy cột trong Từ điển kỹ thuật"
                  : "Có nhiều hơn một cột khớp; hãy bổ sung cột Nguồn"));
    }
    return candidates.size() == 1 ? candidates.getFirst() : null;
  }

  private List<Map<String, Object>> candidatesFor(TechnicalImportSheet.Row row, String location) {
    final List<Map<String, Object>> byLocation = rowsByLocation.getOrDefault(location, List.of());
    final String service = normalize(row.value(SERVICE));
    return !row.has(SERVICE) || service.isEmpty()
        ? byLocation
        : byLocation.stream()
            .filter(
                candidate ->
                    service.equals(
                        normalize(
                            TechnicalRowFields.extensionText(
                                candidate, TechnicalDictionaryProfile.SOURCE_SERVICE))))
            .toList();
  }

  private RowPatch buildPatch(TechnicalImportSheet.Row row, List<ImportError> errors) {
    final Field<TermRelation> cde = resolve(row, CDE_CODE, errors, lookups::cde);
    final Field<Integer> rank = resolve(row, RANK, errors, TechnicalImportPlanner::parseRank);
    final Map<String, Field<TagLabel>> tags = new LinkedHashMap<>();
    TAG_HEADERS.forEach(
        (header, classification) ->
            tags.put(
                classification,
                resolve(row, header, errors, value -> lookups.tag(classification, value))));
    return new RowPatch(cde, rank, tags, resolve(row, SYSTEM_OWNER, errors, lookups::team));
  }

  private static <T> Field<T> resolve(
      TechnicalImportSheet.Row row,
      String header,
      List<ImportError> errors,
      Function<String, T> resolver) {
    Field<T> field = Field.absent();
    if (row.has(header)) {
      final String value = row.value(header);
      try {
        field = value.isBlank() ? Field.of(null) : Field.of(resolver.apply(value));
      } catch (LookupException exception) {
        errors.add(error(row, header, exception.code(), exception.getMessage()));
      }
    }
    return field;
  }

  private static Integer parseRank(String value) {
    try {
      final double parsed = Double.parseDouble(value);
      if (parsed != Math.rint(parsed)
          || parsed < TechnicalDictionaryProfile.MIN_RANK
          || parsed > TechnicalDictionaryProfile.MAX_RANK) {
        throw new NumberFormatException(value);
      }
      return (int) parsed;
    } catch (NumberFormatException exception) {
      throw new LookupException(
          TechnicalDictionaryErrors.INVALID_FIELD,
          String.format(
              "Thứ hạng phải là số nguyên từ %d đến %d",
              TechnicalDictionaryProfile.MIN_RANK, TechnicalDictionaryProfile.MAX_RANK));
    }
  }

  private PlannedRow decide(
      TechnicalImportSheet.Row row, String location, Map<String, Object> target, RowPatch patch) {
    final String status = TechnicalRowFields.text(target, "entityStatus");
    final boolean working = "working".equals(target.get("recordType"));
    final String action =
        isNoChange(target, patch) ? TechnicalImportPlan.NO_CHANGE : actionFor(working, status);
    final List<String> warnings = new ArrayList<>();
    if (TechnicalImportPlan.SKIP.equals(action)) {
      warnings.add(
          "Bản ghi ở trạng thái " + status + " nên không được cập nhật với chính sách hiện tại");
    }
    return new PlannedRow(
        row.rowNumber(),
        location,
        action,
        UUID.fromString(String.valueOf(target.get("termId"))),
        working ? ((Number) target.get("workingRevision")).longValue() : null,
        working ? null : String.valueOf(target.get("businessVersion")),
        working ? null : nextMinor(String.valueOf(target.get("businessVersion"))),
        patch,
        List.of(),
        warnings);
  }

  private String actionFor(boolean working, String status) {
    final boolean all = policy == UpdatePolicy.ALL_EDITABLE;
    final String action;
    if (working && "Draft".equals(status)) {
      action = TechnicalImportPlan.UPDATE_DRAFT;
    } else if (working && "In Review".equals(status)) {
      action = all ? TechnicalImportPlan.REPLACE_IN_REVIEW_AND_REOPEN : TechnicalImportPlan.SKIP;
    } else if (working) {
      action = all ? TechnicalImportPlan.REPLACE_REJECTED_AND_REOPEN : TechnicalImportPlan.SKIP;
    } else {
      action = all ? TechnicalImportPlan.CREATE_VERSION : TechnicalImportPlan.SKIP;
    }
    return action;
  }

  static boolean isNoChange(Map<String, Object> current, RowPatch patch) {
    return same(
            patch.cde(),
            TechnicalRowFields.cdeId(current),
            relation -> relation.getTerm().getId().toString())
        && same(patch.rank(), currentRank(current), rank -> rank)
        && same(
            patch.systemOwner(),
            TechnicalRowFields.systemOwnerId(current),
            owner -> owner.getId().toString())
        && patch.tags().entrySet().stream()
            .allMatch(
                entry ->
                    same(
                        entry.getValue(),
                        currentTag(current, entry.getKey()),
                        TagLabel::getTagFQN));
  }

  private static <T, V> boolean same(Field<T> field, V current, Function<T, V> key) {
    return !field.specified()
        || Objects.equals(field.value() == null ? null : key.apply(field.value()), current);
  }

  private static Integer currentRank(Map<String, Object> row) {
    return TechnicalRecordValidator.rank(TechnicalRowFields.extension(row));
  }

  private static String currentTag(Map<String, Object> row, String classification) {
    String result = null;
    if (row.get("tags") instanceof List<?> tags) {
      for (Object raw : tags) {
        if (raw instanceof Map<?, ?> tag
            && String.valueOf(tag.get("tagFQN")).startsWith(classification + ".")) {
          result = String.valueOf(tag.get("tagFQN"));
        }
      }
    }
    return result;
  }

  private static List<PlannedRow> warnDuplicateRanks(List<PlannedRow> planned) {
    final Map<String, Long> counts = new HashMap<>();
    planned.stream()
        .map(TechnicalImportPlanner::rankKey)
        .filter(Objects::nonNull)
        .forEach(key -> counts.merge(key, 1L, Long::sum));
    final List<PlannedRow> result = new ArrayList<>(planned.size());
    for (PlannedRow row : planned) {
      final String key = rankKey(row);
      if (key != null && counts.get(key) > 1) {
        row.warnings().add("Thứ hạng bị trùng trong file cho cùng một CDE");
      }
      result.add(row);
    }
    return result;
  }

  private static String rankKey(PlannedRow row) {
    final RowPatch patch = row.patch();
    final boolean ranked =
        patch != null
            && patch.rank().specified()
            && patch.rank().value() != null
            && patch.cde().specified()
            && patch.cde().value() != null;
    return ranked ? patch.cde().value().getTerm().getId() + "#" + patch.rank().value() : null;
  }

  private static PlannedRow failed(
      TechnicalImportSheet.Row row, String location, List<ImportError> errors) {
    return new PlannedRow(
        row.rowNumber(),
        location,
        TechnicalImportPlan.ERROR,
        null,
        null,
        null,
        null,
        null,
        errors,
        new ArrayList<>());
  }

  static String nextMinor(String businessVersion) {
    final String[] parts = businessVersion.split("\\.");
    return parts[0] + "." + (Long.parseLong(parts[1]) + 1);
  }

  private static ImportError error(
      TechnicalImportSheet.Row row, String column, String code, String message) {
    return new ImportError(row.rowNumber(), column, code, message);
  }

  private static String locationOf(TechnicalImportSheet.Row row) {
    return String.join(
        "|",
        normalize(row.value(DATABASE)),
        normalize(row.value(SCHEMA)),
        normalize(row.value(TABLE)),
        normalize(row.value(COLUMN)));
  }

  private static String locationOf(Map<String, Object> record) {
    return String.join(
        "|",
        normalize(
            TechnicalRowFields.extensionText(record, TechnicalDictionaryProfile.SOURCE_DATABASE)),
        normalize(
            TechnicalRowFields.extensionText(record, TechnicalDictionaryProfile.SOURCE_SCHEMA)),
        normalize(
            TechnicalRowFields.extensionText(record, TechnicalDictionaryProfile.SOURCE_TABLE)),
        normalize(
            TechnicalRowFields.extensionText(record, TechnicalDictionaryProfile.SOURCE_COLUMN)));
  }

  static String normalize(String value) {
    return Normalizer.normalize(value == null ? "" : value.trim(), Normalizer.Form.NFKC)
        .toLowerCase(Locale.ROOT);
  }
}
