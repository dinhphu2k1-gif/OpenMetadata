/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.schema.type.DqTestSpecKind;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TestCaseParameterDataType;
import org.openmetadata.schema.type.TestDefinitionEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityRelationshipNotFoundException;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.ColumnRow;
import org.openmetadata.service.jdbi3.TestCaseRepository;
import org.openmetadata.service.jdbi3.TestDefinitionRepository;
import org.openmetadata.service.resources.dqtests.TestCaseMapper;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.FullyQualifiedName;

/** Creates, updates, retires and restores the OpenMetadata testcases and definitions of a Rule. */
@Slf4j
public final class DqTestCaseGateway {
  /** Stock rule-library validator: counts the records the SQL returns; 0 records means Success. */
  public static final String SQL_VALIDATOR_CLASS = "ColumnRuleLibrarySqlExpressionValidator";

  private static final String COLUMNS_FIELD = "columns";
  private static final TestCaseMapper TEST_CASE_MAPPER = new TestCaseMapper();

  private DqTestCaseGateway() {}

  /** The definition a declaration runs: the library one, or the managed SQL definition. */
  public static TestDefinition definitionOf(DqRuleContext rule, DqTestSpec spec) {
    return spec.getKind() == DqTestSpecKind.SQL
        ? ensureSqlDefinition(rule, spec)
        : Entity.getEntityByName(
            Entity.TEST_DEFINITION, spec.getTestDefinitionFqn(), "", Include.NON_DELETED);
  }

  /** Whether the Column's data type is accepted by the definition; unknown types are accepted. */
  public static boolean isApplicable(TestDefinition definition, ColumnRow column) {
    boolean applicable = true;
    if (!nullOrEmpty(definition.getSupportedDataTypes()) && column.dataType() != null) {
      final ColumnDataType type = dataTypeOf(column.dataType());
      applicable = type == null || definition.getSupportedDataTypes().contains(type);
    }
    return applicable;
  }

  public static TestCase upsert(
      DqRuleContext rule, DqTestSpec spec, TestDefinition definition, ColumnRow column) {
    final CreateTestCase create = createRequest(rule, spec, definition, column);
    final TestCase wanted = TEST_CASE_MAPPER.createToEntity(create, DqManagedWrite.ACTOR);
    wanted.setFullyQualifiedName(testCaseFqn(column, rule.testCaseName(spec.getKey())));
    return DqManagedWrite.run(() -> store(wanted));
  }

  public static TestCase find(String testCaseId) {
    return Entity.getEntity(Entity.TEST_CASE, UUID.fromString(testCaseId), "", Include.ALL);
  }

  /** Soft-deletes the testcase, keeping its results. A missing or already deleted one is ignored. */
  public static void retire(String testCaseId) {
    final TestCase testCase = findOrNull(testCaseId);
    if (testCase != null && !Boolean.TRUE.equals(testCase.getDeleted())) {
      DqManagedWrite.run(
          () -> repository().delete(DqManagedWrite.ACTOR, testCase.getId(), true, false));
    }
  }

  public static String testCaseFqn(ColumnRow column, String testCaseName) {
    return FullyQualifiedName.add(column.columnFqn(), testCaseName);
  }

  public static String entityLink(ColumnRow column) {
    final String[] parts = FullyQualifiedName.split(column.columnFqn());
    final String columnName = parts[parts.length - 1];
    final String tableFqn = FullyQualifiedName.getParentFQN(parts);
    return new EntityLink(Entity.TABLE, tableFqn, COLUMNS_FIELD, columnName, null).getLinkString();
  }

  public static List<TestCaseParameterValue> parameterValues(DqTestSpec spec) {
    return spec.getParameterValues() == null
        ? new ArrayList<>()
        : new ArrayList<>(spec.getParameterValues());
  }

  private static TestCase store(TestCase wanted) {
    final TestCase existing =
        repository().findByNameOrNull(wanted.getFullyQualifiedName(), Include.ALL);
    if (existing != null && Boolean.TRUE.equals(existing.getDeleted())) {
      repository().restoreEntity(DqManagedWrite.ACTOR, existing.getId());
    }
    if (existing == null) {
      // createOrUpdate does not prepare a new entity: this resolves its test suite and definition
      repository().prepareInternal(wanted, false);
    }
    try {
      repository().createOrUpdate(null, wanted, DqManagedWrite.ACTOR);
    } catch (EntityRelationshipNotFoundException brokenTestCase) {
      recreate(existing, wanted);
    }
    return repository().findByNameOrNull(wanted.getFullyQualifiedName(), Include.NON_DELETED);
  }

  /** An interrupted update can leave a testcase without its relationships; it is replaced. */
  private static void recreate(TestCase broken, TestCase wanted) {
    LOG.warn("Testcase {} lost its relationships; recreating it", wanted.getFullyQualifiedName());
    repository().delete(DqManagedWrite.ACTOR, broken.getId(), true, true);
    repository().prepareInternal(wanted, false);
    repository().createOrUpdate(null, wanted, DqManagedWrite.ACTOR);
  }

  private static CreateTestCase createRequest(
      DqRuleContext rule, DqTestSpec spec, TestDefinition definition, ColumnRow column) {
    return new CreateTestCase()
        .withName(rule.testCaseName(spec.getKey()))
        .withDisplayName(rule.testCaseDisplayName(spec))
        .withDescription(rule.description())
        .withEntityLink(entityLink(column))
        .withTestDefinition(definition.getFullyQualifiedName())
        .withParameterValues(parameterValues(spec))
        .withComputePassedFailedRowCount(computesRowCounts(rule, spec, definition));
  }

  /** Counts passed and failed rows whenever the definition can, so every result has a pass rate. */
  static boolean computesRowCounts(DqRuleContext rule, DqTestSpec spec, TestDefinition definition) {
    return Boolean.TRUE.equals(spec.getComputePassedFailedRowCount())
        || Boolean.TRUE.equals(definition.getSupportsRowLevelPassedFailed());
  }

  private static TestDefinition ensureSqlDefinition(DqRuleContext rule, DqTestSpec spec) {
    final TestDefinition wanted =
        new TestDefinition()
            .withId(UUID.randomUUID())
            .withName(rule.testDefinitionName(spec.getKey()))
            .withFullyQualifiedName(rule.testDefinitionName(spec.getKey()))
            .withDisplayName(rule.testCaseDisplayName(spec))
            .withDescription(rule.description())
            .withEntityType(TestDefinitionEntityType.COLUMN)
            .withTestPlatforms(List.of(TestPlatform.OPEN_METADATA))
            .withSqlExpression(spec.getSqlExpression())
            .withValidatorClass(SQL_VALIDATOR_CLASS)
            .withSupportsRowLevelPassedFailed(false)
            .withEnabled(true)
            .withParameterDefinition(extraParameters(spec))
            .withUpdatedBy(DqManagedWrite.ACTOR)
            .withUpdatedAt(System.currentTimeMillis());
    DqManagedWrite.run(() -> definitions().createOrUpdate(null, wanted, DqManagedWrite.ACTOR));
    return definitions().findByNameOrNull(wanted.getFullyQualifiedName(), Include.NON_DELETED);
  }

  private static List<TestCaseParameter> extraParameters(DqTestSpec spec) {
    final List<TestCaseParameter> parameters = new ArrayList<>();
    for (TestCaseParameterValue value : parameterValues(spec)) {
      parameters.add(
          new TestCaseParameter()
              .withName(value.getName())
              .withDisplayName(value.getName())
              .withDataType(TestCaseParameterDataType.STRING)
              .withRequired(true));
    }
    return parameters;
  }

  private static final Map<String, String> VENDOR_TYPE_ALIASES =
      Map.of(
          "VARCHAR2", "VARCHAR",
          "NVARCHAR2", "VARCHAR",
          "NVARCHAR", "VARCHAR",
          "NCHAR", "CHAR",
          "CLOB", "TEXT",
          "NCLOB", "TEXT");

  /** The type name without its length or precision, such as VARCHAR2 for "varchar2(20)". */
  private static ColumnDataType dataTypeOf(String dataType) {
    final String name = dataType.replaceAll("\\(.*\\)", "").trim().toUpperCase(Locale.ROOT);
    ColumnDataType type = null;
    try {
      type = ColumnDataType.fromValue(VENDOR_TYPE_ALIASES.getOrDefault(name, name));
    } catch (IllegalArgumentException ignored) {
      type = null;
    }
    return type;
  }

  private static TestCase findOrNull(String testCaseId) {
    TestCase testCase = null;
    if (testCaseId != null) {
      testCase = repository().find(UUID.fromString(testCaseId), Include.ALL);
    }
    return testCase;
  }

  private static TestCaseRepository repository() {
    return (TestCaseRepository) Entity.getEntityRepository(Entity.TEST_CASE);
  }

  private static TestDefinitionRepository definitions() {
    return (TestDefinitionRepository) Entity.getEntityRepository(Entity.TEST_DEFINITION);
  }

  static String json(Object value) {
    return JsonUtils.pojoToJson(value);
  }
}
