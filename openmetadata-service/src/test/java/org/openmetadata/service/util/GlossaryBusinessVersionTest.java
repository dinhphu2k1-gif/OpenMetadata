package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class GlossaryBusinessVersionTest {
  @Test
  void validatesCanonicalVersionAndComparesNumerically() {
    assertEquals("1.10", GlossaryBusinessVersion.requireCanonical("1.10"));
    assertTrue(GlossaryBusinessVersion.compare("v1.10", "version 1.9") > 0);
  }
}
