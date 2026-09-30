/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import java.util.UUID;

/**
 * Body of `POST /v1/glossaryTerms/technical/records`: the Column to declare and its initial
 * editable values. Every value except {@code columnFqn} is optional (TDX-02); tag values are
 * classification tag FQNs.
 */
public record TechnicalRecordDeclaration(
    String columnFqn,
    UUID cde,
    Integer rank,
    String elementType,
    String generationType,
    String creationMethod,
    String timeliness,
    UUID systemOwnerId) {}
