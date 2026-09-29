/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TableType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.config.TechnicalDictionaryConfiguration;

/**
 * Column scope captured per catalog version. Only physical tables of explicitly included services
 * are catalogued; an empty service allowlist matches nothing.
 */
public record TechnicalColumnScope(
    List<String> includeServices,
    List<String> includeDatabases,
    List<String> includeSchemas,
    List<String> excludePatterns) {

  public TechnicalColumnScope {
    includeServices = List.copyOf(includeServices);
    includeDatabases = List.copyOf(includeDatabases);
    includeSchemas = List.copyOf(includeSchemas);
    excludePatterns = List.copyOf(excludePatterns);
  }

  public static TechnicalColumnScope fromConfiguration(TechnicalDictionaryConfiguration config) {
    final TechnicalDictionaryConfiguration source =
        config == null ? new TechnicalDictionaryConfiguration() : config;
    return new TechnicalColumnScope(
        csv(source.getIncludeServices()),
        csv(source.getIncludeDatabases()),
        csv(source.getIncludeSchemas()),
        csv(source.getExcludePatterns()));
  }

  public static TechnicalColumnScope fromJson(String json) {
    return JsonUtils.readValue(json, TechnicalColumnScope.class);
  }

  public String toJson() {
    return JsonUtils.pojoToJson(this);
  }

  @JsonIgnore
  public boolean isEmpty() {
    return includeServices.isEmpty();
  }

  public boolean matches(Table table) {
    return isCataloguedTableType(table)
        && contains(includeServices, name(table.getService()))
        && isNarrowedBy(includeDatabases, fqn(table.getDatabase()))
        && isNarrowedBy(includeSchemas, fqn(table.getDatabaseSchema()))
        && !isExcluded(table);
  }

  private static boolean isCataloguedTableType(Table table) {
    final TableType type = table.getTableType() == null ? TableType.Regular : table.getTableType();
    return !Boolean.TRUE.equals(table.getDeleted())
        && TechnicalDictionaryProfile.INCLUDED_TABLE_TYPES.contains(type);
  }

  private boolean isExcluded(Table table) {
    return excludePatterns.stream()
        .map(TechnicalColumnScope::globToPattern)
        .anyMatch(
            pattern ->
                pattern.matcher(table.getName()).matches()
                    || pattern.matcher(name(table.getDatabaseSchema())).matches());
  }

  private static boolean isNarrowedBy(List<String> allowlist, String value) {
    return allowlist.isEmpty() || contains(allowlist, value);
  }

  private static boolean contains(List<String> allowlist, String value) {
    return allowlist.stream().anyMatch(allowed -> allowed.equalsIgnoreCase(value));
  }

  private static String name(EntityReference reference) {
    return reference == null || reference.getName() == null ? "" : reference.getName();
  }

  private static String fqn(EntityReference reference) {
    return reference == null || reference.getFullyQualifiedName() == null
        ? ""
        : reference.getFullyQualifiedName();
  }

  static Pattern globToPattern(String glob) {
    final String regex =
        Arrays.stream(glob.split("\\*", -1))
            .map(Pattern::quote)
            .reduce((a, b) -> a + ".*" + b)
            .orElse("");
    return Pattern.compile(regex, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
  }

  private static List<String> csv(String value) {
    final List<String> result;
    if (nullOrEmpty(value)) {
      result = List.of();
    } else {
      result =
          Arrays.stream(value.split(","))
              .map(String::trim)
              .filter(item -> !item.isEmpty())
              .toList();
    }
    return result;
  }
}
