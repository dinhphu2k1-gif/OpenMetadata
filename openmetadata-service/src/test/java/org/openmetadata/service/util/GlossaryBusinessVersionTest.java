package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class GlossaryBusinessVersionTest {
  @Test
  void validatesCanonicalVersionAndComparesNumerically() {
    assertEquals("1.10", GlossaryBusinessVersion.requireCanonical("1.10"));
    assertTrue(GlossaryBusinessVersion.compare("v1.10", "version 1.9") > 0);
  }

  @Test
  void validatesDictionaryIntegerAndCdeParentScope() {
    assertEquals("2", GlossaryBusinessVersion.requireCanonicalDictionary("2"));
    for (String invalid : new String[] {"0", "01", "1.0", "v2"}) {
      assertThrows(
          IllegalArgumentException.class,
          () -> GlossaryBusinessVersion.requireCanonicalDictionary(invalid));
    }
    assertEquals("2.1", GlossaryBusinessVersion.requireCdeInScope("2.1", "2"));
    assertThrows(
        IllegalArgumentException.class,
        () -> GlossaryBusinessVersion.requireCdeInScope("1.1", "2"));
  }
}
