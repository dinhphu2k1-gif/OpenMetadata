package org.openmetadata.service.resources.filters;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;

class PortalReadOnlyFilterTest {

  @ParameterizedTest
  @CsvSource({
    "GET, v1/glossaries",
    "HEAD, v1/glossaries",
    "OPTIONS, v1/glossaryTerms",
    "POST, v1/users/login",
    "POST, /v1/users/refresh/",
    "POST, v1/users/logout",
    "POST, v1/search/aggregate"
  })
  void allowsReadsAndLogin(String method, String path) {
    assertTrue(PortalReadOnlyFilter.isAllowed(method, path));
  }

  @ParameterizedTest
  @CsvSource({
    "POST, v1/glossaries",
    "POST, v1/users/signup",
    "PUT, v1/glossaryTerms",
    "PATCH, v1/glossaryTerms/123",
    "DELETE, v1/glossaries/123",
    "POST, v1/search/reindexEntities",
    "PUT, v1/users/changePassword"
  })
  void rejectsWrites(String method, String path) {
    assertFalse(PortalReadOnlyFilter.isAllowed(method, path));
  }

  @Test
  void abortsWriteWithForbidden() {
    ContainerRequestContext request = request("PATCH", "v1/glossaryTerms/123");

    new PortalReadOnlyFilter().filter(request);

    ArgumentCaptor<Response> response = ArgumentCaptor.forClass(Response.class);
    verify(request).abortWith(response.capture());
    assertEquals(Response.Status.FORBIDDEN.getStatusCode(), response.getValue().getStatus());
  }

  @Test
  void letsReadThrough() {
    ContainerRequestContext request = request("GET", "v1/glossaryTerms/123");

    new PortalReadOnlyFilter().filter(request);

    verify(request, never()).abortWith(any());
  }

  private static ContainerRequestContext request(String method, String path) {
    ContainerRequestContext request = mock(ContainerRequestContext.class);
    UriInfo uriInfo = mock(UriInfo.class);
    when(request.getMethod()).thenReturn(method);
    when(request.getUriInfo()).thenReturn(uriInfo);
    when(uriInfo.getPath()).thenReturn(path);
    return request;
  }
}
