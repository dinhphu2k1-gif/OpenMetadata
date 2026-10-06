/*
 *  Copyright 2026 Collate
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
import { AxiosResponse } from 'axios';
import APIClient from './index';

export type TechnicalSourceStatus = 'Available' | 'Unavailable';
export type TechnicalRecordStatus =
  | 'Draft'
  | 'In Review'
  | 'Approved'
  | 'Rejected'
  /** Only on rows of a replaced Data Dictionary version; never stored on a record. */
  | 'Archived';
export type TechnicalAssetSource = 'CURRENT' | 'SNAPSHOT' | 'NONE';
export type TechnicalChangeStatus = 'Draft' | 'InReview' | 'Rejected';
export type TechnicalRowRole = 'APPROVED' | 'CHANGE';
export type TechnicalChangeOperation = 'UPDATE' | 'DELETE';

export interface TechnicalTagValue {
  fqn: string;
  label: string;
}

export interface TechnicalNamedReference {
  id: string;
  name: string;
}

/** A data steward of a record: a team or a user. */
export interface TechnicalOwnerReference extends TechnicalNamedReference {
  type: 'team' | 'user';
}

/** What is sent to store a steward. */
export interface TechnicalOwnerInput {
  id: string;
  type: 'team' | 'user';
}

export interface TechnicalCdeValue {
  id: string;
  code: string;
  name: string;
  businessVersion?: string;
  assignedAt?: number;
  assignedBy?: string;
}

/** A flat row of the Technical Dictionary index, as returned by /glossaryTerms/technical/search. */
export interface TechnicalRecordApiRow {
  termId: string;
  columnKey: string;
  columnFqn: string;
  service?: string;
  database?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  description?: string;
  sourceStatus: TechnicalSourceStatus;
  dataDictionaryVersion?: string;
  revision: number;
  status: TechnicalRecordStatus;
  submittedAt?: number;
  submittedBy?: string;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewComment?: string;
  cde?: TechnicalCdeValue;
  dataOwners?: TechnicalNamedReference[];
  rank?: number;
  elementType?: TechnicalTagValue;
  generationType?: TechnicalTagValue;
  creationMethod?: TechnicalTagValue;
  timeliness?: TechnicalTagValue;
  systemOwners?: TechnicalOwnerReference[];
  createdAt?: number;
  createdBy?: string;
  updatedAt?: number;
  updatedBy?: string;
  hasPendingChange?: boolean;
  changeRequestId?: string;
  changeRequestStatus?: TechnicalChangeStatus;
  changeOperation?: TechnicalChangeOperation;
  changeCreatedBy?: string;
  /** Set when a pending update lists as two rows: the approved values, then the proposal. */
  rowRole?: TechnicalRowRole;
}

export interface TechnicalCapabilities {
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canImport: boolean;
  canExport: boolean;
}

/** The Data Dictionary version the dictionary is bound to and what the caller may do. */
export interface TechnicalContext {
  glossaryId: string;
  /** Null while no Data Dictionary version is Approved and active. */
  dataDictionaryVersion: string | null;
  previousDataDictionaryVersion?: string | null;
  resetAt?: number | null;
  resetBy?: string | null;
  capabilities: TechnicalCapabilities;
}

export interface TechnicalRecordQuery {
  q?: string;
  sourceServices?: string[];
  cdeMapping?: string[];
  cdeTermIds?: string[];
  systemOwnerIds?: string[];
  sourceStatuses?: string[];
  statuses?: TechnicalRecordStatus[];
  elementTypes?: string[];
  generationTypes?: string[];
  creationMethods?: string[];
  timeliness?: string[];
  limit: number;
  offset: number;
}

export interface TechnicalRecordPage {
  data: TechnicalRecordApiRow[];
  paging: { total: number; limit: number; offset: number };
}

export interface TechnicalStats {
  totalColumns: number;
  totalTables: number;
  totalSources: number;
  mapped: number;
}

/** A physical Column returned by the Add column picker. */
export interface TechnicalColumnCandidate {
  columnKey: string;
  columnFqn: string;
  description?: string;
  declared: boolean;
  termId?: string;
  sourceService?: string;
  sourceDatabase?: string;
  sourceSchema?: string;
  sourceTable?: string;
  sourceColumn?: string;
  sourceDataType?: string;
}

/** The editable values of a record; a missing value clears the stored one. */
export interface TechnicalRecordValues {
  cde?: string;
  rank?: number;
  elementType?: string;
  generationType?: string;
  creationMethod?: string;
  timeliness?: string;
  systemOwners?: TechnicalOwnerInput[];
}

/** Initial values sent when declaring a Column; every value but the Column is optional. */
export interface TechnicalDeclarationRequest extends TechnicalRecordValues {
  columnFqn: string;
}

export interface TechnicalRecordUpdateRequest extends TechnicalRecordValues {
  expectedRevision: number;
}

export interface TechnicalChangeRequest {
  id: string;
  recordId: string;
  operation: TechnicalChangeOperation;
  baseRevision: number;
  status: TechnicalChangeStatus;
  revision: number;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  updatedBy: string;
  proposedValues?: TechnicalRecordValues;
  approvedRecord: TechnicalRecordApiRow;
  proposedRecord?: TechnicalRecordApiRow | null;
}

export interface TechnicalChangeRequestInput extends TechnicalRecordValues {
  expectedRevision: number;
  operation: TechnicalChangeOperation;
}

export interface TechnicalSnapshotSummary {
  dataDictionaryVersion: string;
  bindings: number;
  frozenAt: number;
}

export interface TechnicalImportIssue {
  rowNumber: number;
  column: string;
  code: string;
  message: string;
}

export interface TechnicalImportPreviewRow {
  rowNumber: number;
  action: string;
  errors: TechnicalImportIssue[];
  warnings: string[];
}

export interface TechnicalImportPreview {
  importSessionId: string;
  expiresAt: string;
  fileHash: string;
  dataDictionaryVersion: string;
  summary: Record<string, number>;
  rows: TechnicalImportPreviewRow[];
  truncated: boolean;
  canCommit: boolean;
}

export interface TechnicalExcelFile {
  blob: Blob;
  fileName: string;
}

export interface TechnicalAssetsPage {
  source: TechnicalAssetSource;
  dataDictionaryVersion: string;
  frozenAt?: number | null;
  data: TechnicalRecordApiRow[];
  paging: { total: number; limit: number; offset: number };
}

const csv = (values?: string[]) =>
  values && values.length > 0 ? values.join(',') : undefined;

const fileNameOf = (
  disposition: string | undefined,
  fallback: string
): string => disposition?.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;

export const getTechnicalContext = async (): Promise<TechnicalContext> => {
  const response = await APIClient.get<TechnicalContext>(
    '/glossaryTerms/technical/context'
  );

  return response.data;
};

export const searchTechnicalRecords = async (
  query: TechnicalRecordQuery,
  signal?: AbortSignal
): Promise<TechnicalRecordPage> => {
  const response = await APIClient.get<TechnicalRecordPage>(
    '/glossaryTerms/technical/search',
    {
      params: {
        q: query.q || undefined,
        sourceServices: csv(query.sourceServices),
        cdeMapping: csv(query.cdeMapping),
        cdeTermIds: csv(query.cdeTermIds),
        systemOwnerIds: csv(query.systemOwnerIds),
        sourceStatuses: csv(query.sourceStatuses),
        statuses: csv(query.statuses),
        elementTypes: csv(query.elementTypes),
        generationTypes: csv(query.generationTypes),
        creationMethods: csv(query.creationMethods),
        timeliness: csv(query.timeliness),
        limit: query.limit,
        offset: query.offset,
      },
      signal,
    }
  );

  return response.data;
};

/** One declared Column, shaped like a row of the search list. */
export const getTechnicalRecord = async (
  termId: string
): Promise<TechnicalRecordApiRow> => {
  const response = await APIClient.get<TechnicalRecordApiRow>(
    `/glossaryTerms/technical/records/${termId}`
  );

  return response.data;
};

export const getTechnicalStats = async (): Promise<TechnicalStats> => {
  const response = await APIClient.get<TechnicalStats>(
    '/glossaryTerms/technical/stats'
  );

  return response.data;
};

export const searchTechnicalColumns = async (
  q: string,
  limit: number,
  signal?: AbortSignal
): Promise<TechnicalColumnCandidate[]> => {
  const response = await APIClient.get<{ data: TechnicalColumnCandidate[] }>(
    '/glossaryTerms/technical/columns',
    { params: { q: q || undefined, limit }, signal }
  );

  return response.data.data;
};

export const declareTechnicalColumn = async (
  request: TechnicalDeclarationRequest
): Promise<TechnicalRecordApiRow> => {
  const response = await APIClient.post<
    TechnicalDeclarationRequest,
    AxiosResponse<TechnicalRecordApiRow>
  >('/glossaryTerms/technical/records', request);

  return response.data;
};

export const updateTechnicalRecord = async (
  termId: string,
  request: TechnicalRecordUpdateRequest
): Promise<TechnicalRecordApiRow> => {
  const response = await APIClient.patch<
    TechnicalRecordUpdateRequest,
    AxiosResponse<TechnicalRecordApiRow>
  >(`/glossaryTerms/technical/records/${termId}`, request, {
    // The client sends PATCH as JSON Patch by default; this body is a plain JSON update request.
    headers: { 'Content-Type': 'application/json' },
  });

  return response.data;
};

export const saveTechnicalChangeRequest = async (
  termId: string,
  request: TechnicalChangeRequestInput,
  exists = false
): Promise<TechnicalChangeRequest> => {
  const url = `/glossaryTerms/technical/records/${termId}/change-request`;
  const config = { headers: { 'Content-Type': 'application/json' } };
  const response = exists
    ? await APIClient.patch<
        TechnicalChangeRequestInput,
        AxiosResponse<TechnicalChangeRequest>
      >(url, request, config)
    : await APIClient.post<
        TechnicalChangeRequestInput,
        AxiosResponse<TechnicalChangeRequest>
      >(url, request, config);

  return response.data;
};

export const getTechnicalChangeRequest = async (
  termId: string
): Promise<TechnicalChangeRequest> => {
  const response = await APIClient.get<TechnicalChangeRequest>(
    `/glossaryTerms/technical/records/${termId}/change-request`
  );

  return response.data;
};

const reviewTechnicalChangeRequest = async (
  termId: string,
  action: 'submit' | 'approve' | 'reject',
  expectedRevision: number
) => {
  const response = await APIClient.post<
    { expectedRevision: number },
    AxiosResponse<TechnicalChangeRequest | TechnicalRecordApiRow>
  >(`/glossaryTerms/technical/records/${termId}/change-request/${action}`, {
    expectedRevision,
  });

  return response.data;
};

export const submitTechnicalChangeRequest = (
  termId: string,
  expectedRevision: number
) => reviewTechnicalChangeRequest(termId, 'submit', expectedRevision);

export const approveTechnicalChangeRequest = (
  termId: string,
  expectedRevision: number
) => reviewTechnicalChangeRequest(termId, 'approve', expectedRevision);

export const rejectTechnicalChangeRequest = (
  termId: string,
  expectedRevision: number
) => reviewTechnicalChangeRequest(termId, 'reject', expectedRevision);

export const cancelTechnicalChangeRequest = async (
  termId: string,
  expectedRevision: number
): Promise<void> => {
  await APIClient.delete(
    `/glossaryTerms/technical/records/${termId}/change-request`,
    { params: { expectedRevision } }
  );
};

export const submitTechnicalRecord = async (
  termId: string,
  expectedRevision: number
): Promise<TechnicalRecordApiRow> => {
  const response = await APIClient.post<
    { expectedRevision: number },
    AxiosResponse<TechnicalRecordApiRow>
  >(`/glossaryTerms/technical/records/${termId}/submit`, {
    expectedRevision,
  });

  return response.data;
};

export const approveTechnicalRecord = async (
  termId: string,
  expectedRevision: number
): Promise<TechnicalRecordApiRow> => {
  const response = await APIClient.post<
    { expectedRevision: number },
    AxiosResponse<TechnicalRecordApiRow>
  >(`/glossaryTerms/technical/records/${termId}/approve`, {
    expectedRevision,
  });

  return response.data;
};

export const rejectTechnicalRecord = async (
  termId: string,
  expectedRevision: number
): Promise<TechnicalRecordApiRow> => {
  const response = await APIClient.post<
    { expectedRevision: number },
    AxiosResponse<TechnicalRecordApiRow>
  >(`/glossaryTerms/technical/records/${termId}/reject`, {
    expectedRevision,
  });

  return response.data;
};

/** One record of a bulk submit, approve or reject request, with the revision that was displayed. */
export interface TechnicalBulkReviewItem {
  id: string;
  expectedRevision: number;
}

/** What happened to one record of a bulk request; `record` is set on success, `code` on failure. */
export interface TechnicalBulkReviewOutcome {
  termId: string;
  outcome: 'SUCCEEDED' | 'FAILED';
  record?: TechnicalRecordApiRow;
  code?: string;
  message?: string;
}

export interface TechnicalBulkReviewResult {
  succeeded: number;
  failed: number;
  /** In the order of the request. */
  results: TechnicalBulkReviewOutcome[];
}

const bulkReview = async (
  action: 'submit' | 'approve' | 'reject',
  items: TechnicalBulkReviewItem[]
): Promise<TechnicalBulkReviewResult> => {
  const response = await APIClient.post<
    { items: TechnicalBulkReviewItem[] },
    AxiosResponse<TechnicalBulkReviewResult>
  >(`/glossaryTerms/technical/records/bulk/${action}`, { items });

  return response.data;
};

export const bulkSubmitTechnicalRecords = (items: TechnicalBulkReviewItem[]) =>
  bulkReview('submit', items);

export const bulkApproveTechnicalRecords = (items: TechnicalBulkReviewItem[]) =>
  bulkReview('approve', items);

export const bulkRejectTechnicalRecords = (items: TechnicalBulkReviewItem[]) =>
  bulkReview('reject', items);

export const deleteTechnicalRecord = async (
  termId: string,
  expectedRevision: number
): Promise<void> => {
  await APIClient.delete(`/glossaryTerms/technical/records/${termId}`, {
    params: { expectedRevision },
  });
};

export const exportTechnicalDictionary =
  async (): Promise<TechnicalExcelFile> => {
    const response = await APIClient.get<Blob>(
      '/glossaryTerms/technical/export',
      { responseType: 'blob' }
    );

    return {
      blob: response.data,
      fileName: fileNameOf(
        response.headers['content-disposition'] as string | undefined,
        'TuDienKyThuat.xlsx'
      ),
    };
  };

export const listTechnicalSnapshots = async (): Promise<
  TechnicalSnapshotSummary[]
> => {
  const response = await APIClient.get<{ data: TechnicalSnapshotSummary[] }>(
    '/glossaryTerms/technical/snapshots'
  );

  return response.data.data;
};

/** The frozen records of a replaced Data Dictionary version, read only. */
export const searchTechnicalSnapshotRecords = async (
  dataDictionaryVersion: string,
  query: Pick<TechnicalRecordQuery, 'q' | 'limit' | 'offset'>,
  signal?: AbortSignal
): Promise<TechnicalRecordPage> => {
  const response = await APIClient.get<TechnicalRecordPage>(
    `/glossaryTerms/technical/snapshots/${encodeURIComponent(
      dataDictionaryVersion
    )}/records`,
    {
      params: {
        q: query.q || undefined,
        limit: query.limit,
        offset: query.offset,
      },
      signal,
    }
  );

  return response.data;
};

export interface TechnicalRecordVersions {
  /** Replaced versions that hold this Column, newest first. */
  data: string[];
  /** The record of this Column now, when there is one. */
  currentRecordId?: string | null;
}

export const getTechnicalRecordVersions = async (
  termId: string
): Promise<TechnicalRecordVersions> => {
  const response = await APIClient.get<TechnicalRecordVersions>(
    `/glossaryTerms/technical/records/${termId}/versions`
  );

  return response.data;
};

/** One frozen record of a replaced Data Dictionary version, read only. */
export const getTechnicalSnapshotRecord = async (
  dataDictionaryVersion: string,
  termId: string
): Promise<TechnicalRecordApiRow> => {
  const response = await APIClient.get<TechnicalRecordApiRow>(
    `/glossaryTerms/technical/snapshots/${encodeURIComponent(
      dataDictionaryVersion
    )}/records/${termId}`
  );

  return response.data;
};

export const exportTechnicalSnapshot = async (
  dataDictionaryVersion: string
): Promise<TechnicalExcelFile> => {
  const response = await APIClient.get<Blob>(
    `/glossaryTerms/technical/snapshots/${encodeURIComponent(
      dataDictionaryVersion
    )}/export`,
    { responseType: 'blob' }
  );

  return {
    blob: response.data,
    fileName: fileNameOf(
      response.headers['content-disposition'] as string | undefined,
      `TuDienKyThuat_banchup_v${dataDictionaryVersion}.xlsx`
    ),
  };
};

export const rebuildTechnicalIndex = async (): Promise<void> => {
  await APIClient.post('/glossaryTerms/technical/index/rebuild');
};

export const downloadTechnicalImportTemplate = async (): Promise<Blob> => {
  const response = await APIClient.get<Blob>(
    '/glossaryTerms/import/technical/template',
    { responseType: 'blob' }
  );

  return response.data;
};

export const previewTechnicalImport = async (
  file: File
): Promise<TechnicalImportPreview> => {
  const data = new FormData();
  data.append('file', file);
  const response = await APIClient.post<
    FormData,
    AxiosResponse<TechnicalImportPreview>
  >('/glossaryTerms/import/technical/preview', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};

export const commitTechnicalImport = async (importSessionId: string) => {
  const response = await APIClient.post<{
    committed: number;
    created: number;
    proposed: number;
    updated: number;
  }>(`/glossaryTerms/import/technical/${importSessionId}/commit`);

  return response.data;
};

/** Columns the Technical Dictionary binds to one CDE, for the CDE Assets tab. */
export const getCdeTechnicalAssets = async (
  cdeId: string,
  limit: number,
  offset: number
): Promise<TechnicalAssetsPage> => {
  const response = await APIClient.get<TechnicalAssetsPage>(
    `/glossaryTerms/${cdeId}/technicalAssets`,
    { params: { limit, offset } }
  );

  return response.data;
};

export interface TechnicalHistoryChange {
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
}

export interface TechnicalHistoryEntry {
  id: string;
  /** CREATE, SUBMIT, APPROVE_CHANGE and so on. */
  action: string;
  actor: string;
  at: number;
  dataDictionaryVersion?: string | null;
  changes: TechnicalHistoryChange[];
}

export interface TechnicalHistoryPage {
  data: TechnicalHistoryEntry[];
  paging: { total: number; limit: number; offset: number };
}

/** Who changed a record and when, newest first. */
export const getTechnicalRecordHistory = async (
  termId: string,
  limit: number,
  offset: number
): Promise<TechnicalHistoryPage> => {
  const response = await APIClient.get<TechnicalHistoryPage>(
    `/glossaryTerms/technical/records/${termId}/history`,
    { params: { limit, offset } }
  );

  return response.data;
};
