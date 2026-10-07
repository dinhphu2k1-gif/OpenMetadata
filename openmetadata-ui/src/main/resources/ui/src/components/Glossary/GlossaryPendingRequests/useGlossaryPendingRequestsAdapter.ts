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
import { AxiosError } from 'axios';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/type/entityReference';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  bulkGlossaryTermWorkflow,
  getCurrentPublishedGlossaryTerm,
  getGlossaryWorkingRecords,
} from '../../../rest/glossaryAPI';
import { getUserByName } from '../../../rest/userAPI';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import {
  PendingRequest,
  PendingRequestChangeDetail,
  PendingRequestsAdapter,
  PendingRequestType,
  PendingRequestTypeCounts,
} from '../../common/PendingRequestsTab/PendingRequestsTab.interface';
import {
  CDEExtension,
  CDE_TAG_CLASSIFICATIONS,
  renderCDEClassificationTags,
  renderCDEMarkdown,
  renderCDEOwners,
  renderCDEQualityRule,
  renderCDEReferences,
} from '../GlossaryTermTab/CDEGlossaryTableColumns';

export interface GlossaryPendingRequestsScope {
  glossaryId: string;
  glossaryName: string;
  businessVersion: string;
}

type WorkingRecord = GlossaryTerm & { termId?: string; recordType?: string };
type FieldDescriptor = {
  keys: string[];
  label: string;
  raw: (term: GlossaryTerm) => unknown;
  render: (term: GlossaryTerm) => ReactNode;
};

const recordId = (record: WorkingRecord) => record.termId ?? record.id;
const referenceValue = (reference: EntityReference) =>
  reference.displayName ??
  reference.name ??
  reference.fullyQualifiedName ??
  reference.id;
const normalizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .map(normalizeValue)
      .sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right))
      );
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeValue(nested)])
    );
  }

  return value ?? null;
};
const stableValue = (value: unknown): string =>
  JSON.stringify(normalizeValue(value));
const tagsFor = (term: GlossaryTerm, classification: string) =>
  (term.tags ?? []).filter(
    (tag) =>
      tag.tagFQN === classification ||
      tag.tagFQN.startsWith(`${classification}.`)
  );
const withFallback = (value: ReactNode) => value || NO_DATA_PLACEHOLDER;
const isEmptyValue = (value: unknown) =>
  value == null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const resolveUsers = async (
  names: string[]
): Promise<Map<string, EntityReference>> => {
  const unique = [...new Set(names.filter(Boolean))];
  const users = await Promise.allSettled(
    unique.map((name) => getUserByName(name))
  );

  return new Map(
    unique.map((name, index) => {
      const user = users[index];

      return [
        name,
        user.status === 'fulfilled'
          ? {
              id: user.value.id,
              type: 'user',
              name: user.value.name,
              displayName: user.value.displayName,
              fullyQualifiedName: user.value.fullyQualifiedName,
            }
          : { id: name, type: 'user', name },
      ];
    })
  );
};

export const useGlossaryPendingRequestsAdapter = ({
  glossaryId,
  businessVersion,
}: GlossaryPendingRequestsScope): PendingRequestsAdapter => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const currentUserName = currentUser?.name;

  return useMemo<PendingRequestsAdapter>(() => {
    const workingRecords = new Map<string, WorkingRecord>();
    const publishedRecords = new Map<string, GlossaryTerm | undefined>();
    let baseItemsPromise: Promise<PendingRequest[]> | undefined;

    const descriptors = (): FieldDescriptor[] => [
      {
        keys: ['displayName'],
        label: t('cde.business-term-name'),
        raw: (term) => term.displayName,
        render: (term) => term.displayName || term.name || NO_DATA_PLACEHOLDER,
      },
      {
        keys: ['domains'],
        label: t('cde.business-group'),
        raw: (term) => term.domains,
        render: (term) => renderCDEReferences(term.domains),
      },
      {
        keys: ['tags', 'dataSource'],
        label: t('cde.data-source'),
        raw: (term) => tagsFor(term, CDE_TAG_CLASSIFICATIONS.dataSource),
        render: (term) =>
          renderCDEClassificationTags(
            term.tags,
            CDE_TAG_CLASSIFICATIONS.dataSource,
            'source'
          ),
      },
      {
        keys: ['tags', 'dataClassification'],
        label: t('cde.data-classification'),
        raw: (term) =>
          tagsFor(term, CDE_TAG_CLASSIFICATIONS.dataClassification),
        render: (term) =>
          renderCDEClassificationTags(
            term.tags,
            CDE_TAG_CLASSIFICATIONS.dataClassification,
            'classification'
          ),
      },
      {
        keys: ['tags', 'personalData'],
        label: t('cde.personal-data'),
        raw: (term) => tagsFor(term, CDE_TAG_CLASSIFICATIONS.personalData),
        render: (term) =>
          renderCDEClassificationTags(
            term.tags,
            CDE_TAG_CLASSIFICATIONS.personalData,
            'personal'
          ),
      },
      {
        keys: ['owners'],
        label: t('cde.data-owner'),
        raw: (term) => term.owners,
        render: (term) => renderCDEOwners(term.owners),
      },
      {
        keys: ['description'],
        label: t('cde.business-meaning'),
        raw: (term) => term.description,
        render: (term) => renderCDEMarkdown(term.description),
      },
      {
        keys: [
          'extension.entityRelationship',
          'extension.moi_quan_he_voi_thuc_the',
        ],
        label: t('cde.entity-relationship'),
        raw: (term) => {
          const extension = term.extension as CDEExtension | undefined;

          return (
            extension?.entityRelationship ?? extension?.moi_quan_he_voi_thuc_the
          );
        },
        render: (term) => {
          const extension = term.extension as CDEExtension | undefined;

          return renderCDEMarkdown(
            extension?.entityRelationship ?? extension?.moi_quan_he_voi_thuc_the
          );
        },
      },
      {
        keys: [
          'extension.relatedRegulatoryDocuments',
          'extension.van_ban_quy_dinh_lien_quan',
        ],
        label: t('cde.related-regulatory-documents'),
        raw: (term) => {
          const extension = term.extension as CDEExtension | undefined;

          return (
            extension?.relatedRegulatoryDocuments ??
            extension?.van_ban_quy_dinh_lien_quan
          );
        },
        render: (term) => {
          const extension = term.extension as CDEExtension | undefined;

          return renderCDEMarkdown(
            extension?.relatedRegulatoryDocuments ??
              extension?.van_ban_quy_dinh_lien_quan
          );
        },
      },
      {
        keys: [
          'extension.dataQualityRules',
          'extension.quy_dinh_chat_luong_du_lieu',
        ],
        label: t('cde.data-quality-rules'),
        raw: (term) => {
          const extension = term.extension as CDEExtension | undefined;

          return (
            extension?.dataQualityRules ??
            extension?.quy_dinh_chat_luong_du_lieu
          );
        },
        render: (term) => {
          const extension = term.extension as CDEExtension | undefined;

          return renderCDEQualityRule(
            extension?.dataQualityRules ??
              extension?.quy_dinh_chat_luong_du_lieu,
            t
          );
        },
      },
    ];

    const loadPublished = async (record: WorkingRecord) => {
      const id = recordId(record);
      if (publishedRecords.has(id)) {
        return publishedRecords.get(id);
      }
      try {
        const published = await getCurrentPublishedGlossaryTerm(
          id,
          businessVersion
        );
        publishedRecords.set(id, published);

        return published;
      } catch (error) {
        if ((error as AxiosError).response?.status !== 404) {
          throw error;
        }
        publishedRecords.set(id, undefined);

        return undefined;
      }
    };

    const changedDescriptors = (
      working: GlossaryTerm,
      published?: GlossaryTerm
    ) => {
      const all = descriptors();
      const backendNames = [
        ...(working.changeDescription?.fieldsAdded ?? []),
        ...(working.changeDescription?.fieldsUpdated ?? []),
        ...(working.changeDescription?.fieldsDeleted ?? []),
      ]
        .map((change) => change.name)
        .filter(Boolean) as string[];
      if (backendNames.length > 0) {
        const fromBackend = all.filter((descriptor) =>
          descriptor.keys.some((key) =>
            backendNames.some(
              (name) => name === key || name.startsWith(`${key}.`)
            )
          )
        );
        if (fromBackend.length > 0) {
          return published
            ? fromBackend.filter(
                (descriptor) =>
                  stableValue(descriptor.raw(working)) !==
                  stableValue(descriptor.raw(published))
              )
            : fromBackend;
        }
      }

      return published
        ? all.filter(
            (descriptor) =>
              stableValue(descriptor.raw(working)) !==
              stableValue(descriptor.raw(published))
          )
        : [];
    };

    const toDetail = async (
      request: PendingRequest
    ): Promise<PendingRequestChangeDetail> => {
      const working = workingRecords.get(request.id);
      if (!working) {
        return {};
      }
      const published = await loadPublished(working);
      if (request.type === 'update' && published) {
        return {
          diffs: changedDescriptors(working, published).map((descriptor) => ({
            field: descriptor.label,
            oldValue: withFallback(descriptor.render(published)),
            newValue: withFallback(descriptor.render(working)),
            oldEmpty: isEmptyValue(descriptor.raw(published)),
            newEmpty: isEmptyValue(descriptor.raw(working)),
          })),
        };
      }
      const source =
        request.type === 'delete' && published ? published : working;
      const createDeleteLabels = new Set([
        t('cde.business-group'),
        t('cde.data-source'),
        t('cde.data-classification'),
        t('cde.personal-data'),
        t('cde.data-owner'),
        t('cde.business-meaning'),
      ]);

      return {
        fields: descriptors()
          .filter((descriptor) => createDeleteLabels.has(descriptor.label))
          .map((descriptor) => ({
            label: descriptor.label,
            value: withFallback(descriptor.render(source)),
            empty: isEmptyValue(descriptor.raw(source)),
          })),
      };
    };

    const loadAllUncached = async (searchText?: string) => {
      const records: WorkingRecord[] = [];
      let offset = 0;
      let total = 0;
      do {
        const response = await getGlossaryWorkingRecords({
          glossaryId,
          parentBusinessVersion: businessVersion,
          statuses: [EntityStatus.InReview, EntityStatus.Draft],
          q: searchText,
          limit: 50,
          offset,
        });
        records.push(
          ...response.data.filter(
            (record) =>
              record.recordType !== 'published' &&
              (record.entityStatus === EntityStatus.InReview ||
                (record.entityStatus === EntityStatus.Draft &&
                  record.pendingDeletion))
          )
        );
        total = response.paging.total;
        offset += 50;
      } while (offset < total);

      records.forEach((record) => workingRecords.set(recordId(record), record));
      const usersPromise = resolveUsers(
        records.map((record) => record.updatedBy ?? '')
      );
      const published: Array<GlossaryTerm | undefined> = [];
      for (let start = 0; start < records.length; start += 50) {
        published.push(
          ...(await Promise.all(
            records.slice(start, start + 50).map(loadPublished)
          ))
        );
      }
      const users = await usersPromise;

      return records.map<PendingRequest>((record, index) => {
        const snapshot = published[index];
        const type: PendingRequestType = record.pendingDeletion
          ? 'delete'
          : snapshot
          ? 'update'
          : 'create';

        return {
          id: recordId(record),
          code: record.name,
          name: record.displayName ?? record.name,
          version:
            snapshot?.businessVersion ??
            record.businessVersion ??
            (record.version == null ? undefined : String(record.version)),
          type,
          changedFields:
            type === 'create'
              ? [t('label.pending-new-cde')]
              : type === 'delete'
              ? [t('label.pending-remove-from-effective-version')]
              : changedDescriptors(record, snapshot).map(({ label }) => label),
          requestedBy: record.updatedBy
            ? users.get(record.updatedBy)
            : undefined,
          requestedAt: record.submittedAt ?? record.updatedAt,
          canWithdraw:
            Boolean(currentUserName) &&
            record.entityStatus === EntityStatus.InReview &&
            record.submittedBy === currentUserName,
          revision: record.workingRevision,
          selectable:
            record.entityStatus === EntityStatus.InReview ||
            Boolean(record.pendingDeletion),
          groups: record.domains,
          detailPath: record.fullyQualifiedName
            ? getGlossaryPath(record.fullyQualifiedName)
            : undefined,
        };
      });
    };

    const loadAll = (searchText?: string) => {
      if (searchText) {
        return loadAllUncached(searchText);
      }
      baseItemsPromise ??= loadAllUncached().catch((error) => {
        baseItemsPromise = undefined;

        throw error;
      });

      return baseItemsPromise;
    };

    return {
      fetchRequests: async ({ searchText, types, filters, page, pageSize }) => {
        let items = await loadAll(searchText);
        if (types?.length) {
          items = items.filter(({ type }) => types.includes(type));
        }
        const requesterValues = filters?.requester ?? [];
        if (requesterValues.length) {
          items = items.filter((item) =>
            requesterValues.includes(
              item.requestedBy?.name ?? item.requestedBy?.id ?? ''
            )
          );
        }
        const groupValues = filters?.businessGroup ?? [];
        if (groupValues.length) {
          items = items.filter((item) =>
            item.groups?.some((group) => groupValues.includes(group.id))
          );
        }
        const start = (page - 1) * pageSize;

        return {
          items: items.slice(start, start + pageSize),
          total: items.length,
        };
      },
      fetchTypeCounts: async () => {
        const counts: PendingRequestTypeCounts = {
          create: 0,
          update: 0,
          delete: 0,
        };
        (await loadAll()).forEach(({ type }) => (counts[type] += 1));

        return counts;
      },
      fetchFilters: async () => {
        const items = await loadAll();
        const requesters = new Map<string, string>();
        const groups = new Map<string, string>();
        items.forEach((item) => {
          if (item.requestedBy) {
            requesters.set(
              item.requestedBy.name ?? item.requestedBy.id,
              referenceValue(item.requestedBy)
            );
          }
          item.groups?.forEach((group) =>
            groups.set(group.id, referenceValue(group))
          );
        });

        return [
          {
            key: 'requester',
            label: t('label.requested-by'),
            options: [...requesters].map(([value, label]) => ({
              value,
              label,
            })),
          },
          {
            key: 'businessGroup',
            label: t('cde.business-group'),
            options: [...groups].map(([value, label]) => ({ value, label })),
          },
        ];
      },
      fetchChangeDetail: toDetail,
      getApprovalWarning: (requests) => {
        const deletions = requests.filter(({ type }) => type === 'delete');

        return deletions.length
          ? {
              message: t('message.pending-delete-approval-warning'),
              items: deletions.map(({ code, name }) => `${code} · ${name}`),
            }
          : undefined;
      },
      applyAction: async (action, requests) => {
        const result = await bulkGlossaryTermWorkflow(action, {
          glossaryId,
          parentBusinessVersion: businessVersion,
          termIds: requests.map(({ id }) => id),
        });
        baseItemsPromise = undefined;
        publishedRecords.clear();
        workingRecords.clear();

        return {
          succeeded: result.succeeded,
          failures: result.failures.map(({ termId, code, message }) => ({
            id: termId ?? '',
            code,
            message,
          })),
          remaining: result.remaining,
        };
      },
    };
  }, [glossaryId, businessVersion, currentUserName, t]);
};
