/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.schema.type.DqTestSpecKind;
import org.openmetadata.schema.type.DqTestSpecs;
import org.openmetadata.schema.type.TestDefinitionEntityType;

class DqTestSpecValidatorTest {
  private static final String SQL =
      "SELECT {{ column_name }} FROM {{ table_name }} WHERE {{ column_name }} IS NULL";

  private static final TestDefinition NOT_NULL =
      new TestDefinition()
          .withName("columnValuesToBeNotNull")
          .withEntityType(TestDefinitionEntityType.COLUMN)
          .withEnabled(true)
          .withSupportsRowLevelPassedFailed(true)
          .withParameterDefinition(List.of());

  private static final TestDefinition REGEX =
      new TestDefinition()
          .withName("columnValuesToMatchRegex")
          .withEntityType(TestDefinitionEntityType.COLUMN)
          .withEnabled(true)
          .withSupportsRowLevelPassedFailed(false)
          .withParameterDefinition(
              List.of(new TestCaseParameter().withName("regex").withRequired(true)));

  private static final Map<String, TestDefinition> DEFINITIONS =
      Map.of(NOT_NULL.getName(), NOT_NULL, REGEX.getName(), REGEX);
  private static final Function<String, TestDefinition> RESOLVER = DEFINITIONS::get;

  private static DqTestSpec library(String key, String name, String definition) {
    return new DqTestSpec()
        .withKey(key)
        .withName(name)
        .withKind(DqTestSpecKind.LIBRARY)
        .withTestDefinitionFqn(definition);
  }

  private static DqTestSpec sql(String key, String name) {
    return new DqTestSpec()
        .withKey(key)
        .withName(name)
        .withKind(DqTestSpecKind.SQL)
        .withSqlExpression(SQL);
  }

  private static DqTestSpecs specs(DqTestSpec... items) {
    return new DqTestSpecs().withItems(List.of(items));
  }

  private static void validate(
      DqTestSpecValidator.Mode mode,
      DqTestSpecs approved,
      String ruleThreshold,
      DqTestSpecs specs) {
    new DqTestSpecValidator(mode, RESOLVER, approved, ruleThreshold).validate(specs);
  }

  private static String codeOf(WebApplicationException exception) {
    return (String) ((Map<?, ?>) exception.getResponse().getEntity()).get("code");
  }

  private static String failure(
      DqTestSpecValidator.Mode mode,
      DqTestSpecs approved,
      String ruleThreshold,
      DqTestSpecs specs) {
    return codeOf(
        assertThrows(
            WebApplicationException.class, () -> validate(mode, approved, ruleThreshold, specs)));
  }

  @Test
  void aMixedRuleWithManyDeclarationsIsValid() {
    final DqTestSpecs mixed =
        specs(
            library("t1", "Not null", "columnValuesToBeNotNull"),
            sql("t2", "No nulls in SQL"),
            sql("t3", "Another"));
    assertDoesNotThrow(() -> validate(DqTestSpecValidator.Mode.FULL, null, null, mixed));
  }

  @Test
  void anEmptyRuleIsValid() {
    assertDoesNotThrow(() -> validate(DqTestSpecValidator.Mode.FULL, null, null, null));
    assertDoesNotThrow(
        () -> validate(DqTestSpecValidator.Mode.FULL, null, null, new DqTestSpecs()));
  }

  @Test
  void namesMustBeUniqueIgnoringCase() {
    assertEquals(
        DqTestErrors.NAME_DUPLICATE,
        failure(
            DqTestSpecValidator.Mode.DRAFT,
            null,
            null,
            specs(sql("t1", "Same"), sql("t2", "same"))));
  }

  @Test
  void sqlIsCheckedAtSaveDraft() {
    final DqTestSpec bad = sql("t1", "Bad").withSqlExpression("DROP TABLE {{ table_name }}");
    assertEquals(
        DqTestErrors.SQL_INVALID, failure(DqTestSpecValidator.Mode.DRAFT, null, null, specs(bad)));
  }

  @Test
  void definitionsAreResolvedOnlyInFullMode() {
    final DqTestSpecs unknown = specs(library("t1", "x", "doesNotExist"));
    assertDoesNotThrow(() -> validate(DqTestSpecValidator.Mode.DRAFT, null, null, unknown));
    assertEquals(
        DqTestErrors.PARAM_INVALID, failure(DqTestSpecValidator.Mode.FULL, null, null, unknown));
  }

  @Test
  void requiredParametersMustHaveValues() {
    assertEquals(
        DqTestErrors.PARAM_INVALID,
        failure(
            DqTestSpecValidator.Mode.FULL,
            null,
            null,
            specs(library("t1", "Regex", "columnValuesToMatchRegex"))));
    final DqTestSpec withValue =
        library("t1", "Regex", "columnValuesToMatchRegex")
            .withParameterValues(
                List.of(new TestCaseParameterValue().withName("regex").withValue("^[0-9]+$")));
    assertDoesNotThrow(() -> validate(DqTestSpecValidator.Mode.FULL, null, null, specs(withValue)));
  }

  @Test
  void undefinedParametersAreRejected() {
    final DqTestSpec extra =
        library("t1", "Not null", "columnValuesToBeNotNull")
            .withParameterValues(
                List.of(new TestCaseParameterValue().withName("oops").withValue("1")));
    assertEquals(
        DqTestErrors.PARAM_INVALID,
        failure(DqTestSpecValidator.Mode.FULL, null, null, specs(extra)));
  }

  @Test
  void percentageThresholdNeedsRowCountsOfTheDefinitionAndTheDeclaration() {
    final DqTestSpec noRowCounts = library("t1", "Not null", "columnValuesToBeNotNull");
    assertEquals(
        DqTestErrors.THRESHOLD_UNSUPPORTED,
        failure(DqTestSpecValidator.Mode.FULL, null, ">= 99%", specs(noRowCounts)));
    assertDoesNotThrow(
        () ->
            validate(
                DqTestSpecValidator.Mode.FULL,
                null,
                ">= 99%",
                specs(noRowCounts.withComputePassedFailedRowCount(true))));
    final DqTestSpec regex =
        library("t2", "Regex", "columnValuesToMatchRegex")
            .withParameterValues(
                List.of(new TestCaseParameterValue().withName("regex").withValue("x")))
            .withComputePassedFailedRowCount(true);
    assertEquals(
        DqTestErrors.THRESHOLD_UNSUPPORTED,
        failure(DqTestSpecValidator.Mode.FULL, null, ">= 99%", specs(regex)));
    assertDoesNotThrow(
        () ->
            validate(
                DqTestSpecValidator.Mode.FULL,
                null,
                ">= 99%",
                specs(regex.withThreshold("count = 0"))));
  }

  @Test
  void sqlDeclarationsSupportCountThresholdsOnly() {
    assertEquals(
        DqTestErrors.THRESHOLD_UNSUPPORTED,
        failure(
            DqTestSpecValidator.Mode.FULL,
            null,
            null,
            specs(sql("t1", "x").withThreshold(">= 99%").withComputePassedFailedRowCount(true))));
    assertDoesNotThrow(
        () ->
            validate(
                DqTestSpecValidator.Mode.FULL,
                null,
                null,
                specs(sql("t1", "x").withThreshold("count <= 3"))));
  }

  @Test
  void malformedThresholdIsRejectedAtSaveDraft() {
    assertEquals(
        DqTestErrors.THRESHOLD_UNSUPPORTED,
        failure(
            DqTestSpecValidator.Mode.DRAFT,
            null,
            null,
            specs(sql("t1", "x").withThreshold("high"))));
  }

  @Test
  void theKindOfAnApprovedDeclarationCannotChange() {
    final DqTestSpecs approved = specs(library("t1", "Not null", "columnValuesToBeNotNull"));
    assertEquals(
        DqTestErrors.DEFINITION_IMMUTABLE,
        failure(DqTestSpecValidator.Mode.FULL, approved, null, specs(sql("t1", "Not null"))));
    assertEquals(
        DqTestErrors.DEFINITION_IMMUTABLE,
        failure(
            DqTestSpecValidator.Mode.FULL,
            approved,
            null,
            specs(library("t1", "Not null", "columnValuesToMatchRegex"))));
  }

  @Test
  void anApprovedDeclarationMayChangeItsParametersAndNameAndOthersMayBeAddedOrRemoved() {
    final DqTestSpecs approved = specs(sql("t1", "Old name"), sql("t2", "Gone"));
    final DqTestSpecs next =
        specs(sql("t1", "New name").withSqlExpression(SQL + " AND 1 = 1"), sql("t3", "Added"));
    assertDoesNotThrow(() -> validate(DqTestSpecValidator.Mode.FULL, approved, null, next));
  }

  @Test
  void managedAndDisabledDefinitionsCannotBePicked() {
    final TestDefinition managed =
        new TestDefinition()
            .withName("DQR__1__DQ1__t1")
            .withEntityType(TestDefinitionEntityType.COLUMN)
            .withEnabled(true);
    final TestDefinition disabled =
        new TestDefinition()
            .withName("off")
            .withEntityType(TestDefinitionEntityType.COLUMN)
            .withEnabled(false);
    final TestDefinition table =
        new TestDefinition()
            .withName("tbl")
            .withEntityType(TestDefinitionEntityType.TABLE)
            .withEnabled(true);
    final Map<String, TestDefinition> map =
        Map.of(managed.getName(), managed, disabled.getName(), disabled, table.getName(), table);
    for (String name : map.keySet()) {
      final DqTestSpecValidator validator =
          new DqTestSpecValidator(DqTestSpecValidator.Mode.FULL, map::get, null, null);
      assertThrows(
          WebApplicationException.class,
          () -> validator.validate(specs(library("t1", "x", name))),
          name);
    }
  }
}
