/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

/** Optimistic-lock request for a Data Dictionary workflow transition. */
export interface GlossaryWorkflowTransitionRequest {
  expectedRevision: number;
}
