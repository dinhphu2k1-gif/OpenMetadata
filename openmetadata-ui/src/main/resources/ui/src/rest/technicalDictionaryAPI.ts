/*
 * Copyright 2026 Collate
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import APIClient from './index';

const BASE_URL = '/technical-dictionary';

export type TechnicalScopeStatus = 'Building' | 'Active' | 'Archived';

export interface TechnicalDictionaryScope {
  scopeId: string;
  technicalGlossaryId: string;
  technicalVersionId: string;
  technicalBusinessVersion: string;
  dataDictionaryGlossaryId: string;
  dataDictionaryVersionId: string;
  dataDictionaryBusinessVersion: string;
  scopeStatus: TechnicalScopeStatus;
  revision: number;
  totalColumns: number;
  processedColumns: number;
  failedColumns: number;
}

export interface TechnicalDictionaryRecord {
  recordId: string;
  scopeId: string;
  columnId: string;
  columnFqn: string;
  sourceAvailable: boolean;
  businessVersion: string;
  status: string;
  workingRevision?: number;
  snapshotId?: string;
  cdeSnapshotId?: string;
  payload: Record<string, unknown>;
}

export interface TechnicalDictionaryListResponse {
  data: TechnicalDictionaryRecord[];
  paging: { total: number; limit: number; offset: number };
  scope: TechnicalDictionaryScope;
}

export interface TechnicalCdeOption {
  termId: string;
  snapshotId: string;
  businessVersion: string;
  parentBusinessVersion: string;
  dataDictionaryVersionId: string;
  code: string;
  name?: string;
}

export const getTechnicalDictionaryScopes = async () =>
  APIClient.get<TechnicalDictionaryScope[]>(`${BASE_URL}/scopes`).then(
    ({ data }) => data
  );

export const getTechnicalDictionaryRecords = async (
  scopeId: string,
  params: {
    search?: string;
    status?: string;
    versionView?: 'LATEST' | 'ALL_VERSIONS';
    limit?: number;
    offset?: number;
  }
) =>
  APIClient.get<TechnicalDictionaryListResponse>(
    `${BASE_URL}/scopes/${scopeId}/records`,
    { params }
  ).then(({ data }) => data);

export const getTechnicalDictionaryStats = async (scopeId: string) =>
  APIClient.get<Record<string, number>>(
    `${BASE_URL}/scopes/${scopeId}/stats`
  ).then(({ data }) => data);

export const getTechnicalCdeOptions = async (
  scopeId: string,
  params: { search?: string; limit?: number; offset?: number }
) =>
  APIClient.get<{ data: TechnicalCdeOption[] }>(
    `${BASE_URL}/scopes/${scopeId}/cde-options`,
    { params }
  ).then(({ data }) => data.data);

export const saveTechnicalDictionaryWorking = async (
  scopeId: string,
  recordId: string,
  expectedWorkingRevision: number,
  businessFields: Record<string, unknown>
) =>
  APIClient.patch(
    `${BASE_URL}/scopes/${scopeId}/records/${recordId}/working`,
    { expectedWorkingRevision, businessFields }
  ).then(({ data }) => data);

export const transitionTechnicalDictionaryWorking = async (
  scopeId: string,
  recordId: string,
  action: 'submit' | 'approve' | 'reject' | 'reopen' | 'revoke',
  expectedWorkingRevision: number
) =>
  APIClient.post(
    `${BASE_URL}/scopes/${scopeId}/records/${recordId}/${action}`,
    { expectedWorkingRevision }
  ).then(({ data }) => data);

export const exportTechnicalDictionary = async (
  scopeId: string,
  params: { search?: string; status?: string; versionView?: string }
) => {
  const response = await APIClient.get<Blob>(
    `${BASE_URL}/scopes/${scopeId}/export`,
    { params, responseType: 'blob' }
  );
  const disposition = response.headers['content-disposition'] as
    | string
    | undefined;
  const fileName =
    disposition?.match(/filename="?([^";]+)"?/i)?.[1] ??
    `Technical_Dictionary_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return { blob: response.data, fileName };
};
