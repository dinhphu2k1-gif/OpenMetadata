/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.WebApplicationException;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import org.openmetadata.service.glossary.technical.TechnicalImportLookups.LookupException;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.Field;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.ImportError;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.PlannedRow;
import org.openmetadata.service.glossary.technical.TechnicalImportPlan.RowPatch;

/**
 * Turns a parsed import sheet into row plans. Rows are matched to declared records by source
 * location, or declare the Column when it has no record yet; only columns present in the file are
 * applied, an empty cell clears the value, and ranks are checked on the final effective state of
 * approved records. Pending records are checked again if they are approved later.
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

  private final Map<String, List<TechnicalRecord>> recordsByLocation;
  private final Map<String, TechnicalRecordChangeRequest> changesByRecordId;
  private final TechnicalImportLookups lookups;
  private final TechnicalRecordValidator validator;

  public TechnicalImportPlanner(
      Map<String, List<TechnicalRecord>> recordsByLocation,
      TechnicalImportLookups lookups,
      TechnicalRecordValidator validator) {
    this(recordsByLocation, Map.of(), lookups, validator);
  }

  public TechnicalImportPlanner(
      Map<String, List<TechnicalRecord>> recordsByLocation,
      Map<String, TechnicalRecordChangeRequest> changesByRecordId,
      TechnicalImportLookups lookups,
      TechnicalRecordValidator validator) {
    this.recordsByLocation = recordsByLocation;
    this.changesByRecordId = changesByRecordId;
    this.lookups = lookups;
    this.validator = validator;
  }

  /** Indexes declared records by normalized source location. */
  public static Map<String, List<TechnicalRecord>> indexRecords(List<TechnicalRecord> records) {
    final Map<String, List<TechnicalRecord>> index = new HashMap<>();
    for (TechnicalRecord record : records) {
      index.computeIfAbsent(locationOf(record), key -> new ArrayList<>()).add(record);
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
    final List<Planned> planned = new ArrayList<>(sheet.rows().size());
    final Map<String, Integer> firstSeen = new HashMap<>();
    for (TechnicalImportSheet.Row row : sheet.rows()) {
      planned.add(planRow(row, firstSeen));
    }
    return new RankCheck(planned, lookups).run();
  }

  /** A planned row with the final values it leaves behind, needed by the rank check. */
  record Planned(PlannedRow row, TechnicalRecordValues finalValues, boolean effective) {}

  private Planned planRow(TechnicalImportSheet.Row row, Map<String, Integer> firstSeen) {
    final String location = locationOf(row);
    final List<ImportError> errors = new ArrayList<>();
    final Integer earlier = firstSeen.putIfAbsent(location, row.rowNumber());
    Target target = null;
    if (earlier != null) {
      errors.add(error(row, COLUMN, "DUPLICATE_ROW", "Cột đã xuất hiện ở dòng " + earlier));
    } else {
      target = matchTarget(row, location, errors);
    }
    final RowPatch patch = errors.isEmpty() ? buildPatch(row, errors) : null;
    return errors.isEmpty()
        ? decide(row, location, target, patch, errors)
        : failed(row, location, errors);
  }

  /** A declared record or a physical Column that the row will declare. */
  private record Target(TechnicalRecord record, TechnicalColumnSource column) {}

  private Target matchTarget(
      TechnicalImportSheet.Row row, String location, List<ImportError> errors) {
    final List<Target> candidates = new ArrayList<>();
    matchingService(row, recordsByLocation.getOrDefault(location, List.of()))
        .forEach(record -> candidates.add(new Target(record, null)));
    if (candidates.isEmpty()) {
      undeclaredCandidatesFor(row).forEach(column -> candidates.add(new Target(null, column)));
    }
    if (candidates.size() != 1) {
      errors.add(
          error(
              row,
              COLUMN,
              TechnicalDictionaryErrors.IMPORT_ROW_NOT_MATCHED,
              candidates.isEmpty()
                  ? "Không tìm thấy cột trong hệ thống nguồn"
                  : "Có nhiều hơn một cột khớp; hãy bổ sung cột Nguồn"));
    }
    return candidates.size() == 1 ? candidates.getFirst() : null;
  }

  /** Physical Columns at the row location that have no record yet; the import declares them. */
  private List<TechnicalColumnSource> undeclaredCandidatesFor(TechnicalImportSheet.Row row) {
    final String column = normalize(row.value(COLUMN));
    final String service = normalize(row.value(SERVICE));
    return lookups.columns(row.value(DATABASE), row.value(SCHEMA), row.value(TABLE)).stream()
        .filter(source -> column.equals(normalize(source.columnName())))
        .filter(
            source ->
                !row.has(SERVICE)
                    || service.isEmpty()
                    || service.equals(normalize(serviceOf(source))))
        .toList();
  }

  private static String serviceOf(TechnicalColumnSource source) {
    return String.valueOf(source.sourceExtension().get(TechnicalDictionaryProfile.SOURCE_SERVICE));
  }

  private static List<TechnicalRecord> matchingService(
      TechnicalImportSheet.Row row, List<TechnicalRecord> candidates) {
    final String service = normalize(row.value(SERVICE));
    return !row.has(SERVICE) || service.isEmpty()
        ? candidates
        : candidates.stream()
            .filter(candidate -> service.equals(normalize(candidate.sourceService())))
            .toList();
  }

  private RowPatch buildPatch(TechnicalImportSheet.Row row, List<ImportError> errors) {
    final Field<TechnicalCdeInfo> cde = resolve(row, CDE_CODE, errors, lookups::cde);
    final Field<Integer> rank = resolve(row, RANK, errors, TechnicalImportPlanner::parseRank);
    final Map<String, Field<String>> tags = new LinkedHashMap<>();
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

  private Planned decide(
      TechnicalImportSheet.Row row,
      String location,
      Target target,
      RowPatch patch,
      List<ImportError> errors) {
    final TechnicalRecordChangeRequest pending =
        target.record() == null ? null : changesByRecordId.get(target.record().id());
    if (target.record() != null
        && target.record().isApproved()
        && pending != null
        && pending.isInReview()) {
      errors.add(
          error(
              row,
              COLUMN,
              TechnicalDictionaryErrors.CHANGE_REQUEST_EXISTS,
              "Bản ghi đang có đề xuất chờ duyệt; Import không được ghi đè"));
      return failed(row, location, errors);
    }
    final TechnicalRecordValues current =
        target.record() == null
            ? TechnicalRecordValues.EMPTY
            : TechnicalRecordValues.of(target.record());
    final TechnicalRecordValues merged = TechnicalImportPatch.merge(current, patch);
    final String invalid = validationError(merged);
    Planned result;
    if (invalid != null) {
      errors.add(
          error(
              row,
              COLUMN,
              invalid.substring(0, invalid.indexOf('|')),
              invalid.substring(invalid.indexOf('|') + 1)));
      result = failed(row, location, errors);
    } else {
      result =
          new Planned(
              planned(row, location, target, patch, current, merged, pending),
              merged,
              target.record() != null && target.record().isApproved());
    }
    return result;
  }

  private PlannedRow planned(
      TechnicalImportSheet.Row row,
      String location,
      Target target,
      RowPatch patch,
      TechnicalRecordValues current,
      TechnicalRecordValues merged,
      TechnicalRecordChangeRequest pending) {
    final boolean unchanged = current.equals(merged);
    final boolean declared = target.record() != null;
    final String action =
        unchanged
            ? TechnicalImportPlan.NO_CHANGE
            : declared ? TechnicalImportPlan.UPDATE : TechnicalImportPlan.CREATE_RECORD;
    return new PlannedRow(
        row.rowNumber(),
        location,
        action,
        declared ? target.record().id() : null,
        declared ? target.record().revision() : null,
        pending == null ? null : pending.revision(),
        patch,
        target.column(),
        List.of(),
        new ArrayList<>());
  }

  /** {@code code|message} of the first value error, or null. */
  private String validationError(TechnicalRecordValues values) {
    String failure = null;
    try {
      validator.validate(values);
    } catch (WebApplicationException exception) {
      failure = TechnicalDictionaryErrors.codeOf(exception) + "|" + exception.getMessage();
    }
    return failure;
  }

  private static Planned failed(
      TechnicalImportSheet.Row row, String location, List<ImportError> errors) {
    return new Planned(
        new PlannedRow(
            row.rowNumber(),
            location,
            TechnicalImportPlan.ERROR,
            null,
            null,
            null,
            null,
            errors,
            new ArrayList<>()),
        TechnicalRecordValues.EMPTY,
        false);
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

  private static String locationOf(TechnicalRecord record) {
    return String.join(
        "|",
        normalize(record.sourceDatabase()),
        normalize(record.sourceSchema()),
        normalize(record.sourceTable()),
        normalize(record.sourceColumn()));
  }

  public static String normalize(String value) {
    return Normalizer.normalize(value == null ? "" : value.trim(), Normalizer.Form.NFKC)
        .toLowerCase(Locale.ROOT);
  }

  /**
   * A rank of a CDE may be held by one approved record only. The check is made on the effective
   * state the file leaves behind, so two approved records can swap ranks in one import while new or
   * resubmitted records wait for their approval-time check.
   */
  private static final class RankCheck {
    private final List<Planned> planned;
    private final TechnicalImportLookups lookups;
    private final Map<String, Planned> byRecordId = new HashMap<>();

    private RankCheck(List<Planned> planned, TechnicalImportLookups lookups) {
      this.planned = planned;
      this.lookups = lookups;
      planned.stream()
          .filter(item -> item.row().recordId() != null)
          .forEach(item -> byRecordId.put(item.row().recordId(), item));
    }

    private List<PlannedRow> run() {
      final Map<String, Integer> firstRowOfRank = new HashMap<>();
      final List<PlannedRow> result = new ArrayList<>(planned.size());
      for (Planned item : planned) {
        result.add(check(item, firstRowOfRank));
      }
      return result;
    }

    private PlannedRow check(Planned item, Map<String, Integer> firstRowOfRank) {
      final String key = rankKey(item.finalValues());
      PlannedRow row = item.row();
      if (item.effective() && key != null && !row.hasErrors()) {
        final Integer earlier = firstRowOfRank.putIfAbsent(key, row.rowNumber());
        final String conflict =
            earlier == null ? holderConflict(item) : "dòng " + earlier + " của file";
        row = conflict == null ? row : rankError(row, conflict);
      }
      return row;
    }

    private String holderConflict(Planned item) {
      final TechnicalRecord holder =
          item.row().mutates()
              ? lookups.rankHolder(item.finalValues().cde().toString(), item.finalValues().rank())
              : null;
      final boolean holdsAfterImport =
          holder != null
              && !Objects.equals(holder.id(), item.row().recordId())
              && keepsRank(holder, item.finalValues());
      return holdsAfterImport ? "cột " + holder.columnFqn() : null;
    }

    /** True unless the file changes the holder so it no longer has that CDE and rank. */
    private boolean keepsRank(TechnicalRecord holder, TechnicalRecordValues wanted) {
      final Planned inFile = byRecordId.get(holder.id());
      return inFile == null
          || (Objects.equals(inFile.finalValues().cde(), wanted.cde())
              && Objects.equals(inFile.finalValues().rank(), wanted.rank()));
    }

    private static String rankKey(TechnicalRecordValues values) {
      return values.cde() == null || values.rank() == null
          ? null
          : values.cde() + "#" + values.rank();
    }

    private static PlannedRow rankError(PlannedRow row, String holder) {
      return new PlannedRow(
          row.rowNumber(),
          row.location(),
          TechnicalImportPlan.ERROR,
          row.recordId(),
          row.expectedRevision(),
          row.expectedChangeRevision(),
          null,
          null,
          List.of(
              new ImportError(
                  row.rowNumber(),
                  RANK,
                  TechnicalDictionaryErrors.RANK_DUPLICATE,
                  "Thứ hạng đã được giữ bởi " + holder)),
          row.warnings());
    }
  }
}
