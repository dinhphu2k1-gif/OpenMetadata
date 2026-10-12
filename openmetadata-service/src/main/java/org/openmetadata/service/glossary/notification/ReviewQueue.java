/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.notification;

import java.util.UUID;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.glossary.technical.TechnicalCatalog;
import org.openmetadata.service.glossary.technical.TechnicalRecord;
import org.openmetadata.service.glossary.technical.TechnicalRecordChangeRequest;
import org.openmetadata.service.glossary.versioning.GlossaryVersioningService;
import org.openmetadata.service.jdbi3.GlossaryVersionDAO;
import org.openmetadata.service.jdbi3.TechnicalDictionaryDAO;

/**
 * One governed catalog whose In Review requests are announced to data stewards: the terms of a
 * versioned governed glossary, or the records and change requests of the Technical Dictionary.
 */
record ReviewQueue(Kind kind, UUID glossaryId) {
  enum Kind {
    GLOSSARY_TERMS,
    TECHNICAL_DICTIONARY
  }

  static ReviewQueue glossaryTerms(UUID glossaryId) {
    return new ReviewQueue(Kind.GLOSSARY_TERMS, glossaryId);
  }

  static ReviewQueue technicalDictionary() {
    return new ReviewQueue(Kind.TECHNICAL_DICTIONARY, null);
  }

  EntityReference glossary() {
    return switch (kind) {
      case GLOSSARY_TERMS -> Entity.getEntityReferenceById(
          Entity.GLOSSARY, glossaryId, Include.NON_DELETED);
      case TECHNICAL_DICTIONARY -> TechnicalCatalog.requireGlossary().getEntityReference();
    };
  }

  long pendingCount() {
    return switch (kind) {
      case GLOSSARY_TERMS -> pendingGlossaryTerms();
      case TECHNICAL_DICTIONARY -> pendingTechnicalRequests();
    };
  }

  private long pendingGlossaryTerms() {
    return Entity.getJdbi()
        .onDemand(GlossaryVersionDAO.class)
        .countWorkingByGlossaryAndStatus(
            GlossaryVersioningService.GLOSSARY_TERM, glossaryId, EntityStatus.IN_REVIEW.value());
  }

  private static long pendingTechnicalRequests() {
    final TechnicalDictionaryDAO dao = Entity.getJdbi().onDemand(TechnicalDictionaryDAO.class);
    return dao.countRecordsByStatus(TechnicalRecord.STATUS_IN_REVIEW)
        + dao.countChangeRequestsByStatus(TechnicalRecordChangeRequest.STATUS_IN_REVIEW);
  }
}
