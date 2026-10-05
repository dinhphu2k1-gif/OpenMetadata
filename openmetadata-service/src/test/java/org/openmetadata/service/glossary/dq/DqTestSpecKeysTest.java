/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.DqTestSpec;
import org.openmetadata.schema.type.DqTestSpecKind;
import org.openmetadata.schema.type.DqTestSpecs;

class DqTestSpecKeysTest {
  private static DqTestSpec spec(String key, String name) {
    return new DqTestSpec().withKey(key).withName(name).withKind(DqTestSpecKind.LIBRARY);
  }

  private static DqTestSpecs specs(DqTestSpec... items) {
    return new DqTestSpecs().withItems(List.of(items));
  }

  @Test
  void newDeclarationsGetTheNextNumbers() {
    final DqTestSpecs assigned = DqTestSpecKeys.assign(specs(spec(null, "a"), spec("", "b")), 0);
    assertEquals(
        List.of("t1", "t2"), assigned.getItems().stream().map(DqTestSpec::getKey).toList());
  }

  @Test
  void keysAreNeverReusedAfterTheHighestWasIssued() {
    final DqTestSpecs assigned =
        DqTestSpecKeys.assign(specs(spec("t1", "a"), spec(null, "new")), 3);
    assertEquals(
        List.of("t1", "t4"), assigned.getItems().stream().map(DqTestSpec::getKey).toList());
  }

  @Test
  void aKeyThatWasNeverIssuedIsRejected() {
    final WebApplicationException error =
        assertThrows(
            WebApplicationException.class, () -> DqTestSpecKeys.assign(specs(spec("t9", "a")), 2));
    assertEquals(400, error.getResponse().getStatus());
  }

  @Test
  void aMalformedKeyIsRejected() {
    assertThrows(
        WebApplicationException.class, () -> DqTestSpecKeys.assign(specs(spec("x1", "a")), 5));
  }

  @Test
  void aKeyUsedTwiceIsRejected() {
    assertThrows(
        WebApplicationException.class,
        () -> DqTestSpecKeys.assign(specs(spec("t1", "a"), spec("t1", "b")), 2));
  }

  @Test
  void highestNumberReadsTheDeclarations() {
    assertEquals(0, DqTestSpecKeys.highestNumber(null));
    assertEquals(7, DqTestSpecKeys.highestNumber(specs(spec("t2", "a"), spec("t7", "b"))));
  }

  @Test
  void emptyInputGivesEmptyDeclarations() {
    assertEquals(0, DqTestSpecKeys.assign(null, 4).getItems().size());
  }
}
