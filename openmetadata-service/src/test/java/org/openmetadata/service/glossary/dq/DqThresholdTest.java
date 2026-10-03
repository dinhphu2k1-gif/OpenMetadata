/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class DqThresholdTest {
  @ParameterizedTest
  @ValueSource(strings = {">= 99.5%", ">99%", "= 100%", "<= 1.25 %", "< 5%", "count = 0", "count <= 12", "COUNT <= 3"})
  void parsesGrammar(String text) {
    assertTrue(DqThreshold.parse(text).isPresent(), text);
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "  ", ">= 101%", ">= 99.5", "count > 1", "count = -1", "99%", "count <= 1.5", "abc"})
  void rejectsInvalid(String text) {
    assertFalse(DqThreshold.parse(text).isPresent(), text);
  }

  @Test
  void rejectsTooLong() {
    assertFalse(DqThreshold.parse(">= 99.5%" + " ".repeat(DqThreshold.MAX_LENGTH)).isPresent());
  }

  @Test
  void percentageIsSatisfiedByOperator() {
    final DqThreshold threshold = DqThreshold.parse(">= 99.5%").orElseThrow();
    assertTrue(threshold.isPercentage());
    assertTrue(threshold.isSatisfiedBy(new BigDecimal("99.5")));
    assertTrue(threshold.isSatisfiedBy(new BigDecimal("100")));
    assertFalse(threshold.isSatisfiedBy(new BigDecimal("99.49")));
  }

  @Test
  void countIsSatisfiedByOperator() {
    final DqThreshold equal = DqThreshold.parse("count = 0").orElseThrow();
    final DqThreshold atMost = DqThreshold.parse("count <= 3").orElseThrow();
    assertFalse(equal.isPercentage());
    assertTrue(equal.isSatisfiedBy(BigDecimal.ZERO));
    assertFalse(equal.isSatisfiedBy(BigDecimal.ONE));
    assertTrue(atMost.isSatisfiedBy(new BigDecimal(3)));
    assertFalse(atMost.isSatisfiedBy(new BigDecimal(4)));
    assertEquals("<=", atMost.operator());
  }
}
