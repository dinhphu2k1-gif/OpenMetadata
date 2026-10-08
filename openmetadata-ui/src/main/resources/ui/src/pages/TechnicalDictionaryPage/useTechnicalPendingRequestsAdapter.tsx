/*
 * Copyright 2026 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import { AxiosError } from 'axios';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '../../constants/constants';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  approveTechnicalChangeRequest,
  approveTechnicalRecord,
  getTechnicalPendingRequests,
  rejectTechnicalChangeRequest,
  rejectTechnicalRecord,
  TechnicalPendingRequest,
  withdrawTechnicalChangeRequest,
  withdrawTechnicalRecord,
} from '../../rest/technicalDictionaryAPI';
import {
  PendingRequest,
  PendingRequestChangeDetail,
  PendingRequestsAdapter,
  PendingRequestType,
} from '../../components/common/PendingRequestsTab/PendingRequestsTab.interface';

type CachedRequest = PendingRequest & { source: TechnicalPendingRequest };

const FIELDS: Array<{ key: string; label: string }> = [
  { key: 'cdeTermId', label: 'CDE mapping' },
  { key: 'rank', label: 'Rank' },
  { key: 'elementType', label: 'Element type' },
  { key: 'generationType', label: 'Generation type' },
  { key: 'creationMethod', label: 'Creation method' },
  { key: 'timeliness', label: 'Timeliness' },
  { key: 'systemOwnerId', label: 'System owners' },
];

const value = (
  record: Record<string, unknown> | null | undefined,
  key: string
) =>
  record?.[key] == null || record[key] === ''
    ? '—'
    : typeof record[key] === 'object'
    ? JSON.stringify(record[key])
    : String(record[key]);

const typeOf = (request: TechnicalPendingRequest): PendingRequestType =>
  request.requestType.toLowerCase() as PendingRequestType;

export const useTechnicalPendingRequestsAdapter = (
  refreshKey: number
): PendingRequestsAdapter => {
  const { t } = useTranslation();
  const currentUserName = useApplicationStore(
    (state) => state.currentUser?.name
  );

  return useMemo(() => {
    const cache = new Map<string, CachedRequest>();
    const toItem = (source: TechnicalPendingRequest): CachedRequest => {
      const item: CachedRequest = {
        id: source.requestId,
        code: source.columnFqn.split('.').pop() ?? source.columnFqn,
        name: source.columnFqn,
        version: source.dataDictionaryVersion,
        type: typeOf(source),
        requestedBy: source.submittedBy
          ? { id: source.submittedBy, type: 'user', name: source.submittedBy }
          : undefined,
        requestedAt: source.submittedAt,
        revision: source.revision,
        selectable: true,
        canWithdraw:
          Boolean(currentUserName) && source.submittedBy === currentUserName,
        canDecide:
          Boolean(currentUserName) && source.createdBy !== currentUserName,
        disabledReason:
          source.createdBy === currentUserName
            ? t('message.technical-self-review-forbidden')
            : undefined,
        detailPath: `${ROUTES.TECHNICAL_DICTIONARY_DETAILS.replace(
          ':termId',
          source.recordId
        )}?businessVersion=${encodeURIComponent(
          source.dataDictionaryVersion ?? ''
        )}&view=working`,
        changedFields:
          source.requestType === 'UPDATE'
            ? FIELDS.filter(
                ({ key }) =>
                  value(source.approvedRecord, key) !==
                  value(source.proposedRecord, key)
              ).map(({ label }) => label)
            : [
                source.requestType === 'DELETE'
                  ? t('label.delete')
                  : t('label.create'),
              ],
        source,
      };
      cache.set(item.id, item);

      return item;
    };

    const detail = async (
      request: PendingRequest
    ): Promise<PendingRequestChangeDetail> => {
      const source = cache.get(request.id)?.source;
      if (!source) {
        return {};
      }
      if (source.requestType === 'UPDATE') {
        return {
          diffs: FIELDS.filter(
            ({ key }) =>
              value(source.approvedRecord, key) !==
              value(source.proposedRecord, key)
          ).map(({ key, label }) => ({
            field: label,
            oldValue: value(source.approvedRecord, key),
            newValue: value(source.proposedRecord, key),
          })),
        };
      }
      const snapshot =
        source.requestType === 'DELETE'
          ? source.approvedRecord
          : source.proposedRecord;

      return {
        warning:
          source.requestType === 'DELETE'
            ? t('message.technical-delete-change-review')
            : undefined,
        fields: [
          { label: 'Column FQN', value: source.columnFqn },
          ...FIELDS.map(({ key, label }) => ({
            label,
            value: value(snapshot, key),
          })),
        ],
      };
    };

    return {
      fetchRequests: async ({ searchText, types, filters, page, pageSize }) => {
        const response = await getTechnicalPendingRequests({
          q: searchText,
          types: types?.map((type) => type.toUpperCase()),
          requesters: filters?.requester,
          sourceServices: filters?.sourceService,
          cdeTermIds: filters?.cde,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        });

        return {
          items: response.data.map(toItem),
          total: response.paging.total,
        };
      },
      fetchTypeCounts: async () =>
        (await getTechnicalPendingRequests({ limit: 1, offset: 0 })).counts,
      fetchFilters: async () => {
        const response = await getTechnicalPendingRequests({
          limit: 100,
          offset: 0,
        });
        const requesters = new Set<string>();
        const services = new Set<string>();
        const cdes = new Set<string>();
        response.data.forEach((item) => {
          if (item.submittedBy) {
            requesters.add(item.submittedBy);
          }
          if (item.sourceService) {
            services.add(item.sourceService);
          }
          if (item.cdeTermId) {
            cdes.add(item.cdeTermId);
          }
        });
        const options = (items: Set<string>) =>
          [...items].sort().map((item) => ({ label: item, value: item }));

        return [
          {
            key: 'requester',
            label: t('label.requested-by'),
            options: options(requesters),
          },
          {
            key: 'sourceService',
            label: t('label.service'),
            options: options(services),
          },
          { key: 'cde', label: 'CDE', options: options(cdes) },
        ];
      },
      fetchChangeDetail: detail,
      getApprovalWarning: (requests) => {
        const deletions = requests.filter(({ type }) => type === 'delete');

        return deletions.length
          ? {
              message: t('message.technical-delete-change-review'),
              items: deletions.map(({ name }) => name),
            }
          : undefined;
      },
      applyAction: async (action, requests) => {
        const outcomes = await Promise.allSettled(
          requests.map((request) => {
            const source = cache.get(request.id)?.source;
            if (!source) {
              return Promise.reject(new Error('Request is stale'));
            }
            if (action === 'withdraw') {
              return source.requestType === 'CREATE'
                ? withdrawTechnicalRecord(source.recordId, source.revision)
                : withdrawTechnicalChangeRequest(
                    source.recordId,
                    source.revision
                  );
            }
            if (source.requestType === 'CREATE') {
              return action === 'approve'
                ? approveTechnicalRecord(source.recordId, source.revision)
                : rejectTechnicalRecord(source.recordId, source.revision);
            }

            return action === 'approve'
              ? approveTechnicalChangeRequest(source.recordId, source.revision)
              : rejectTechnicalChangeRequest(source.recordId, source.revision);
          })
        );

        return {
          succeeded: outcomes.filter(({ status }) => status === 'fulfilled')
            .length,
          failures: outcomes.flatMap((outcome, index) => {
            if (outcome.status === 'fulfilled') {
              return [];
            }
            const error = outcome.reason as AxiosError<{
              code?: string;
              message?: string;
            }>;

            return [
              {
                id: requests[index].id,
                code: error.response?.data?.code,
                message: error.response?.data?.message ?? error.message,
              },
            ];
          }),
        };
      },
    };
  }, [currentUserName, refreshKey, t]);
};
