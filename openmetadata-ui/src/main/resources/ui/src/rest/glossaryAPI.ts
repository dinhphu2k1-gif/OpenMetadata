/*
 *  Copyright 2022 Collate.
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
import { applyPatch, Operation } from 'fast-json-patch';
import { PagingResponse } from 'Models';
import { CSVExportResponse } from '../components/Entity/EntityExportModalProvider/EntityExportModalProvider.interface';
import { VotingDataProps } from '../components/Entity/Voting/voting.interface';
import { MoveGlossaryTermWebsocketResponse } from '../components/Modals/ChangeParentHierarchy/ChangeParentHierarchy.interface';
import { ES_MAX_PAGE_SIZE, PAGE_SIZE_MEDIUM } from '../constants/constants';
import { DATA_QUALITY_GLOSSARY_NAME } from '../constants/Glossary.contant';
import { TabSpecificField } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { AddGlossaryToAssetsRequest } from '../generated/api/addGlossaryToAssetsRequest';
import { CDEDraftUpdateRequest as CdeDraftUpdateRequest } from '../generated/api/data/cdeDraftUpdateRequest';
import { CDEWorkflowTransitionRequest as CdeWorkflowTransitionRequest } from '../generated/api/data/cdeWorkflowTransitionRequest';
import { CreateGlossary } from '../generated/api/data/createGlossary';
import { CreateGlossaryTerm } from '../generated/api/data/createGlossaryTerm';
import { GlossaryWorkflowTransitionRequest } from '../generated/api/data/glossaryWorkflowTransitionRequest';
import { MoveGlossaryTermRequest } from '../generated/api/tests/moveGlossaryTermRequest';
import { GlossaryTermRelationType } from '../generated/configuration/glossaryTermRelationSettings';
import { EntityReference, Glossary } from '../generated/entity/data/glossary';
import { GlossaryTerm } from '../generated/entity/data/glossaryTerm';
import { BulkOperationResult } from '../generated/type/bulkOperationResult';
import { ChangeEvent } from '../generated/type/changeEvent';
import { EntityHistory } from '../generated/type/entityHistory';
import { Include } from '../generated/type/include';
import { ListParams, ListParamsWithOffset } from '../interface/API.interface';
import {
  normalizeCdeParentBusinessVersion,
  parseCdeRoute,
} from '../utils/routing/cdeRoutingHelper';
import { getEncodedFqn } from '../utils/StringUtils';
import APIClient from './index';

export type ListGlossaryTermsParams = ListParamsWithOffset & {
  glossary?: string;
  parent?: string;
  entityStatus?: string;
  parentBusinessVersion?: string;
};

export type SearchGlossaryTermsParams = ListParamsWithOffset & {
  q?: string;
  glossary?: string;
  glossaryFqn?: string;
  parent?: string;
  parentFqn?: string;
  entityStatus?: string;
  parentBusinessVersion?: string;
  statuses?: string;
  domainIds?: string;
  ownerIds?: string;
  dataSourceTags?: string;
  classificationTags?: string;
  include?: Include;
  includeDeleted?: boolean;
  sortField?: 'name' | 'displayName' | 'businessVersion' | 'entityStatus';
  sortOrder?: 'asc' | 'desc';
};

export interface DataDictionaryExcelExport {
  blob: Blob;
  fileName: string;
}

const BASE_URL = '/glossaries';
const PERMISSION_CACHE_MAX_SIZE = 100;
const PERMISSION_CACHE_TTL_MS = 30_000;

interface PermissionCacheEntry {
  expiresAt: number;
  id: string;
  promise: Promise<GlossaryVersionPermissions>;
}

const glossaryPermissionCache: PermissionCacheEntry[] = [];
const glossaryTermPermissionCache: PermissionCacheEntry[] = [];
const glossaryWorkingRequests: Array<{
  id: string;
  promise: Promise<Glossary>;
}> = [];
const glossaryTermWorkingRequests: Array<{
  id: string;
  promise: Promise<GlossaryTerm>;
}> = [];

const removeCachedRequest = <
  T extends { id: string; promise: Promise<unknown> }
>(
  cache: T[],
  id: string,
  promise?: Promise<unknown>
) => {
  const index = cache.findIndex(
    (entry) => entry.id === id && (!promise || entry.promise === promise)
  );
  if (index >= 0) {
    cache.splice(index, 1);
  }
};

const addBoundedEntry = <T>(cache: T[], entry: T) => {
  if (cache.length >= PERMISSION_CACHE_MAX_SIZE) {
    cache.shift();
  }
  cache.push(entry);
};

const getCachedPermissions = (
  cache: PermissionCacheEntry[],
  id: string,
  fetchPermissions: () => Promise<GlossaryVersionPermissions>
) => {
  const now = Date.now();
  const cached = cache.find((entry) => entry.id === id);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }
  if (cached) {
    removeCachedRequest(cache, id, cached.promise);
  }

  const promise = fetchPermissions()
    .then((permissions) => {
      const activeEntry = cache.find(
        (entry) => entry.id === id && entry.promise === promise
      );
      if (activeEntry) {
        activeEntry.expiresAt = Date.now() + PERMISSION_CACHE_TTL_MS;
      }

      return permissions;
    })
    .catch((error: unknown) => {
      removeCachedRequest(cache, id, promise);

      throw error;
    });
  addBoundedEntry(cache, {
    expiresAt: Number.POSITIVE_INFINITY,
    id,
    promise,
  });

  return promise;
};

export const invalidateGlossaryVersionPermissions = (id?: string) => {
  if (id) {
    removeCachedRequest(glossaryPermissionCache, id);
  } else {
    glossaryPermissionCache.splice(0);
  }
};

export const invalidateGlossaryTermVersionPermissions = (id?: string) => {
  if (id) {
    removeCachedRequest(glossaryTermPermissionCache, id);
  } else {
    glossaryTermPermissionCache.splice(0);
  }
};

const parentScopeFromRoute = () => {
  const scope = parseCdeRoute({
    pathname: globalThis.location?.pathname,
    search: globalThis.location?.search,
  }).parentBusinessVersion;
  if (!scope) {
    throw new Error(
      'parentBusinessVersion is required for governed glossary term operations'
    );
  }

  return scope;
};

export type GlossaryWorkflowAction =
  | 'createDraft'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'reopen'
  | 'withdraw';

export interface GlossaryDraftPayload {
  description: string;
  owners: Glossary['owners'];
  reviewers: Glossary['reviewers'];
  domains: Glossary['domains'];
  tags: Glossary['tags'];
  extension?: Glossary['extension'];
}

export interface GlossaryWorkflowRequest {
  expectedRevision?: number;
  businessVersion?: string;
  payload?: Glossary | GlossaryTerm;
}

export interface GlossaryPublishPreview {
  data: NonNullable<Glossary['termRevisions']>;
  paging: { after?: string };
  termCount: number;
  evaluatedAt: number;
}

export interface GlossaryVersionPermissions {
  isConsumer?: boolean;
  canViewWorking: boolean;
  canViewPublished: boolean;
  canEditWorking: boolean;
  canSubmit: boolean;
  canCreateVersion: boolean;
  canApprove: boolean;
  canReject: boolean;
  canArchive: boolean;
  canImportCdeDrafts?: boolean;
}

export interface CdeImportIssue {
  rowNumber: number;
  column: string;
  code: string;
  message: string;
}

export interface CdeImportPreviewRow {
  rowNumber: number;
  cdeCode: string;
  action: string;
  businessVersion?: string;
  payload?: Record<string, unknown>;
  warnings: string[];
  errors: CdeImportIssue[];
}

export interface CdeImportPreview {
  importSessionId: string;
  expiresAt: string;
  fileHash: string;
  existingCodePolicy: CdeExistingCodePolicy;
  summary: Record<string, number>;
  rows: CdeImportPreviewRow[];
  canCommit: boolean;
}

export type CdeExistingCodePolicy = 'SKIP_EXISTING' | 'OVERWRITE_EXISTING';

export const getGlossariesList = async (params?: ListParams) => {
  const response = await APIClient.get<PagingResponse<Glossary[]>>(BASE_URL, {
    params,
  });

  return response.data;
};

export const addGlossaries = async (data: CreateGlossary) => {
  const url = '/glossaries';

  const response = await APIClient.post<
    CreateGlossary,
    AxiosResponse<Glossary>
  >(url, data);

  return response.data;
};

export const getGlossariesByName = async (fqn: string, params?: ListParams) => {
  const response = await APIClient.get<Glossary>(
    `/glossaries/name/${getEncodedFqn(fqn)}`,
    {
      params,
    }
  );

  return response.data;
};

export const getGlossariesById = async (id: string, params?: ListParams) => {
  const response = await APIClient.get<Glossary>(`/glossaries/${id}`, {
    params,
  });

  return response.data;
};

export const getLatestPublishedGlossary = async (id: string) => {
  const response = await APIClient.get<Glossary>(
    `/glossaries/${id}/published/latest`
  );

  return response.data;
};

export const getGlossaryWorkingVersion = (id: string) => {
  const activeRequest = glossaryWorkingRequests.find(
    (request) => request.id === id
  );
  if (activeRequest) {
    return activeRequest.promise;
  }

  const promise = APIClient.get<Glossary>(`/glossaries/${id}/working`)
    .then((response) => response.data)
    .finally(() => removeCachedRequest(glossaryWorkingRequests, id, promise));
  addBoundedEntry(glossaryWorkingRequests, { id, promise });

  return promise;
};

export const updateGlossaryWorkingVersion = async (
  id: string,
  expectedRevision: number,
  payload: Glossary
) => {
  const mutablePayload: GlossaryDraftPayload = {
    description: payload.description,
    owners: payload.owners ?? [],
    domains: payload.domains ?? [],
    tags: payload.tags ?? [],
    extension: payload.extension,
  };
  const response = await APIClient.patch<
    { expectedRevision: number; payload: GlossaryDraftPayload },
    AxiosResponse<Glossary>
  >(
    `/glossaries/${id}/working`,
    { expectedRevision, payload: mutablePayload },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  invalidateGlossaryVersionPermissions(id);

  return response.data;
};

export const patchGlossaries = async (id: string, patch: Operation[]) => {
  const working = await getGlossaryWorkingVersion(id);
  const payload = applyPatch(
    structuredClone(working),
    patch,
    true,
    false
  ).newDocument;

  return updateGlossaryWorkingVersion(
    id,
    working.workingRevision as number,
    payload
  );
};

export const getPublishedGlossaryTerms = async (
  id: string,
  businessVersion: string
) => {
  const response = await APIClient.get<GlossaryTerm[]>(
    `/glossaries/${id}/published/${businessVersion}/terms`
  );

  return response.data;
};

export const getGlossaryPublishPreview = async (
  id: string,
  params?: { limit?: number; after?: string }
) => {
  const response = await APIClient.get<GlossaryPublishPreview>(
    `/glossaries/${id}/working/publish-preview`,
    { params }
  );

  return response.data;
};

export const getGlossaryVersionPermissions = (id: string) =>
  getCachedPermissions(glossaryPermissionCache, id, async () => {
    const response = await APIClient.get<GlossaryVersionPermissions>(
      `/glossaries/${id}/permissions`
    );

    return response.data;
  });

export const transitionGlossaryWorkflow = async (
  id: string,
  action: GlossaryWorkflowAction,
  request: GlossaryWorkflowRequest | GlossaryWorkflowTransitionRequest
) => {
  if (action !== 'createDraft') {
    request = { expectedRevision: request.expectedRevision as number };
  } else {
    request = {
      businessVersion: (request as GlossaryWorkflowRequest)
        .businessVersion as string,
    };
  }
  const path = action === 'createDraft' ? 'working' : `working/${action}`;
  const response = await APIClient.post<
    GlossaryWorkflowRequest,
    AxiosResponse<Glossary>
  >(`/glossaries/${id}/${path}`, request);

  invalidateGlossaryVersionPermissions(id);

  return response.data;
};

export const getGlossaryTerms = async (params: ListGlossaryTermsParams) => {
  const response = await APIClient.get<PagingResponse<GlossaryTerm[]>>(
    '/glossaryTerms',
    {
      params,
    }
  );

  return response.data;
};

export const exportDataDictionaryVersion = async (
  glossaryId: string,
  parentBusinessVersion: string
): Promise<DataDictionaryExcelExport> => {
  const response = await APIClient.get<Blob>('/glossaryTerms/export', {
    params: { glossary: glossaryId, parentBusinessVersion },
    responseType: 'blob',
  });
  const disposition = response.headers['content-disposition'] as
    | string
    | undefined;
  const match = disposition?.match(/filename="?([^";]+)"?/i);

  return {
    blob: response.data,
    fileName:
      match?.[1] ??
      `Agribank_CDE_Danh_Tu_Dien_Du_Lieu_v${parentBusinessVersion}.xlsx`,
  };
};

export const downloadCdeImportTemplate = async (): Promise<Blob> => {
  const response = await APIClient.get<Blob>('/glossaryTerms/import/template', {
    responseType: 'blob',
  });

  return response.data;
};

export const previewCdeImport = async (
  glossaryId: string,
  parentBusinessVersion: string,
  existingCodePolicy: CdeExistingCodePolicy,
  file: File
): Promise<CdeImportPreview> => {
  const data = new FormData();
  data.append('file', file);
  const response = await APIClient.post<
    FormData,
    AxiosResponse<CdeImportPreview>
  >('/glossaryTerms/import/preview', data, {
    params: { glossary: glossaryId, parentBusinessVersion, existingCodePolicy },
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};

export const commitCdeImport = async (importSessionId: string) => {
  const response = await APIClient.post(
    `/glossaryTerms/import/${importSessionId}/commit`
  );

  invalidateGlossaryTermVersionPermissions();

  return response.data;
};

export const queryGlossaryTerms = async (glossaryName: string) => {
  const apiUrl = `/search/query`;

  const { data } = await APIClient.get(apiUrl, {
    params: {
      index: SearchIndex.GLOSSARY_TERM,
      q: '',
      from: 0,
      size: ES_MAX_PAGE_SIZE,
      deleted: false,
      track_total_hits: true,
      query_filter: JSON.stringify({
        query: {
          bool: {
            must: [
              {
                term: {
                  'glossary.name.keyword': glossaryName.toLocaleLowerCase(),
                },
              },
            ],
          },
        },
      }),
      getHierarchy: true,
    },
  });

  return data;
};

export const getGlossaryTermsById = async (id: string, params?: ListParams) => {
  const response = await APIClient.get<GlossaryTerm>(`/glossaryTerms/${id}`, {
    params,
  });

  return response.data;
};

export const getLatestPublishedGlossaryTerm = async (id: string) => {
  const response = await APIClient.get<GlossaryTerm>(
    `/glossaryTerms/${id}/published/latest`
  );

  return response.data;
};

export const getPublishedGlossaryTerm = async (
  id: string,
  businessVersion: string,
  parentBusinessVersion?: string
) => {
  const response = await APIClient.get<GlossaryTerm>(
    `/glossaryTerms/${id}/published/${encodeURIComponent(businessVersion)}`,
    { params: { parentBusinessVersion } }
  );

  return response.data;
};

export const getGlossaryTermWorkingVersion = (
  id: string,
  parentBusinessVersion?: string
) => {
  const normalizedParentBusinessVersion =
    normalizeCdeParentBusinessVersion(parentBusinessVersion) ??
    parentScopeFromRoute();
  const requestId = `${id}:${normalizedParentBusinessVersion}`;
  const activeRequest = glossaryTermWorkingRequests.find(
    (request) => request.id === requestId
  );
  if (activeRequest) {
    return activeRequest.promise;
  }

  const promise = APIClient.get<GlossaryTerm>(`/glossaryTerms/${id}/working`, {
    params: { parentBusinessVersion: normalizedParentBusinessVersion },
  })
    .then((response) => response.data)
    .finally(() =>
      removeCachedRequest(glossaryTermWorkingRequests, requestId, promise)
    );
  addBoundedEntry(glossaryTermWorkingRequests, { id: requestId, promise });

  return promise;
};

export const createGlossaryTermWorkingVersion = async (
  id: string,
  businessVersion: string,
  parentBusinessVersion: string
) => {
  const response = await APIClient.post<
    { businessVersion: string },
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${id}/working`, {
    businessVersion,
    parentBusinessVersion:
      normalizeCdeParentBusinessVersion(parentBusinessVersion) ??
      parentBusinessVersion,
  });

  invalidateGlossaryTermVersionPermissions(id);

  return response.data;
};

export const discardGlossaryTermWorkingVersion = async (
  id: string,
  expectedRevision: number,
  parentBusinessVersion: string
) => {
  const response = await APIClient.delete<{
    discarded: boolean;
    termDeleted: boolean;
  }>(`/glossaryTerms/${id}/working`, {
    params: {
      expectedRevision,
      parentBusinessVersion:
        normalizeCdeParentBusinessVersion(parentBusinessVersion) ??
        parentBusinessVersion,
    },
  });

  invalidateGlossaryTermVersionPermissions(id);

  return response.data;
};

export const createGlossaryTermCorrection = async (
  id: string,
  businessVersion: string,
  parentBusinessVersion: string
) => {
  const response = await APIClient.post<undefined, AxiosResponse<GlossaryTerm>>(
    `/glossaryTerms/${id}/published/${encodeURIComponent(
      businessVersion
    )}/correction`,
    undefined,
    {
      params: {
        parentBusinessVersion:
          normalizeCdeParentBusinessVersion(parentBusinessVersion) ??
          parentBusinessVersion,
      },
    }
  );

  invalidateGlossaryTermVersionPermissions(id);

  return response.data;
};

export const requestGlossaryTermDeletion = async (
  id: string,
  parentBusinessVersion: string
) => {
  const response = await APIClient.post<undefined, AxiosResponse<GlossaryTerm>>(
    `/glossaryTerms/${id}/working/deletion`,
    undefined,
    {
      params: {
        parentBusinessVersion:
          normalizeCdeParentBusinessVersion(parentBusinessVersion) ??
          parentBusinessVersion,
      },
    }
  );

  invalidateGlossaryTermVersionPermissions(id);

  return response.data;
};

/** Working records of one glossary version, filtered by status, with offset pagination. */
export const getGlossaryWorkingRecords = async (params: {
  glossaryId: string;
  parentBusinessVersion: string;
  statuses: string[];
  q?: string;
  limit: 10 | 15 | 25 | 50;
  offset: number;
}) => {
  const { parentBusinessVersion, statuses, ...rest } = params;
  const response = await APIClient.get<{
    data: Array<GlossaryTerm & { termId?: string; recordType?: string }>;
    paging: { total: number; limit: number; offset: number };
  }>('/glossaryTerms/search', {
    params: {
      ...rest,
      glossary: params.glossaryId,
      glossaryId: undefined,
      statuses: statuses.join(','),
      parentBusinessVersion:
        normalizeCdeParentBusinessVersion(parentBusinessVersion) ??
        parentBusinessVersion,
    },
  });

  return response.data;
};

export interface GlossaryBulkWorkflowFailure {
  termId?: string;
  code?: string;
  message?: string;
}

export interface GlossaryBulkWorkflowResult {
  eligible: number;
  succeeded: number;
  failedCount: number;
  failures: GlossaryBulkWorkflowFailure[];
  remaining: number;
}

/** Applies one workflow action to the working records of the given terms, one chunk per call. */
export const bulkGlossaryTermWorkflow = async (
  action: Exclude<GlossaryWorkflowAction, 'createDraft' | 'reopen'>,
  request: {
    glossaryId: string;
    parentBusinessVersion: string;
    termIds: string[];
    offset?: number;
  }
) => {
  const response = await APIClient.post<
    typeof request,
    AxiosResponse<GlossaryBulkWorkflowResult>
  >(`/glossaryTerms/bulk/${action}`, {
    ...request,
    parentBusinessVersion:
      normalizeCdeParentBusinessVersion(request.parentBusinessVersion) ??
      request.parentBusinessVersion,
  });

  request.termIds.forEach((id) => invalidateGlossaryTermVersionPermissions(id));

  return response.data;
};

export interface GlossaryTermCorrectionHistoryEntry extends GlossaryTerm {
  historyId: string;
  snapshotId: string;
  contentHash: string;
  publishedAt: number;
  publishedBy: string;
  supersededAt: number;
  supersededBy: string;
  proposedAt?: number | null;
  proposedBy?: string | null;
  changes?: {
    field: string;
    oldValue?: string | null;
    newValue?: string | null;
  }[];
}

export const getGlossaryTermCorrectionHistory = async (
  id: string,
  businessVersion: string,
  parentBusinessVersion?: string
) => {
  const response = await APIClient.get<GlossaryTermCorrectionHistoryEntry[]>(
    `/glossaryTerms/${id}/published/${encodeURIComponent(
      businessVersion
    )}/history`,
    {
      params: {
        parentBusinessVersion:
          normalizeCdeParentBusinessVersion(parentBusinessVersion) ??
          parentScopeFromRoute(),
      },
    }
  );

  return response.data;
};

export const updateGlossaryTermWorkingVersion = async (
  id: string,
  expectedRevision: number,
  payload: GlossaryTerm,
  parentBusinessVersion?: string
) => {
  const extension = {
    ...((payload.extension as Record<string, unknown>) ?? {}),
  };
  delete extension.releaseVersionType;
  const request: CdeDraftUpdateRequest = {
    expectedRevision,
    displayName: payload.displayName ?? null,
    description: payload.description ?? '',
    owners: payload.owners ?? [],
    // Reviewers are not part of the CDE authoring payload.
    domains: payload.domains ?? [],
    // The canonical CDE relation is read-only, but must survive a complete
    // working-payload replacement.
    relatedTerms: payload.relatedTerms ?? [],
    tags: payload.tags ?? [],
    extension,
    // Only a Data Quality Rule carries test declarations; undefined keeps them as they are.
    dataQualityTestSpecs: payload.dataQualityTestSpecs,
  };
  const response = await APIClient.patch<
    CdeDraftUpdateRequest,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${id}/working`, request, {
    params: {
      parentBusinessVersion:
        normalizeCdeParentBusinessVersion(parentBusinessVersion) ??
        normalizeCdeParentBusinessVersion(payload.parentBusinessVersion) ??
        parentScopeFromRoute(),
    },
    headers: { 'Content-Type': 'application/json' },
  });

  invalidateGlossaryTermVersionPermissions(id);

  return response.data;
};

export const getGlossaryTermVersionPermissions = (id: string) =>
  getCachedPermissions(glossaryTermPermissionCache, id, async () => {
    const response = await APIClient.get<GlossaryVersionPermissions>(
      `/glossaryTerms/${id}/permissions`
    );

    return response.data;
  });

export async function transitionGlossaryTermWorkflow(
  id: string,
  action: 'submit' | 'reject' | 'reopen' | 'withdraw',
  request: CdeWorkflowTransitionRequest,
  parentBusinessVersion?: string
): Promise<GlossaryTerm>;
export async function transitionGlossaryTermWorkflow(
  id: string,
  action: Exclude<
    GlossaryWorkflowAction,
    'submit' | 'reject' | 'reopen' | 'withdraw'
  >,
  request: GlossaryWorkflowRequest,
  parentBusinessVersion?: string
): Promise<GlossaryTerm>;
export async function transitionGlossaryTermWorkflow(
  id: string,
  action: GlossaryWorkflowAction,
  request: GlossaryWorkflowRequest | CdeWorkflowTransitionRequest,
  parentBusinessVersion?: string
) {
  const path = action === 'createDraft' ? 'working' : `working/${action}`;
  const resolvedParentBusinessVersion =
    normalizeCdeParentBusinessVersion(parentBusinessVersion) ??
    parentScopeFromRoute();
  const requestBody =
    action === 'createDraft'
      ? {
          ...request,
          parentBusinessVersion: resolvedParentBusinessVersion,
        }
      : request;
  const response = await APIClient.post<
    GlossaryWorkflowRequest,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${id}/${path}`, requestBody, {
    params:
      action === 'createDraft'
        ? undefined
        : {
            parentBusinessVersion: resolvedParentBusinessVersion,
          },
  });

  invalidateGlossaryTermVersionPermissions(id);

  return response.data;
}

// Batch fetch up to 100 glossary terms by Id in a single round-trip.
// 100 matches the backend MAX_BATCH_BY_IDS cap — going higher would 400
// (or 431 once the URL clears Jetty's 8 KB header limit). Replaces the
// per-Id resolution N+1 inside the Relations Graph hook
// (useOntologyExplorer). Missing/unauthorized Ids are silently dropped
// by the backend, so callers should compare response length to input.
export const getGlossaryTermsByIds = async (
  ids: string[],
  params?: ListParams & { parentBusinessVersion?: string }
): Promise<GlossaryTerm[]> => {
  if (ids.length === 0) {
    return [];
  }
  const response = await APIClient.get<GlossaryTerm[]>('/glossaryTerms/byIds', {
    params: {
      ...params,
      ids: ids.join(','),
    },
  });

  return response.data;
};

export const getGlossaryTermByFQN = async (fqn = '', params?: ListParams) => {
  const response = await APIClient.get<GlossaryTerm>(
    `/glossaryTerms/name/${getEncodedFqn(fqn)}`,
    { params }
  );

  return response.data;
};

export const addGlossaryTerm = async (
  data: CreateGlossaryTerm
): Promise<GlossaryTerm> => {
  const url = '/glossaryTerms';

  const response = await APIClient.post(url, data);

  return response.data;
};

export const patchGlossaryTerm = async (id: string, patch: Operation[]) => {
  const working = await getGlossaryTermWorkingVersion(id);
  const payload = applyPatch(
    structuredClone(working),
    patch,
    true,
    false
  ).newDocument;

  return updateGlossaryTermWorkingVersion(
    id,
    working.workingRevision as number,
    payload
  );
};

export const moveGlossaryTerm = async (id: string, parent: EntityReference) => {
  const response = await APIClient.put<
    MoveGlossaryTermRequest,
    AxiosResponse<MoveGlossaryTermWebsocketResponse>
  >(`/glossaryTerms/${id}/moveAsync`, {
    parent,
  });

  return response.data;
};

export const exportGlossaryInCSVFormat = async (glossaryName: string) => {
  const response = await APIClient.get<CSVExportResponse>(
    `/glossaries/name/${getEncodedFqn(glossaryName)}/exportAsync`
  );

  return response.data;
};

export const exportGlossaryTermsInCSVFormat = async (glossaryName: string) => {
  const response = await APIClient.get<CSVExportResponse>(
    `/glossaryTerms/name/${getEncodedFqn(glossaryName)}/exportAsync`
  );

  return response.data;
};

/** Returns the immutable glossary snapshots without converting them to EntityHistory. */
export const getPublishedGlossaryVersions = async (id: string) => {
  const response = await APIClient.get<Glossary[]>(
    `/glossaries/${id}/published`
  );

  return response.data;
};

export const getGlossaryVersionsList = async (id: string) => {
  const snapshots = await getPublishedGlossaryVersions(id);
  const versions = snapshots.map((snapshot) => JSON.stringify(snapshot));

  return { entityType: 'glossary', versions } as EntityHistory;
};

export const getGlossaryVersion = async (
  id: string,
  businessVersion: string
) => {
  const url = `/glossaries/${id}/published/${businessVersion}`;
  const response = await APIClient.get<Glossary>(url);

  return response.data;
};

export const getGlossaryTermsVersionsList = async (
  id: string,
  parentBusinessVersion?: string
) => {
  const response = await APIClient.get<
    GlossaryTerm[] | { data?: GlossaryTerm[] }
  >(`/glossaryTerms/${id}/published`, { params: { parentBusinessVersion } });
  // Depending on the backend/proxy version, collection responses can be
  // returned either as a bare array or in the standard `{ data: [...] }`
  // envelope. Keep the version selector compatible with both contracts.
  const responseBody = response.data;
  const snapshots = Array.isArray(responseBody)
    ? responseBody
    : Array.isArray(responseBody?.data)
    ? responseBody.data
    : [];
  const versions = snapshots.map((snapshot) => JSON.stringify(snapshot));

  return { entityType: 'glossaryTerm', versions } as EntityHistory;
};

/** Current published snapshot of a term in one governed glossary version. */
export const getCurrentPublishedGlossaryTerm = async (
  id: string,
  parentBusinessVersion: string
): Promise<GlossaryTerm | undefined> => {
  const response = await APIClient.get<
    GlossaryTerm | GlossaryTerm[] | { data?: GlossaryTerm[] }
  >(`/glossaryTerms/${id}/published`, { params: { parentBusinessVersion } });
  const body = response.data;
  const envelope = body as { data?: GlossaryTerm[] };
  if (!Array.isArray(body) && !Array.isArray(envelope.data)) {
    return body as GlossaryTerm;
  }
  const snapshots = Array.isArray(body) ? body : envelope.data ?? [];

  return [...snapshots].sort(
    (left, right) =>
      (right.publicationSequence ?? right.publishedAt ?? 0) -
      (left.publicationSequence ?? left.publishedAt ?? 0)
  )[0];
};

export const getGlossaryTermsVersion = async (
  id: string,
  businessVersion: string,
  parentBusinessVersion?: string
) => {
  const url = `/glossaryTerms/${id}/published/${businessVersion}`;

  const response = await APIClient.get<GlossaryTerm>(url, {
    params: { parentBusinessVersion },
  });

  return response.data;
};

export const updateGlossaryVotes = async (
  id: string,
  data: VotingDataProps
) => {
  const response = await APIClient.put<
    VotingDataProps,
    AxiosResponse<ChangeEvent>
  >(`/glossaries/${id}/vote`, data);

  return response.data;
};

export const updateGlossaryTermVotes = async (
  id: string,
  data: VotingDataProps
) => {
  const response = await APIClient.put<
    VotingDataProps,
    AxiosResponse<ChangeEvent>
  >(`/glossaryTerms/${id}/vote`, data);

  return response.data;
};

export const validateTagAddtionToGlossary = async (
  glossaryTerm: GlossaryTerm,
  dryRun = false
) => {
  const data = {
    dryRun: dryRun,
    glossaryTags: glossaryTerm.tags ?? [],
  };

  const response = await APIClient.put<
    AddGlossaryToAssetsRequest,
    AxiosResponse<BulkOperationResult>
  >(`/glossaryTerms/${glossaryTerm.id}/tags/validate`, data);

  return response.data;
};

export const addAssetsToGlossaryTerm = async (
  glossaryTerm: GlossaryTerm,
  assets: EntityReference[],
  dryRun = false
) => {
  const data = {
    assets: assets,
    dryRun: dryRun,
  };

  const response = await APIClient.put<
    AddGlossaryToAssetsRequest,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${glossaryTerm.id}/assets/add`, data);

  return response.data;
};

export const removeAssetsFromGlossaryTerm = async (
  glossaryTerm: GlossaryTerm,
  assets: EntityReference[]
) => {
  const data = {
    assets: assets,
    dryRun: false,
  };

  const response = await APIClient.put<
    AddGlossaryToAssetsRequest,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${glossaryTerm.id}/assets/remove`, data);

  return response.data;
};

export const getGlossaryTermAssets = async (
  termId: string,
  limit = 100,
  offset = 0
) => {
  const response = await APIClient.get<PagingResponse<EntityReference[]>>(
    `/glossaryTerms/${termId}/assets`,
    { params: { limit, offset } }
  );

  return response.data;
};

export const getGlossaryTermsAssetCounts = async (
  parent?: string
): Promise<Record<string, number>> => {
  const response = await APIClient.get<Record<string, number>>(
    '/glossaryTerms/assets/counts',
    { params: parent ? { parent } : undefined }
  );

  return response.data;
};

export const searchGlossaryTerms = async (search: string, page = 1) => {
  const apiUrl = `/search/query?q=${search ?? ''}`;

  const { data } = await APIClient.get(apiUrl, {
    params: {
      index: SearchIndex.GLOSSARY_TERM,
      from: (page - 1) * PAGE_SIZE_MEDIUM,
      size: PAGE_SIZE_MEDIUM,
      deleted: false,
      track_total_hits: true,
      getHierarchy: true,
    },
  });

  return data;
};

export const searchGlossaryTermsPaginated = async (
  params: SearchGlossaryTermsParams
) => {
  const response = await APIClient.get<PagingResponse<GlossaryTerm[]>>(
    '/glossaryTerms/search',
    { params }
  );

  return response.data;
};

export type GlossaryTermWithChildren = Omit<GlossaryTerm, 'children'> & {
  children?: GlossaryTerm[];
};

export const getFirstLevelGlossaryTermsPaginated = async (
  parentFQN: string,
  pageSize = 50,
  after?: string,
  entityStatus?: string,
  fields?: string[],
  before?: string,
  glossaryId?: string,
  parentBusinessVersion?: string
) => {
  const apiUrl = `/glossaryTerms`;

  const { data } = await APIClient.get<
    PagingResponse<GlossaryTermWithChildren[]>
  >(apiUrl, {
    params: {
      ...(parentFQN === 'Data Dictionary' ||
      parentFQN === DATA_QUALITY_GLOSSARY_NAME ||
      glossaryId
        ? { glossary: glossaryId ?? parentFQN }
        : { directChildrenOf: parentFQN }),
      fields: fields ?? [
        TabSpecificField.CHILDREN_COUNT,
        TabSpecificField.OWNERS,
        TabSpecificField.REVIEWERS,
      ],
      limit: pageSize,
      after: after,
      before,
      entityStatus,
      ...(parentBusinessVersion ? { parentBusinessVersion } : {}),
    },
  });

  return data;
};

export const getGlossaryTermChildrenLazy = async (
  parentFQN: string,
  limit = 50,
  after?: string,
  fields?: string[]
) => {
  const apiUrl = `/glossaryTerms`;

  const { data } = await APIClient.get<
    PagingResponse<GlossaryTermWithChildren[]>
  >(apiUrl, {
    params: {
      directChildrenOf: parentFQN,
      fields: fields ?? [
        TabSpecificField.CHILDREN_COUNT,
        TabSpecificField.OWNERS,
        TabSpecificField.REVIEWERS,
      ],
      limit,
      after,
    },
  });

  return data;
};

export interface TermRelation {
  relationType: string;
  term: EntityReference;
}

export interface TermRelationGraph {
  nodes: Array<{
    id: string;
    name: string;
    fullyQualifiedName: string;
    displayName?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    relationType: string;
  }>;
}

export const addTermRelation = async (
  termId: string,
  termRelation: TermRelation
): Promise<GlossaryTerm> => {
  const response = await APIClient.post<
    TermRelation,
    AxiosResponse<GlossaryTerm>
  >(`/glossaryTerms/${termId}/relations`, termRelation);

  return response.data;
};

export const removeTermRelation = async (
  termId: string,
  toTermId: string,
  relationType?: string
): Promise<GlossaryTerm> => {
  const params: Record<string, string> = {};
  if (relationType) {
    params.relationType = relationType;
  }
  const response = await APIClient.delete<GlossaryTerm>(
    `/glossaryTerms/${termId}/relations/${toTermId}`,
    { params }
  );

  return response.data;
};

export const getTermRelationGraph = async (
  termId: string,
  depth = 1,
  relationTypes?: string[]
): Promise<TermRelationGraph> => {
  const params: Record<string, number | string> = { depth };
  if (relationTypes && relationTypes.length > 0) {
    params.relationTypes = relationTypes.join(',');
  }
  const response = await APIClient.get<TermRelationGraph>(
    `/glossaryTerms/${termId}/relationsGraph`,
    { params }
  );

  return response.data;
};

export const getGlossaryTermRelationSettings = async () => {
  const response = await APIClient.get(
    '/system/settings/glossaryTermRelationSettings'
  );

  return response.data?.config_value;
};

const GLOSSARY_TERM_RELATION_TYPES_URL =
  '/system/settings/glossaryTermRelationSettings/relationTypes';

export const getGlossaryTermRelationTypes = async (
  params: ListParamsWithOffset
): Promise<PagingResponse<GlossaryTermRelationType[]>> => {
  const response = await APIClient.get<
    PagingResponse<GlossaryTermRelationType[]>
  >(GLOSSARY_TERM_RELATION_TYPES_URL, { params });

  return response.data;
};

export const createGlossaryTermRelationType = async (
  relationType: GlossaryTermRelationType
): Promise<GlossaryTermRelationType> => {
  const response = await APIClient.post<GlossaryTermRelationType>(
    GLOSSARY_TERM_RELATION_TYPES_URL,
    relationType
  );

  return response.data;
};

export const updateGlossaryTermRelationType = async (
  relationType: GlossaryTermRelationType
): Promise<GlossaryTermRelationType> => {
  const response = await APIClient.put<GlossaryTermRelationType>(
    `${GLOSSARY_TERM_RELATION_TYPES_URL}/${encodeURIComponent(
      relationType.name
    )}`,
    relationType
  );

  return response.data;
};

export const deleteGlossaryTermRelationType = async (
  relationTypeName: string
): Promise<void> => {
  await APIClient.delete(
    `${GLOSSARY_TERM_RELATION_TYPES_URL}/${encodeURIComponent(
      relationTypeName
    )}`
  );
};

export const updateGlossaryTermRelationSettings = async (settings: unknown) => {
  const response = await APIClient.put('/system/settings', {
    config_type: 'glossaryTermRelationSettings',
    config_value: settings,
  });

  return response.data;
};

export const getRelationTypeUsageCounts = async (): Promise<
  Record<string, number>
> => {
  const response = await APIClient.get('/glossaryTerms/relationTypes/usage');

  return response.data;
};
