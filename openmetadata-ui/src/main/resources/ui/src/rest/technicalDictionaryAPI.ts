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
export type TechnicalAssetSource = 'CURRENT' | 'SNAPSHOT' | 'NONE';

export interface TechnicalTagValue {
  fqn: string;
  label: string;
}

export interface TechnicalNamedReference {
  id: string;
  name: string;
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
  cde?: TechnicalCdeValue;
  dataOwners?: TechnicalNamedReference[];
  rank?: number;
  elementType?: TechnicalTagValue;
  generationType?: TechnicalTagValue;
  creationMethod?: TechnicalTagValue;
  timeliness?: TechnicalTagValue;
  systemOwner?: TechnicalNamedReference;
  createdAt?: number;
  createdBy?: string;
  updatedAt?: number;
  updatedBy?: string;
}

export interface TechnicalCapabilities {
  canView: boolean;
  canEdit: boolean;
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
  systemOwnerId?: string;
}

/** Initial values sent when declaring a Column; every value but the Column is optional. */
export interface TechnicalDeclarationRequest extends TechnicalRecordValues {
  columnFqn: string;
}

export interface TechnicalRecordUpdateRequest extends TechnicalRecordValues {
  expectedRevision: number;
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
  const response = await APIClient.post<{ committed: number }>(
    `/glossaryTerms/import/technical/${importSessionId}/commit`
  );

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
