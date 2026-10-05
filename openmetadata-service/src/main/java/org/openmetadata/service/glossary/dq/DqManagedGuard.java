/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DqRuleTestDAO;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.BindingRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.RuleExecRow;
import org.openmetadata.service.jdbi3.DqRuleTestDAO.SpecExecRow;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Refuses edits and deletes of testcases and definitions owned by a Data Quality Rule when they do
 * not come from the reconciler. Recording results, incidents and following stay allowed because
 * they do not pass through the entity update path.
 */
public final class DqManagedGuard {
  private DqManagedGuard() {}

  /** Information shown on the testcase page: which Rule and declaration manage it. */
  public record ManagedBy(String ruleId, String ruleCode, String specKey, String specName) {}

  public static void requireNotManaged(TestCase testCase) {
    if (!DqManagedWrite.isActive()) {
      managedBy(testCase)
          .ifPresent(
              managed -> {
                throw DqTestErrors.conflict(
                    DqTestErrors.MANAGED_TEST_CASE,
                    "This testcase is managed by rule "
                        + managed.ruleCode()
                        + ", test '"
                        + managed.specName()
                        + "'. Edit the test declaration in Data Quality.");
              });
    }
  }

  public static void requireNotManaged(TestDefinition definition) {
    if (!DqManagedWrite.isActive()
        && definition.getName() != null
        && definition.getName().startsWith(DqTestSpecValidator.MANAGED_DEFINITION_PREFIX)) {
      throw DqTestErrors.conflict(
          DqTestErrors.MANAGED_TEST_CASE,
          "This test definition is managed by a Data Quality Rule and cannot be changed.");
    }
  }

  public static Optional<ManagedBy> managedBy(TestCase testCase) {
    final BindingRow binding = bindingOf(testCase);
    return binding == null ? Optional.empty() : Optional.of(describe(binding));
  }

  public static Optional<ManagedBy> managedBy(UUID testCaseId) {
    final BindingRow binding = dao().findBindingByTestCase(testCaseId.toString());
    return binding == null ? Optional.empty() : Optional.of(describe(binding));
  }

  private static BindingRow bindingOf(TestCase testCase) {
    BindingRow binding = null;
    if (testCase.getId() != null) {
      binding = dao().findBindingByTestCase(testCase.getId().toString());
    }
    if (binding == null && testCase.getEntityLink() != null && testCase.getName() != null) {
      binding = dao().findBindingByTestCaseFqn(computedFqn(testCase));
    }
    return binding;
  }

  private static String computedFqn(TestCase testCase) {
    final EntityLink link = EntityLink.parse(testCase.getEntityLink());
    return FullyQualifiedName.add(
        link.getFullyQualifiedFieldValue(), EntityInterfaceUtil.quoteName(testCase.getName()));
  }

  private static ManagedBy describe(BindingRow binding) {
    final RuleExecRow rule = dao().findRuleExec(binding.ruleTermId());
    final List<SpecExecRow> specs = dao().listSpecs(binding.ruleTermId());
    final String specName =
        specs.stream()
            .filter(spec -> spec.specKey().equals(binding.specKey()))
            .map(SpecExecRow::name)
            .findFirst()
            .orElse(binding.specKey());
    return new ManagedBy(
        binding.ruleTermId(), rule == null ? null : rule.ruleCode(), binding.specKey(), specName);
  }

  private static DqRuleTestDAO dao() {
    return Entity.getJdbi().onDemand(DqRuleTestDAO.class);
  }
}
