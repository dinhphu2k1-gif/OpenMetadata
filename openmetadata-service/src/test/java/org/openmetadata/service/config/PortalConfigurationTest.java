package org.openmetadata.service.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PortalConfigurationTest {

  @AfterEach
  void deactivatePortal() {
    PortalConfiguration.activate(new PortalConfiguration());
  }

  @Test
  void isInactiveByDefault() {
    assertFalse(new PortalConfiguration().isEnabled());
    assertFalse(PortalConfiguration.isActive());
  }

  @Test
  void activatesFromTheConfiguration() {
    PortalConfiguration portal = new PortalConfiguration();
    portal.setEnabled(true);

    PortalConfiguration.activate(portal);

    assertTrue(PortalConfiguration.isActive());
  }

  @Test
  void servesThePortalUiOnlyWhenEnabled() {
    PortalConfiguration portal = new PortalConfiguration();
    assertEquals(PortalConfiguration.OPENMETADATA_ASSETS, portal.getAssetResourcePath());

    portal.setEnabled(true);

    assertEquals(PortalConfiguration.PORTAL_ASSETS, portal.getAssetResourcePath());
  }
}
