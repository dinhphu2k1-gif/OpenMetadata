/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.search;

import org.openmetadata.service.glossary.versioning.GlossaryBusinessVersionSearchService.Criteria;
import org.openmetadata.service.resources.glossary.GovernedScopeAuthorizer.ScopeAccess;

/** Validated search criteria plus request-level authorization and include mode. */
public record GovernedGlossarySearchRequest(
    Criteria criteria,
    ScopeAccess access,
    String principal,
    boolean includeDeleted,
    boolean deletedOnly) {}
