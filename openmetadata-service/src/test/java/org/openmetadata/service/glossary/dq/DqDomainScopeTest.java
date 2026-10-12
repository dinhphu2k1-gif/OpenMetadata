/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.dq;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;

class DqDomainScopeTest {
  private static final String DOMAIN = "Khach_hang";

  private static EntityReference domain(String fqn) {
    return new EntityReference().withFullyQualifiedName(fqn);
  }

  @Test
  void assignedToTheDomainItself() {
    assertTrue(DqDomainScope.isAssigned(List.of(domain(DOMAIN)), DOMAIN));
  }

  @Test
  void assignedToASubdomain() {
    assertTrue(DqDomainScope.isAssigned(List.of(domain(DOMAIN + ".Ca_nhan")), DOMAIN));
  }

  @Test
  void notAssignedToADomainSharingTheNamePrefix() {
    assertFalse(DqDomainScope.isAssigned(List.of(domain(DOMAIN + "_vip")), DOMAIN));
  }

  @Test
  void notAssignedToTheParentDomain() {
    assertFalse(DqDomainScope.isAssigned(List.of(domain("Khach")), DOMAIN));
  }

  @Test
  void notAssignedWithoutDomains() {
    assertFalse(DqDomainScope.isAssigned(null, DOMAIN));
    assertFalse(DqDomainScope.isAssigned(List.of(), DOMAIN));
    assertFalse(DqDomainScope.isAssigned(List.of(domain(null)), DOMAIN));
  }
}
