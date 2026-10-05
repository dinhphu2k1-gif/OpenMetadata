/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

package org.openmetadata.service.glossary.technical;

/** Optimistic-lock input for approving or rejecting a newly declared Technical Dictionary record. */
public record TechnicalRecordReview(Long expectedRevision, String comment) {}
