/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
import { EntityReference } from '../../entity/type';
import { TagLabel } from '../../entity/data/glossaryTerm';

/** Complete mutable payload used to save a CDE working Draft. */
export interface CdeDraftUpdateRequest {
  expectedRevision: number;
  displayName?: string | null;
  description: string;
  owners: EntityReference[];
  reviewers: EntityReference[];
  domains: EntityReference[];
  tags: TagLabel[];
  extension?: Record<string, unknown> | null;
}
