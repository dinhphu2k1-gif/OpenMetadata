/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_AVAILABLE;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_COLUMN;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_COLUMN_FQN;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_DATABASE;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_DATA_LENGTH;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_DATA_TYPE;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_PRECISION;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_SCALE;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_SCHEMA;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_SERVICE;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_STATUS;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_TABLE;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SOURCE_UNAVAILABLE;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SURVIVORSHIP_RANK;
import static org.openmetadata.service.glossary.technical.TechnicalDictionaryProfile.SYSTEM_OWNER;

import java.util.List;
import org.openmetadata.schema.type.customProperties.EnumConfig;
import org.openmetadata.service.glossary.GovernedCustomPropertyBootstrap;
import org.openmetadata.service.glossary.GovernedCustomPropertyBootstrap.PropertyDefinition;

/** GlossaryTerm custom properties owned by the Technical Dictionary profile. */
public final class TechnicalDictionaryProperties {
  private static final String STRING = "string";
  private static final String INTEGER = "integer";

  private TechnicalDictionaryProperties() {}

  public static void ensureRegistered() {
    definitions().forEach(GovernedCustomPropertyBootstrap::ensure);
  }

  static List<PropertyDefinition> definitions() {
    return List.of(
        property(
            SURVIVORSHIP_RANK, "Thứ hạng", "Thứ tự ưu tiên của Column trong cùng CDE", INTEGER),
        new PropertyDefinition(
            SYSTEM_OWNER,
            "Chủ sở hữu hệ thống",
            "Đơn vị sở hữu hệ thống nguồn",
            "entityReference",
            List.of("team")),
        property(SOURCE_COLUMN_FQN, "FQN cột nguồn", "FQN Column tại thời điểm snapshot", STRING),
        property(SOURCE_SERVICE, "Nguồn", "Database service chứa Column", STRING),
        property(SOURCE_DATABASE, "Tên cơ sở dữ liệu", "Database chứa Column", STRING),
        property(SOURCE_SCHEMA, "Tên Schema", "Schema chứa Column", STRING),
        property(SOURCE_TABLE, "Tên Bảng", "Table chứa Column", STRING),
        property(SOURCE_COLUMN, "Tên cột", "Tên Column", STRING),
        property(SOURCE_DATA_TYPE, "Loại dữ liệu", "Kiểu dữ liệu của Column", STRING),
        property(SOURCE_DATA_LENGTH, "Độ dài", "Độ dài dữ liệu của Column", INTEGER),
        property(SOURCE_PRECISION, "Độ chính xác", "Precision của Column", INTEGER),
        property(SOURCE_SCALE, "Số chữ số thập phân", "Scale của Column", INTEGER),
        new PropertyDefinition(
            SOURCE_STATUS,
            "Tình trạng nguồn",
            "Column nguồn còn tồn tại trong metadata hay không",
            "enum",
            new EnumConfig()
                .withMultiSelect(false)
                .withValues(List.of(SOURCE_AVAILABLE, SOURCE_UNAVAILABLE))));
  }

  private static PropertyDefinition property(
      String name, String displayName, String description, String propertyType) {
    return new PropertyDefinition(name, displayName, description, propertyType, null);
  }
}
