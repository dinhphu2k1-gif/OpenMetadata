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
import {
  EntityReference,
  TagLabel,
  TermRelation,
} from '../generated/entity/data/glossaryTerm';
import APIClient from './index';

export type TechnicalSourceStatus = 'Available' | 'Unavailable' | 'Changed';
export type TechnicalVersionView = 'LATEST' | 'ALL';
export type TechnicalRecordType = 'working' | 'published' | 'archived';
export type TechnicalBulkAction = 'submit' | 'approve' | 'reject';
export type TechnicalImportPolicy = 'DRAFT_ONLY' | 'ALL_EDITABLE';
export type TechnicalBootstrapStatusValue =
  | 'Pending'
  | 'Running'
  | 'Succeeded'
  | 'Failed';

/** A flat row of the governed read model, as returned by /glossaryTerms/search. */
export interface TechnicalRecordApiRow {
  termId: string;
  name: string;
  displayName?: string;
  description?: string;
  businessVersion: string;
  parentBusinessVersion: string;
  entityStatus: string;
  recordType: TechnicalRecordType;
  workingRevision?: number;
  snapshotId?: string;
  tags?: TagLabel[];
  relatedTerms?: TermRelation[];
  extension?: Record<string, unknown>;
  sourceStatus: TechnicalSourceStatus;
  cdeCode: string;
  cdeName: string;
  dataOwners: EntityReference[];
}

export interface TechnicalRecordQuery {
  glossary: string;
  parentBusinessVersion: string;
  q?: string;
  statuses?: string[];
  sourceServices?: string[];
  cdeMapping?: string[];
  cdeTermIds?: string[];
  systemOwnerIds?: string[];
  sourceStatuses?: string[];
  elementTypes?: string[];
  generationTypes?: string[];
  creationMethods?: string[];
  timeliness?: string[];
  versionView?: TechnicalVersionView;
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
  mappedCde: number;
  totalSources: number;
}

export interface TechnicalBootstrapJob {
  jobId: string;
  businessVersion: string;
  status: TechnicalBootstrapStatusValue;
  total: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  errors?: Array<{ source: string; error: string; message: string }> | null;
  updatedAt: number;
}

export interface TechnicalBulkRequest {
  glossaryId: string;
  parentBusinessVersion: string;
  termIds?: string[];
  criteria?: Record<string, string>;
  dryRun?: boolean;
  offset?: number;
  limit?: number;
}

export interface TechnicalBulkResult {
  action: string;
  dryRun: boolean;
  matched: number;
  eligible: number;
  ineligible: number;
  attempted: number;
  succeeded: number;
  failedCount: number;
  failures: Array<{ termId: string; code: string; message: string }>;
  remaining: number;
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
  glossaryId: string;
  parentBusinessVersion: string;
  updatePolicy: TechnicalImportPolicy;
  summary: Record<string, number>;
  rows: TechnicalImportPreviewRow[];
  truncated: boolean;
  canCommit: boolean;
}

export interface TechnicalExcelFile {
  blob: Blob;
  fileName: string;
}

const csv = (values?: string[]) =>
  values && values.length > 0 ? values.join(',') : undefined;

export const searchTechnicalRecords = async (
  query: TechnicalRecordQuery,
  signal?: AbortSignal
): Promise<TechnicalRecordPage> => {
  const response = await APIClient.get<TechnicalRecordPage>(
    '/glossaryTerms/search',
    {
      params: {
        glossary: query.glossary,
        parentBusinessVersion: query.parentBusinessVersion,
        q: query.q || undefined,
        statuses: csv(query.statuses),
        sourceServices: csv(query.sourceServices),
        cdeMapping: csv(query.cdeMapping),
        cdeTermIds: csv(query.cdeTermIds),
        systemOwnerIds: csv(query.systemOwnerIds),
        sourceStatuses: csv(query.sourceStatuses),
        elementTypes: csv(query.elementTypes),
        generationTypes: csv(query.generationTypes),
        creationMethods: csv(query.creationMethods),
        timeliness: csv(query.timeliness),
        versionView: query.versionView,
        limit: query.limit,
        offset: query.offset,
      },
      signal,
    }
  );

  return response.data;
};

export const getTechnicalStats = async (
  glossary: string,
  parentBusinessVersion: string
): Promise<TechnicalStats> => {
  const response = await APIClient.get<TechnicalStats>('/glossaryTerms/stats', {
    params: { glossary, parentBusinessVersion },
  });

  return response.data;
};

export const exportTechnicalDictionary = async (
  glossary: string,
  parentBusinessVersion: string
): Promise<TechnicalExcelFile> => {
  const response = await APIClient.get<Blob>('/glossaryTerms/export', {
    params: { glossary, parentBusinessVersion },
    responseType: 'blob',
  });
  const disposition = response.headers['content-disposition'] as
    | string
    | undefined;
  const match = disposition?.match(/filename="?([^";]+)"?/i);

  return {
    blob: response.data,
    fileName: match?.[1] ?? `TuDienKyThuat_v${parentBusinessVersion}.xlsx`,
  };
};

export const getTechnicalBootstrapJobs = async (
  glossaryId: string,
  businessVersion?: string
): Promise<TechnicalBootstrapJob[]> => {
  const response = await APIClient.get<TechnicalBootstrapJob[]>(
    `/glossaries/${glossaryId}/bootstrap-jobs`,
    { params: { businessVersion } }
  );

  return response.data;
};

export const retryTechnicalBootstrapJob = async (
  glossaryId: string,
  jobId: string
): Promise<TechnicalBootstrapJob> => {
  const response = await APIClient.post<TechnicalBootstrapJob>(
    `/glossaries/${glossaryId}/bootstrap-jobs/${jobId}/retry`
  );

  return response.data;
};

export const startTechnicalBootstrapJob = async (
  glossaryId: string,
  businessVersion: string
): Promise<TechnicalBootstrapJob> => {
  const response = await APIClient.post<TechnicalBootstrapJob>(
    `/glossaries/${glossaryId}/bootstrap-jobs`,
    undefined,
    { params: { businessVersion } }
  );

  return response.data;
};

export const runTechnicalBulkWorkflow = async (
  action: TechnicalBulkAction,
  request: TechnicalBulkRequest
): Promise<TechnicalBulkResult> => {
  const response = await APIClient.post<
    TechnicalBulkRequest,
    AxiosResponse<TechnicalBulkResult>
  >(`/glossaryTerms/bulk/${action}`, request);

  return response.data;
};

export const downloadTechnicalImportTemplate = async (): Promise<Blob> => {
  const response = await APIClient.get<Blob>(
    '/glossaryTerms/import/technical/template',
    { responseType: 'blob' }
  );

  return response.data;
};

export const previewTechnicalImport = async (
  glossary: string,
  parentBusinessVersion: string,
  updatePolicy: TechnicalImportPolicy,
  file: File
): Promise<TechnicalImportPreview> => {
  const data = new FormData();
  data.append('file', file);
  const response = await APIClient.post<
    FormData,
    AxiosResponse<TechnicalImportPreview>
  >('/glossaryTerms/import/technical/preview', data, {
    params: { glossary, parentBusinessVersion, updatePolicy },
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};

export const commitTechnicalImport = async (importSessionId: string) => {
  const response = await APIClient.post<{ committed: number }>(
    `/glossaryTerms/import/technical/${importSessionId}/commit`
  );

  return response.data;
};
