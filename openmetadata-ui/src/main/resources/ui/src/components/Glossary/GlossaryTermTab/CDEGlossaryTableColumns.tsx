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

import { Button, Space, Tag } from 'antd';
import { ColumnsType } from 'antd/lib/table/interface';
import { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { CDE_GLOSSARY_TABLE_COLUMNS_KEYS } from '../../../constants/Glossary.contant';
import { EntityReference } from '../../../generated/entity/data/glossaryTerm';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import { ModifiedGlossaryTerm } from './GlossaryTermTab.interface';

export type CDEExtension = {
  cdeVersion?: string;
  phien_ban?: string;
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
  t: TFunction;
};

export const CDE_TAG_CLASSIFICATIONS = {
  dataSource: 'DataSource',
  dataClassification: 'DataClassification',
  personalData: 'PersonalData',
};

export const getCDEReferenceLabel = (reference: EntityReference) =>
  getEntityName(reference) ||
  reference.fullyQualifiedName ||
  NO_DATA_PLACEHOLDER;

export const renderCDEReferences = (references: EntityReference[] = []) => {
  if (references.length === 0) {
    return NO_DATA_PLACEHOLDER;
  }

  return references.map(getCDEReferenceLabel).join(', ');
};

export const renderCDEOwners = (owners: EntityReference[] = []) => {
  if (owners.length === 0) {
    return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
  }

  return (
    <div className="cde-owner-list">
      {owners.map((owner, index) => {
        const ownerLabel = getCDEReferenceLabel(owner);
        const ownerKey =
          owner.id ?? owner.fullyQualifiedName ?? owner.name ?? String(index);

        return (
          <div
            className="cde-owner-item"
            data-testid={`cde-owner-${ownerKey}`}
            key={ownerKey}
            title={ownerLabel}>
            <ProfilePicture
              className="cde-owner-avatar"
              displayName={owner.displayName}
              isTeam={owner.type === 'team'}
              name={owner.name ?? owner.fullyQualifiedName ?? ''}
              width="24"
            />
            <span className="cde-owner-name">{ownerLabel}</span>
          </div>
        );
      })}
    </div>
  );
};

const getTagLabel = (tag: TagLabel) =>
  tag.displayName ??
  tag.name ??
  tag.tagFQN.split('.').at(-1)?.replaceAll('_', ' ');

export const renderCDEClassificationTags = (
  tags: TagLabel[] = [],
  classification: string,
  variant: 'source' | 'classification' | 'personal'
) => {
  const matchingTags = tags.filter(
    (tag) => tag.tagFQN.split('.')[0] === classification
  );

  if (matchingTags.length === 0) {
    return NO_DATA_PLACEHOLDER;
  }

  return (
    <Space wrap size={[4, 4]}>
      {matchingTags.map((tag) => (
        <Tag
          className={`cde-value-pill cde-value-pill-${variant}`}
          key={tag.tagFQN}>
          {getTagLabel(tag)}
        </Tag>
      ))}
    </Space>
  );
};

export const renderCDEMarkdown = (value?: string, className?: string) =>
  value?.trim() ? (
    <RichTextEditorPreviewerNew
      enableSeeMoreVariant
      className={className}
      markdown={value}
      maxLength={100}
    />
  ) : (
    NO_DATA_PLACEHOLDER
  );

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
            className="text-primary"
            data-testid="load-more-children-button"
            loading={
              loadingChildren[parentRecord?.fullyQualifiedName ?? ''] ?? false
            }
            size="small"
            type="link"
            onClick={() =>
              parentRecord && handleLoadMoreChildren(parentRecord)
            }>
            {t('label.view-more')} ({Math.max(totalCount - loadedCount, 0)})
          </Button>
        );
      }

      return (
        <Link
          className="cde-code-link cursor-pointer"
          data-testid={`cde-code-${name}`}
          to={getGlossaryPath(record.fullyQualifiedName ?? name)}>
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
            (record.extension as CDEExtension | undefined)
              ?.dataQualityRules ??
              (record.extension as CDEExtension | undefined)
                ?.quy_dinh_chat_luong_du_lieu,
            t
          ),
  },
];
