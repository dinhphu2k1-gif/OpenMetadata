package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

class GlossaryBusinessVersionTest {
  @Test
  void readsCanonicalAndLegacyAliasesInPriorityOrder() {
    assertEquals(
        "2.0", GlossaryBusinessVersion.get(Map.of("version", "2.0", "cdeVersion", "1.0")));
    assertEquals("1.2", GlossaryBusinessVersion.get(Map.of("cdeVersion", "1.2")));
    assertEquals("1.1", GlossaryBusinessVersion.get(Map.of("phien_ban", "1.1")));
    assertEquals("1.0", GlossaryBusinessVersion.get(null));
  }

  @Test
  void writesOnlyCanonicalVersionAndComparesNumerically() {
    Map<String, Object> normalized =
        GlossaryBusinessVersion.normalize(
            Map.of("cdeVersion", "1.9", "phien_ban", "1.8", "owner", "data"), "v1.10");
    assertEquals("v1.10", normalized.get("version"));
    assertFalse(normalized.containsKey("cdeVersion"));
    assertFalse(normalized.containsKey("phien_ban"));
    assertTrue(GlossaryBusinessVersion.compare("v1.10", "version 1.9") > 0);
  }
}
