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

import { Button } from '@openmetadata/ui-core-components';
import { Tag } from 'antd';
import { ColumnsType } from 'antd/lib/table/interface';
import { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { CDE_GLOSSARY_TABLE_COLUMNS_KEYS } from '../../../constants/Glossary.contant';
import {
  EntityReference,
  EntityStatus,
} from '../../../generated/entity/data/glossaryTerm';
import { TagLabel } from '../../../generated/type/tagLabel';
import { formatCDEDate } from '../../../utils/CDEDateUtils';
import { getBusinessVersion } from '../../../utils/BusinessVersionUtils';
import { getEntityStatusClass } from '../../../utils/EntityStatusUtils';
import { getCdeDetailPath } from '../../../utils/routing/cdeRoutingHelper';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { ModifiedGlossaryTerm } from './GlossaryTermTab.interface';

export type CDEExtension = {
  version?: string;
  effectiveDate?: string;
  expirationDate?: string;
  entityRelationship?: string;
  relatedRegulatoryDocuments?: string;
  dataQualityRules?: boolean | string | string[];
  moi_quan_he_voi_thuc_the?: string;
  van_ban_quy_dinh_lien_quan?: string;
  quy_dinh_chat_luong_du_lieu?: boolean | string | string[];
};

type CDEGlossaryTableColumnsProps = {
  handleLoadMoreChildren: (record: ModifiedGlossaryTerm) => void;
  loadingChildren: Record<string, boolean>;
  parentBusinessVersion: string;
  t: TFunction;
};

import {
  getDictionaryReferenceLabel,
  renderDictionaryReferences,
  renderDictionaryOwnerList,
  renderDictionaryMarkdown,
  renderDictionaryClassificationTags,
} from './DictionaryCellRenderers';

export const CDE_TAG_CLASSIFICATIONS = {
  dataSource: 'DataSource',
  dataClassification: 'DataClassification',
  personalData: 'PersonalData',
};

export const getCDEReferenceLabel = getDictionaryReferenceLabel;

export const renderCDEReferences = renderDictionaryReferences;

export const renderCDEOwners = (owners: EntityReference[] = []) =>
  renderDictionaryOwnerList(owners, 'cde-owner');

export const renderCDEClassificationTags = (
  tags: TagLabel[] = [],
  classification: string,
  variant: 'source' | 'classification' | 'personal'
) => renderDictionaryClassificationTags(tags, classification, variant);

export const renderCDEMarkdown = renderDictionaryMarkdown;

export const renderCDEQualityRule = (
  value: boolean | string | string[] | undefined,
  t: TFunction
) => {
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return NO_DATA_PLACEHOLDER;
  }

  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalizedValue =
    typeof rawValue === 'string' ? rawValue.trim().toUpperCase() : rawValue;
  const hasQualityRule =
    normalizedValue === true ||
    ['1', 'TRUE', 'Y', 'YES', 'CO', 'CÓ'].includes(String(normalizedValue));

  return (
    <Tag
      className={`cde-value-pill ${
        hasQualityRule ? 'cde-value-pill-quality' : 'cde-value-pill-neutral'
      }`}>
      {hasQualityRule ? t('label.yes') : t('label.no')}
    </Tag>
  );
};

export const getCDEGlossaryTableColumns = ({
  handleLoadMoreChildren,
  loadingChildren,
  parentBusinessVersion,
  t,
}: CDEGlossaryTableColumnsProps): ColumnsType<ModifiedGlossaryTerm> => [
  {
    title: t('cde.term-code'),
    dataIndex: 'name',
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.NAME,
    fixed: 'left',
    width: 150,
    render: (name: string, record) => {
      if (record.isLoadMoreButton) {
        const parentRecord = record.parentRecord;
        const loadedCount = parentRecord?.children?.length ?? 0;
        const totalCount = parentRecord?.childrenCount ?? 0;

        return (
          <Button
            color="link-color"
            data-testid="load-more-children-button"
            isLoading={
              loadingChildren[parentRecord?.fullyQualifiedName ?? ''] ?? false
            }
            size="sm"
            onPress={() =>
              parentRecord && handleLoadMoreChildren(parentRecord)
            }>
            {t('label.view-more')} ({Math.max(totalCount - loadedCount, 0)})
          </Button>
        );
      }

      const businessVersion = getBusinessVersion(record.businessVersion, '');

      const toUrl = getCdeDetailPath({
        fqn: record.fullyQualifiedName ?? name,
        businessVersion,
        // A revision carries the authoritative publication scope. The
        // glossary header value is only a fallback for legacy list payloads.
        parentBusinessVersion:
          record.parentBusinessVersion ?? parentBusinessVersion,
        isWorkingDraft: record.entityStatus !== EntityStatus.Approved,
      });

      return (
        <Link
          className="cde-code-link cursor-pointer"
          data-testid={`cde-code-${name}`}
          to={toUrl}>
          {name}
        </Link>
      );
    },
  },
  {
    title: t('cde.business-group'),
    dataIndex: 'domains',
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.DOMAINS,
    fixed: 'left',
    width: 190,
    render: (domains: EntityReference[] = [], record) =>
      record.isLoadMoreButton ? null : renderCDEReferences(domains),
  },
  {
    title: t('cde.business-term-name'),
    dataIndex: 'displayName',
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.DISPLAY_NAME,
    fixed: 'left',
    width: 260,
    render: (displayName: string, record) =>
      record.isLoadMoreButton
        ? null
        : displayName || record.name || NO_DATA_PLACEHOLDER,
  },
  {
    title: t('cde.data-source'),
    dataIndex: 'tags',
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.DATA_SOURCE,
    width: 170,
    render: (tags: TagLabel[] = [], record) =>
      record.isLoadMoreButton
        ? null
        : renderCDEClassificationTags(
            tags,
            CDE_TAG_CLASSIFICATIONS.dataSource,
            'source'
          ),
  },
  {
    title: t('cde.business-meaning'),
    dataIndex: 'description',
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.DESCRIPTION,
    width: 320,
    render: (description: string, record) =>
      record.isLoadMoreButton ? null : renderCDEMarkdown(description),
  },
  {
    title: t('cde.entity-relationship'),
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.ENTITY_RELATIONSHIP,
    width: 280,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : renderCDEMarkdown(
            (record.extension as CDEExtension | undefined)
              ?.entityRelationship ??
              (record.extension as CDEExtension | undefined)
                ?.moi_quan_he_voi_thuc_the
          ),
  },
  {
    title: t('cde.data-owner'),
    dataIndex: 'owners',
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.OWNERS,
    width: 240,
    render: (owners: EntityReference[] = [], record) =>
      record.isLoadMoreButton ? null : renderCDEOwners(owners),
  },
  {
    title: t('cde.data-classification'),
    dataIndex: 'tags',
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.DATA_CLASSIFICATION,
    width: 170,
    render: (tags: TagLabel[] = [], record) =>
      record.isLoadMoreButton
        ? null
        : renderCDEClassificationTags(
            tags,
            CDE_TAG_CLASSIFICATIONS.dataClassification,
            'classification'
          ),
  },
  {
    title: t('cde.personal-data'),
    dataIndex: 'tags',
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.PERSONAL_DATA,
    width: 170,
    render: (tags: TagLabel[] = [], record) =>
      record.isLoadMoreButton
        ? null
        : renderCDEClassificationTags(
            tags,
            CDE_TAG_CLASSIFICATIONS.personalData,
            'personal'
          ),
  },
  {
    title: t('cde.related-regulatory-documents'),
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.RELATED_REGULATION,
    width: 280,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : renderCDEMarkdown(
            (record.extension as CDEExtension | undefined)
              ?.relatedRegulatoryDocuments ??
              (record.extension as CDEExtension | undefined)
                ?.van_ban_quy_dinh_lien_quan
          ),
  },
  {
    title: t('cde.data-quality-rules'),
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.DATA_QUALITY_RULE,
    width: 210,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : renderCDEQualityRule(
            (record.extension as CDEExtension | undefined)?.dataQualityRules ??
              (record.extension as CDEExtension | undefined)
                ?.quy_dinh_chat_luong_du_lieu,
            t
          ),
  },
  {
    title: String(t('cde.version')),
    key: CDE_GLOSSARY_TABLE_COLUMNS_KEYS.VERSION,
    width: 120,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : getBusinessVersion(record.businessVersion),
  },
  {
    title: t('label.status'),
    dataIndex: 'entityStatus',
    key: 'entityStatus',
    width: 150,
    render: (entityStatus: EntityStatus | undefined, record) => {
      if (record.isLoadMoreButton) {
        return null;
      }
      const status = entityStatus ?? EntityStatus.Approved;

      return (
        <div className="d-flex flex-column gap-1">
          <StatusBadge label={status} status={getEntityStatusClass(status)} />
          {status === EntityStatus.Draft && (
            <Tag color="default">Chưa thêm vào gói phát hành</Tag>
          )}
        </div>
      );
    },
  },
  ...(['effectiveDate', 'expirationDate'] as const).map((key) => ({
    title: String(
      t(key === 'effectiveDate' ? 'cde.effective-date' : 'cde.expiration-date')
    ),
    key,
    width: 160,
    render: (_: unknown, record: ModifiedGlossaryTerm) =>
      record.isLoadMoreButton ? null : formatCDEDate(record.extension?.[key]),
  })),
];
