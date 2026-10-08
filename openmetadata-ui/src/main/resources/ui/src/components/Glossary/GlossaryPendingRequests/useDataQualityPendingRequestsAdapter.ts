/*
 * Copyright 2026 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { PendingRequestsAdapter } from '../../common/PendingRequestsTab/PendingRequestsTab.interface';
import {
  GlossaryPendingRequestsScope,
  useGlossaryPendingRequestsAdapter,
} from './useGlossaryPendingRequestsAdapter';

/** Data Quality profile adapter over the governed glossary workflow transport. */
export const useDataQualityPendingRequestsAdapter = (
  scope: GlossaryPendingRequestsScope
): PendingRequestsAdapter =>
  useGlossaryPendingRequestsAdapter({
    ...scope,
    glossaryName: scope.glossaryName || 'Data Quality',
  });
