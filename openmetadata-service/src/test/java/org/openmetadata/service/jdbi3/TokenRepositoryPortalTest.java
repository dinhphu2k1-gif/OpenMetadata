package org.openmetadata.service.jdbi3;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.auth.RefreshToken;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.PortalConfiguration;

class TokenRepositoryPortalTest {

  @AfterEach
  void deactivatePortal() {
    PortalConfiguration.activate(new PortalConfiguration());
  }

  @Test
  void portalDoesNotStoreTokens() {
    CollectionDAO dao = mock(CollectionDAO.class);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);
      PortalConfiguration.activate(enabledPortal());

      new TokenRepository().insertToken(refreshToken());

      verify(dao, never()).getTokenDAO();
    }
  }

  @Test
  void openMetadataStoresTokens() {
    CollectionDAO dao = mock(CollectionDAO.class);
    CollectionDAO.TokenDAO tokenDao = mock(CollectionDAO.TokenDAO.class);
    when(dao.getTokenDAO()).thenReturn(tokenDao);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getCollectionDAO).thenReturn(dao);

      new TokenRepository().insertToken(refreshToken());

      verify(tokenDao).insert(anyString());
    }
  }

  private static PortalConfiguration enabledPortal() {
    PortalConfiguration portal = new PortalConfiguration();
    portal.setEnabled(true);
    return portal;
  }

  private static RefreshToken refreshToken() {
    return new RefreshToken().withToken(UUID.randomUUID()).withUserId(UUID.randomUUID());
  }
}
