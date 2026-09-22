/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

/**
 * Optimistic-lock request for a CDE working workflow transition.
 */
export interface CdeWorkflowTransitionRequest {
  expectedRevision: number;
}
