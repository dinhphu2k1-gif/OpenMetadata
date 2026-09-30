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
export type TechnicalRecordType = 'working' | 'published' | 'archived';
export type TechnicalBulkAction = 'submit' | 'approve' | 'reject';
export type TechnicalImportPolicy = 'DRAFT_ONLY' | 'ALL_EDITABLE';
/** A flat row of the Technical Dictionary index, as returned by /glossaryTerms/technical/search. */
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
  hasPublished: boolean;
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
  approved: number;
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

/** Initial values sent when declaring a Column; every value but the Column is optional. */
export interface TechnicalDeclarationRequest {
  columnFqn: string;
  cde?: string;
  rank?: number;
  elementType?: string;
  generationType?: string;
  creationMethod?: string;
  timeliness?: string;
  systemOwnerId?: string;
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
    '/glossaryTerms/technical/search',
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
  const response = await APIClient.get<TechnicalStats>(
    '/glossaryTerms/technical/stats',
    { params: { glossary, parentBusinessVersion } }
  );

  return response.data;
};

export const searchTechnicalColumns = async (
  glossary: string,
  parentBusinessVersion: string,
  q: string,
  limit: number,
  signal?: AbortSignal
): Promise<TechnicalColumnCandidate[]> => {
  const response = await APIClient.get<{ data: TechnicalColumnCandidate[] }>(
    '/glossaryTerms/technical/columns',
    { params: { glossary, parentBusinessVersion, q: q || undefined, limit }, signal }
  );

  return response.data.data;
};

export const declareTechnicalColumn = async (
  glossary: string,
  parentBusinessVersion: string,
  request: TechnicalDeclarationRequest
): Promise<TechnicalRecordApiRow> => {
  const response = await APIClient.post<
    TechnicalDeclarationRequest,
    AxiosResponse<TechnicalRecordApiRow>
  >('/glossaryTerms/technical/records', request, {
    params: { glossary, parentBusinessVersion },
  });

  return response.data;
};

export const deleteTechnicalDraft = async (
  termId: string,
  parentBusinessVersion: string
): Promise<void> => {
  await APIClient.delete(`/glossaryTerms/technical/records/${termId}`, {
    params: { parentBusinessVersion },
  });
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
