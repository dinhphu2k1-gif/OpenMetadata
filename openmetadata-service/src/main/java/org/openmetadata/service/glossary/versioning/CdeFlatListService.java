/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.versioning;

import jakarta.ws.rs.NotFoundException;
import java.util.List;
import java.util.UUID;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CdeFlatListDAO;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.PublishedSnapshotRecord;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO.WorkingVersionRecord;
import org.openmetadata.service.util.GlossaryBusinessVersion;

/** Resolves one authoritative Dictionary scope and loads its flat CDE candidates in bulk. */
public class CdeFlatListService {
  private final GlossaryVersioningService versioningService = new GlossaryVersioningService();

  public Scope resolveScope(UUID glossaryId, String requestedParentBusinessVersion) {
    String parentBusinessVersion =
        GlossaryBusinessVersion.requireCanonicalDictionary(requestedParentBusinessVersion);
    try {
      WorkingVersionRecord working =
          versioningService.getWorking(GlossaryVersioningService.GLOSSARY, glossaryId);
      if (parentBusinessVersion.equals(working.businessVersion())) {
        return new Scope(
            ScopeType.WORKING, parentBusinessVersion, working.payload(), null, working);
      }
    } catch (NotFoundException ignored) {
      // An active or historical Dictionary intentionally has no matching working row.
    }

    PublishedSnapshotRecord published;
    try {
      published =
          versioningService.getPublished(
              GlossaryVersioningService.GLOSSARY, glossaryId, parentBusinessVersion);
    } catch (NotFoundException exception) {
      throw scopeNotFound();
    }
    ScopeType type;
    if (published.archivedAt() != null) {
      type = ScopeType.ARCHIVED;
    } else if (versioningService.isLatestPublished(
        GlossaryVersioningService.GLOSSARY, glossaryId, parentBusinessVersion)) {
      type = ScopeType.ACTIVE;
    } else {
      throw scopeNotFound();
    }
    return new Scope(type, parentBusinessVersion, published.payload(), published, null);
  }

  public Candidates loadCandidates(UUID glossaryId, Scope scope) {
    CdeFlatListDAO dao = Entity.getJdbi().onDemand(CdeFlatListDAO.class);
    if (scope.type() == ScopeType.ARCHIVED) {
      return new Candidates(
          dao.listArchivedPublishedFromManifest(
              scope.published().snapshotId(), scope.parentBusinessVersion()),
          List.of());
    }
    return new Candidates(
        dao.listActivePublished(glossaryId, scope.parentBusinessVersion()),
        dao.listWorking(glossaryId, scope.parentBusinessVersion()));
  }

  private static NotFoundException scopeNotFound() {
    return new NotFoundException("Data Dictionary scope was not found");
  }

  public enum ScopeType {
    ACTIVE,
    WORKING,
    ARCHIVED
  }

  public record Scope(
      ScopeType type,
      String parentBusinessVersion,
      String payload,
      PublishedSnapshotRecord published,
      WorkingVersionRecord working) {}

  public record Candidates(
      List<PublishedSnapshotRecord> published, List<WorkingVersionRecord> working) {}
}
