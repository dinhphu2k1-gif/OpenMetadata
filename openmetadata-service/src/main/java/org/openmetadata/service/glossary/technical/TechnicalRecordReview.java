/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Optimistic-lock input for approving or rejecting a newly declared Technical Dictionary record. A
 * rejection carries no reason; a {@code comment} sent by an older client is ignored.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record TechnicalRecordReview(Long expectedRevision) {}
