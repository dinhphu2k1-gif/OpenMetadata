/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

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

  /** A declared record at {@code core.dbo.<table>.<column>} of service ipcas, at revision 3. */
  static TechnicalRecord record(String table, String column) {
    return record(table, column, "ipcas");
  }

  static TechnicalRecord record(String table, String column, String service) {
    return TechnicalRecord.builder()
        .id(UUID.nameUUIDFromBytes((service + table + column).getBytes()).toString())
        .columnKey(UUID.nameUUIDFromBytes((table + column).getBytes()).toString())
        .columnFqn(service + ".core.dbo." + table + "." + column)
        .sourceService(service)
        .sourceDatabase("core")
        .sourceSchema("dbo")
        .sourceTable(table)
        .sourceColumn(column)
        .sourceStatus(TechnicalDictionaryProfile.SOURCE_AVAILABLE)
        .status(TechnicalRecord.STATUS_APPROVED)
        .revision(3)
        .build();
  }

  static TechnicalRecord withCde(TechnicalRecord record, int rank) {
    return record.toBuilder().cdeTermId(CDE_ID.toString()).rank(rank).build();
  }

  /** A physical Column of ipcas.core.dbo.<table> that no record declares yet. */
  static TechnicalColumnSource undeclared(String table, String column) {
    String fqn = "ipcas.core.dbo." + table + "." + column;
    return new TechnicalColumnSource(
        TechnicalColumnSource.columnKey(fqn),
        fqn,
        column,
        "Mô tả",
        TechnicalColumnSource.sourceExtension(fqn, "varchar(10)", 10, null, null));
  }

  static TechnicalRecordValidator validator() {
    return new TechnicalRecordValidator(
        new TechnicalRecordValidator.ReferenceLookup() {
          @Override
          public boolean tagExists(String tagFqn) {
            return true;
          }

          @Override
          public boolean teamExists(UUID teamId) {
            return true;
          }

          @Override
          public boolean userExists(UUID userId) {
            return true;
          }
        });
  }

  static TechnicalImportLookups lookups() {
    return lookups(Map.of(), List.of());
  }

  /**
   * Lookups that know one CDE, one Team and the tags whose display name is a known label.
   * {@code holders} maps {@code "<cde>#<rank>"} to the record that holds that rank.
   */
  static TechnicalImportLookups lookups(
      Map<String, TechnicalRecord> holders, List<TechnicalColumnSource> columns) {
    return new TechnicalImportLookups() {
      @Override
      public String tag(String classification, String displayName) {
        if (!"T+1".equals(displayName) && !"Dữ liệu nguyên tố".equals(displayName)) {
          throw new LookupException("TD_REFERENCE_NOT_FOUND", "Không tìm thấy tag " + displayName);
        }
        return classification + ("T+1".equals(displayName) ? ".T1" : ".AtomicDataElement");
      }

      @Override
      public UUID team(String displayName) {
        if (!"Ban KHCL".equals(displayName)) {
          throw new LookupException("TD_REFERENCE_NOT_FOUND", "Không tìm thấy Team " + displayName);
        }
        return TEAM_ID;
      }

      @Override
      public TechnicalCdeInfo cde(String code) {
        if (!"CDE1".equalsIgnoreCase(code)) {
          throw new LookupException(TechnicalDictionaryErrors.CDE_SCOPE_NOT_ACTIVE, "CDE " + code);
        }
        return new TechnicalCdeInfo(
            CDE_ID.toString(), "CDE1", "Tên", "1.0", "Data Dictionary.CDE1@v1", List.of());
      }

      @Override
      public List<TechnicalColumnSource> columns(String database, String schema, String table) {
        return columns;
      }

      @Override
      public TechnicalRecord rankHolder(String cdeId, int rank) {
        return holders.get(cdeId + "#" + rank);
      }
    };
  }
}
