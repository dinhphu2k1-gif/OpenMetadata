/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.schema.type.DqTestSpecKind;
import org.openmetadata.schema.type.DqTestSpecs;
import org.openmetadata.schema.type.TestCaseParameterValidationRuleType;
import org.openmetadata.schema.type.TestDefinitionEntityType;

/**
 * Validates the test declarations of a Data Quality Rule. {@link Mode#DRAFT} runs at Save Draft
 * and only checks what can be judged from the declaration itself; {@link Mode#FULL} runs at Submit
 * and Approve and also resolves TestDefinitions, parameters, thresholds and the immutability of
 * the kind of a declaration against the previously approved version.
 */
public final class DqTestSpecValidator {
  public static final String MANAGED_DEFINITION_PREFIX = "DQR__";
  public static final int NAME_MAX_LENGTH = 128;

  public enum Mode {
    DRAFT,
    FULL
  }

  private final Mode mode;
  private final Function<String, TestDefinition> definitions;
  private final DqTestSpecs approved;
  private final String ruleThreshold;

  public DqTestSpecValidator(
      Mode mode,
      Function<String, TestDefinition> definitions,
      DqTestSpecs approved,
      String ruleThreshold) {
    this.mode = mode;
    this.definitions = definitions;
    this.approved = approved;
    this.ruleThreshold = ruleThreshold;
  }

  public void validate(DqTestSpecs specs) {
    if (specs != null && !nullOrEmpty(specs.getItems())) {
      final Set<String> names = new HashSet<>();
      for (DqTestSpec spec : specs.getItems()) {
        validateSpec(spec, names);
      }
    }
  }

  private void validateSpec(DqTestSpec spec, Set<String> names) {
    final String ref = reference(spec);
    validateName(spec, names, ref);
    validateKind(spec, ref);
    validateThresholdSyntax(spec.getThreshold(), ref);
    if (mode == Mode.FULL) {
      validateImmutability(spec, ref);
      validateFull(spec, ref);
    }
  }

  private void validateName(DqTestSpec spec, Set<String> names, String ref) {
    final String name = spec.getName() == null ? "" : spec.getName().trim();
    if (name.isEmpty() || name.length() > NAME_MAX_LENGTH) {
      throw DqTestErrors.badRequest(
          DqTestErrors.PARAM_INVALID, "Test name must have 1 to 128 characters", ref);
    }
    if (!names.add(name.toLowerCase(Locale.ROOT))) {
      throw DqTestErrors.badRequest(
          DqTestErrors.NAME_DUPLICATE, "Test name '" + name + "' is used twice", ref);
    }
  }

  private void validateKind(DqTestSpec spec, String ref) {
    if (spec.getKind() == DqTestSpecKind.SQL) {
      final List<String> problems =
          DqTestSpecSql.problems(spec.getSqlExpression(), parameterNames(spec));
      if (!problems.isEmpty()) {
        throw DqTestErrors.badRequest(DqTestErrors.SQL_INVALID, String.join("; ", problems), ref);
      }
    } else if (nullOrEmpty(spec.getTestDefinitionFqn())) {
      throw DqTestErrors.badRequest(
          DqTestErrors.PARAM_INVALID, "A library test needs a TestDefinition", ref);
    }
  }

  private void validateThresholdSyntax(String threshold, String ref) {
    if (!nullOrEmpty(threshold) && DqThreshold.parse(threshold).isEmpty()) {
      throw DqTestErrors.badRequest(
          DqTestErrors.THRESHOLD_UNSUPPORTED,
          "Threshold '" + threshold + "' is not valid; use e.g. '>= 99.5%' or 'count = 0'",
          ref);
    }
  }

  private void validateImmutability(DqTestSpec spec, String ref) {
    final DqTestSpec before = approvedSpec(spec.getKey());
    final boolean changed =
        before != null
            && (before.getKind() != spec.getKind()
                || !java.util.Objects.equals(
                    before.getTestDefinitionFqn(), spec.getTestDefinitionFqn()));
    if (changed) {
      throw DqTestErrors.badRequest(
          DqTestErrors.DEFINITION_IMMUTABLE,
          "The kind of an approved test cannot change; delete it and add a new test",
          ref);
    }
  }

  private void validateFull(DqTestSpec spec, String ref) {
    final TestDefinition definition = resolveDefinition(spec, ref);
    if (definition != null) {
      validateParameters(spec, definition, ref);
    }
    validateEffectiveThreshold(spec, definition, ref);
  }

  private TestDefinition resolveDefinition(DqTestSpec spec, String ref) {
    TestDefinition definition = null;
    if (spec.getKind() == DqTestSpecKind.LIBRARY) {
      definition = definitions.apply(spec.getTestDefinitionFqn());
      final boolean usable =
          definition != null
              && !Boolean.FALSE.equals(definition.getEnabled())
              && definition.getEntityType() == TestDefinitionEntityType.COLUMN
              && !definition.getName().startsWith(MANAGED_DEFINITION_PREFIX);
      if (!usable) {
        throw DqTestErrors.badRequest(
            DqTestErrors.PARAM_INVALID,
            "TestDefinition '"
                + spec.getTestDefinitionFqn()
                + "' does not exist, is disabled, managed or not column-level",
            ref);
      }
    }
    return definition;
  }

  private void validateParameters(DqTestSpec spec, TestDefinition definition, String ref) {
    final List<TestCaseParameter> defined =
        definition.getParameterDefinition() == null
            ? List.of()
            : definition.getParameterDefinition();
    final Map<String, String> values = parameterMap(spec);
    final Set<String> definedNames =
        defined.stream().map(TestCaseParameter::getName).collect(Collectors.toSet());
    values.keySet().stream()
        .filter(name -> !definedNames.contains(name))
        .findFirst()
        .ifPresent(
            name -> {
              throw DqTestErrors.badRequest(
                  DqTestErrors.PARAM_INVALID, "Parameter '" + name + "' is not defined", ref);
            });
    for (TestCaseParameter parameter : defined) {
      validateParameter(parameter, values, ref);
    }
  }

  private void validateParameter(
      TestCaseParameter parameter, Map<String, String> values, String ref) {
    final String value = values.get(parameter.getName());
    if (Boolean.TRUE.equals(parameter.getRequired()) && nullOrEmpty(value)) {
      throw DqTestErrors.badRequest(
          DqTestErrors.PARAM_INVALID,
          "Required parameter '" + parameter.getName() + "' is missing",
          ref);
    }
    if (parameter.getValidationRule() != null && value != null) {
      final String other = values.get(parameter.getValidationRule().getParameterField());
      requireRuleHolds(parameter, value, other, ref);
    }
  }

  private void requireRuleHolds(
      TestCaseParameter parameter, String value, String other, String ref) {
    final Double left = number(value);
    final Double right = number(other);
    if (left != null
        && right != null
        && !ruleHolds(parameter.getValidationRule().getRule(), left, right)) {
      throw DqTestErrors.badRequest(
          DqTestErrors.PARAM_INVALID,
          "Parameter '" + parameter.getName() + "' violates its validation rule",
          ref);
    }
  }

  private static boolean ruleHolds(
      TestCaseParameterValidationRuleType rule, double left, double right) {
    return switch (rule) {
      case GREATER_THAN_OR_EQUALS -> left >= right;
      case LESS_THAN_OR_EQUALS -> left <= right;
      case EQUALS -> Math.abs(left - right) <= 0.0001;
      case NOT_EQUALS -> Math.abs(left - right) > 0.0001;
    };
  }

  private void validateEffectiveThreshold(DqTestSpec spec, TestDefinition definition, String ref) {
    final String effective = nullOrEmpty(spec.getThreshold()) ? ruleThreshold : spec.getThreshold();
    final DqThreshold threshold =
        nullOrEmpty(effective) ? null : DqThreshold.parse(effective).orElse(null);
    if (!nullOrEmpty(effective) && threshold == null) {
      throw DqTestErrors.badRequest(
          DqTestErrors.THRESHOLD_UNSUPPORTED, "Threshold '" + effective + "' is not valid", ref);
    }
    if (threshold != null && threshold.isPercentage() && !supportsPercentage(spec, definition)) {
      throw DqTestErrors.badRequest(
          DqTestErrors.THRESHOLD_UNSUPPORTED,
          "Threshold '"
              + effective
              + "' needs passed/failed row counts; enable them or use 'count = 0'",
          ref);
    }
  }

  private static boolean supportsPercentage(DqTestSpec spec, TestDefinition definition) {
    final boolean definitionSupports =
        spec.getKind() == DqTestSpecKind.SQL
            || (definition != null
                && Boolean.TRUE.equals(definition.getSupportsRowLevelPassedFailed()));
    return definitionSupports && Boolean.TRUE.equals(spec.getComputePassedFailedRowCount());
  }

  private DqTestSpec approvedSpec(String key) {
    DqTestSpec found = null;
    if (!nullOrEmpty(key) && approved != null && !nullOrEmpty(approved.getItems())) {
      found =
          approved.getItems().stream()
              .filter(item -> key.equals(item.getKey()))
              .findFirst()
              .orElse(null);
    }
    return found;
  }

  private static Set<String> parameterNames(DqTestSpec spec) {
    return new HashSet<>(parameterMap(spec).keySet());
  }

  private static Map<String, String> parameterMap(DqTestSpec spec) {
    final Map<String, String> values = new HashMap<>();
    if (!nullOrEmpty(spec.getParameterValues())) {
      for (TestCaseParameterValue value : spec.getParameterValues()) {
        values.put(value.getName(), value.getValue());
      }
    }
    return values;
  }

  private static Double number(String text) {
    Double number = null;
    try {
      number = text == null ? null : Double.valueOf(text);
    } catch (NumberFormatException ignored) {
      number = null;
    }
    return number;
  }

  private static String reference(DqTestSpec spec) {
    return nullOrEmpty(spec.getKey()) ? "name=" + spec.getName() : "specKey=" + spec.getKey();
  }
}
