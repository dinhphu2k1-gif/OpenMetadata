/*
 * Copyright 2026 Collate
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import APIClient from './index';
import { EntityStatus } from '../generated/entity/data/glossaryTerm';

const BASE_URL = '/technical-dictionary';

export interface TechnicalDictionaryCatalog {
  technicalGlossaryId: string;
  businessVersion: string;
  status: EntityStatus;
  workingRevision?: number;
  historical: boolean;
}

export interface TechnicalDictionaryBootstrapStatus {
  status: 'Pending' | 'Running' | 'Succeeded' | 'Failed';
  total: number;
  processed: number;
  failed: number;
}

export interface TechnicalDictionaryRecord {
  recordId: string;
  columnId: string;
  columnFqn: string;
  sourceAvailable: boolean;
  businessVersion: string;
  status: EntityStatus;
  workingRevision?: number;
  snapshotId?: string;
  cdeSnapshotId?: string;
  payload: Record<string, unknown>;
}

export interface TechnicalDictionaryListResponse {
  data: TechnicalDictionaryRecord[];
  paging: { total: number; limit: number; offset: number };
  catalog: TechnicalDictionaryCatalog;
  bootstrap: TechnicalDictionaryBootstrapStatus;
  capabilities: TechnicalDictionaryCapabilities;
}

export interface TechnicalDictionaryCapabilities {
  canViewPublished: boolean;
  canViewWorking: boolean;
  canEditWorking: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canRevoke: boolean;
  canCreateVersion: boolean;
  canExport: boolean;
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

export const getTechnicalDictionaryVersions = async () =>
  APIClient.get<{ data: TechnicalDictionaryCatalog[] }>(
    `${BASE_URL}/versions`
  ).then(({ data }) => data.data ?? []);

export const getTechnicalDictionaryRecords = async (params: {
  businessVersion?: string;
  search?: string;
  status?: string;
  sources?: string;
  cdeMapping?: string;
  elementTypes?: string;
  generationTypes?: string;
  creationMethods?: string;
  versionView?: 'LATEST' | 'ALL_VERSIONS';
  limit?: number;
  offset?: number;
}) =>
  APIClient.get<TechnicalDictionaryListResponse>(`${BASE_URL}/records`, {
    params,
  }).then(({ data }) => data);

export const getTechnicalDictionaryStats = async (businessVersion?: string) =>
  APIClient.get<Record<string, number>>(`${BASE_URL}/stats`, {
    params: { businessVersion },
  }).then(({ data }) => data);

export const getTechnicalCdeOptions = async (params: {
  businessVersion?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) =>
  APIClient.get<{ data: TechnicalCdeOption[] }>(`${BASE_URL}/cde-options`, {
    params,
  }).then(({ data }) => data.data);

export const saveTechnicalDictionaryWorking = async (
  recordId: string,
  parentBusinessVersion: string,
  expectedWorkingRevision: number,
  businessFields: Record<string, unknown>
) =>
  APIClient.patch(`${BASE_URL}/records/${recordId}/working`, {
    parentBusinessVersion,
    expectedWorkingRevision,
    businessFields,
  }).then(({ data }) => data);

export const transitionTechnicalDictionaryWorking = async (
  recordId: string,
  parentBusinessVersion: string,
  action: 'submit' | 'approve' | 'reject' | 'reopen' | 'revoke',
  expectedWorkingRevision: number
) =>
  APIClient.post(`${BASE_URL}/records/${recordId}/${action}`, {
    parentBusinessVersion,
    expectedWorkingRevision,
  }).then(({ data }) => data);

export const createTechnicalDictionaryRecordVersion = async (
  recordId: string,
  parentBusinessVersion: string
) =>
  APIClient.post(`${BASE_URL}/records/${recordId}/versions`, {
    parentBusinessVersion,
  }).then(({ data }) => data);

export const getTechnicalDictionaryRecordVersions = async (
  recordId: string,
  parentBusinessVersion: string
) =>
  APIClient.get<Array<Record<string, unknown>>>(
    `${BASE_URL}/records/${recordId}/versions`,
    { params: { parentBusinessVersion } }
  ).then(({ data }) => data);

export const exportTechnicalDictionary = async (params: {
  businessVersion?: string;
  search?: string;
  status?: string;
  sources?: string;
  cdeMapping?: string;
  elementTypes?: string;
  generationTypes?: string;
  creationMethods?: string;
  versionView?: string;
}) => {
  const response = await APIClient.get<Blob>(`${BASE_URL}/export`, {
    params,
    responseType: 'blob',
  });
  const disposition = response.headers['content-disposition'] as
    | string
    | undefined;
  const fileName =
    disposition?.match(/filename="?([^";]+)"?/i)?.[1] ??
    `Technical_Dictionary_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return { blob: response.data, fileName };
};
