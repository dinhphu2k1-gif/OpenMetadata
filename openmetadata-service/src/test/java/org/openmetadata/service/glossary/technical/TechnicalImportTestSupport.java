/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TermRelation;

/** Builders shared by the Technical Dictionary import tests. */
final class TechnicalImportTestSupport {
  static final UUID CDE_ID = UUID.randomUUID();
  static final UUID TEAM_ID = UUID.randomUUID();

  private TechnicalImportTestSupport() {}

  static byte[] workbook(List<String> headers, List<List<String>> rows) {
    try (XSSFWorkbook workbook = new XSSFWorkbook();
        ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      Sheet sheet = workbook.createSheet("data");
      write(sheet.createRow(0), headers);
      for (int index = 0; index < rows.size(); index++) {
        write(sheet.createRow(index + 1), rows.get(index));
      }
      workbook.write(output);
      return output.toByteArray();
    } catch (IOException exception) {
      throw new IllegalStateException(exception);
    }
  }

  private static void write(Row row, List<String> values) {
    for (int index = 0; index < values.size(); index++) {
      row.createCell(index).setCellValue(values.get(index));
    }
  }

  static Map<String, Object> record(String table, String column, String status, String recordType) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("termId", UUID.nameUUIDFromBytes((table + column).getBytes()).toString());
    row.put("businessVersion", "1.0");
    row.put("recordType", recordType);
    row.put("entityStatus", status);
    row.put("workingRevision", 3);
    row.put(
        "extension",
        Map.of(
            TechnicalDictionaryProfile.SOURCE_DATABASE, "core",
            TechnicalDictionaryProfile.SOURCE_SCHEMA, "dbo",
            TechnicalDictionaryProfile.SOURCE_TABLE, table,
            TechnicalDictionaryProfile.SOURCE_COLUMN, column,
            TechnicalDictionaryProfile.SOURCE_SERVICE, "ipcas"));
    return row;
  }

  static TagLabel tag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  static TermRelation relation(UUID cde) {
    return new TermRelation().withTerm(new EntityReference().withId(cde).withType("glossaryTerm"));
  }

  /** Lookups that know one CDE, one Team and the tags whose display name is a known label. */
  static TechnicalImportLookups lookups() {
    return new TechnicalImportLookups() {
      @Override
      public TagLabel tag(String classification, String displayName) {
        if (!"T+1".equals(displayName) && !"Dữ liệu nguyên tố".equals(displayName)) {
          throw new LookupException("TD_REFERENCE_NOT_FOUND", "Không tìm thấy tag " + displayName);
        }
        return TechnicalImportTestSupport.tag(
            classification + ("T+1".equals(displayName) ? ".T1" : ".AtomicDataElement"));
      }

      @Override
      public EntityReference team(String displayName) {
        if (!"Ban KHCL".equals(displayName)) {
          throw new LookupException("TD_REFERENCE_NOT_FOUND", "Không tìm thấy Team " + displayName);
        }
        return new EntityReference().withId(TEAM_ID).withType("team").withName("khcl");
      }

      @Override
      public TermRelation cde(String code) {
        if (!"CDE1".equalsIgnoreCase(code)) {
          throw new LookupException("TD_CDE_SCOPE_MISMATCH", "CDE không hợp lệ " + code);
        }
        return relation(CDE_ID);
      }
    };
  }
}
