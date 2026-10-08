/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { EntityReference } from '../../../generated/type/entityReference';
import { ReactNode } from 'react';

/** What the request asks the approver to do with the record. */
export type PendingRequestType = 'create' | 'update' | 'delete';

export type PendingRequestAction = 'approve' | 'reject' | 'withdraw';

/**
 * One row of the tab. It carries only what an approver needs to decide; the owning module maps
 * its own record (a glossary term, a quality rule, a technical column) onto it.
 */
export interface PendingRequest {
  /** Stable key of the request; also what the adapter receives back for a bulk action. */
  id: string;
  code: string;
  name: string;
  /** Business version of the record represented by this request. */
  version?: string;
  type: PendingRequestType;
  /** Labels of the changed fields, or the action's fixed summary. */
  changedFields?: string[];
  requestedBy?: EntityReference;
  requestedAt?: number;
  /** Where the code links to, when the record has a detail page. */
  detailPath?: string;
  /** False for a request still in draft: listed for visibility, but not yet decidable. */
  selectable?: boolean;
  /** True when the current user submitted the request and it is still In Review, so they can withdraw it. */
  canWithdraw?: boolean;
  /** Module-level maker-checker may make this row non-reviewable for the current user. */
  canDecide?: boolean;
  /** Optional explanation shown by module UIs when a row cannot be selected for a decision. */
  disabledReason?: string;
  /** Revision the approver saw, sent back so a stale decision is refused by the server. */
  revision?: number;
  /** Module-owned grouping references used by optional filters. */
  groups?: EntityReference[];
  /** Module-specific scalar filter values kept opaque to the shared tab. */
  filterValues?: Record<string, string[]>;
}

export interface PendingRequestChangeDetail {
  diffs?: Array<{
    field: string;
    oldValue: ReactNode;
    newValue: ReactNode;
    /** The field had no value before, or has none after the change. */
    oldEmpty?: boolean;
    newEmpty?: boolean;
  }>;
  fields?: Array<{ label: string; value: ReactNode; empty?: boolean }>;
  warning?: string;
}

export interface PendingRequestFilter {
  key: string;
  label: string;
  options: Array<{ label: string; value: string }>;
}

export interface PendingRequestsQuery {
  searchText?: string;
  types?: PendingRequestType[];
  page: number;
  pageSize: number;
  filters?: Record<string, string[]>;
}

export interface PendingRequestsPage {
  items: PendingRequest[];
  total: number;
}

export interface PendingRequestFailure {
  id: string;
  code?: string;
  message?: string;
}

export interface PendingRequestsActionResult {
  succeeded: number;
  failures: PendingRequestFailure[];
  remaining?: number;
}

/**
 * What a module supplies to reuse the tab. The tab owns the table, the selection, the filters and
 * the confirmation; the adapter owns where the requests come from and how a decision is applied.
 */
export type PendingRequestTypeCounts = Record<PendingRequestType, number>;

export interface PendingRequestsAdapter {
  fetchRequests: (query: PendingRequestsQuery) => Promise<PendingRequestsPage>;
  /** How many requests of each type are waiting, over every page and ignoring the filters. */
  fetchTypeCounts?: () => Promise<PendingRequestTypeCounts>;
  fetchFilters?: () => Promise<PendingRequestFilter[]>;
  fetchChangeDetail: (
    request: PendingRequest
  ) => Promise<PendingRequestChangeDetail>;
  getApprovalWarning?: (
    requests: PendingRequest[]
  ) => { message: string; items: string[] } | undefined;
  applyAction: (
    action: PendingRequestAction,
    requests: PendingRequest[]
  ) => Promise<PendingRequestsActionResult>;
}

export interface PendingRequestsTabProps {
  adapter: PendingRequestsAdapter;
  /** Only users who may approve can approve or reject; others can still withdraw their own requests. */
  canDecide: boolean;
  /** Changing it reloads the list, for example when another glossary version is opened. */
  scopeKey?: string;
  /** Changing it reloads the current scope, for example when the user re-enters this tab. */
  refreshKey?: number | string;
  /** Placeholder of the search box, worded for the module's records. */
  searchPlaceholder?: string;
  /** Called after a decision so the host can invalidate only data affected by that action. */
  onDecided?: (
    result: PendingRequestsActionResult,
    action: PendingRequestAction
  ) => void;
  testId?: string;
}
