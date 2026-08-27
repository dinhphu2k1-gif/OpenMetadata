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

import { Button, Tag } from 'antd';
import { ColumnsType } from 'antd/lib/table/interface';
import { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import {
  DATA_DICTIONARY_GLOSSARY_NAME,
  DQ_GLOSSARY_TABLE_COLUMNS_KEYS,
} from '../../../constants/Glossary.contant';
import {
  EntityReference,
  TermRelation,
} from '../../../generated/entity/data/glossaryTerm';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import { ModifiedGlossaryTerm } from './GlossaryTermTab.interface';

export type DQExtension = {
  cdeCode?: string;
  cdeName?: string;
  ruleExplanation?: string;
  otherConstraints?: string;
  exceptions?: string;
  qualityThreshold?: string;
};

type DQGlossaryTableColumnsProps = {
  handleLoadMoreChildren: (record: ModifiedGlossaryTerm) => void;
  loadingChildren: Record<string, boolean>;
  t: TFunction;
};

export const DQ_TAG_CLASSIFICATIONS = {
  dimension: 'DataQualityDimension',
  targetPopulation: 'DataQualityTargetPopulation',
  method: 'DataQualityMethod',
  frequency: 'DataQualityFrequency',
  dataSource: 'DataSource',
};

export const getDQReferenceLabel = (reference: EntityReference) =>
  getEntityName(reference) ||
  reference.fullyQualifiedName ||
  NO_DATA_PLACEHOLDER;

export const renderDQOwners = (owners: EntityReference[] = []) => {
  if (owners.length === 0) {
    return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
  }

  return (
    <div className="dq-owner-list">
      {owners.map((owner, index) => {
        const ownerLabel = getDQReferenceLabel(owner);
        const ownerKey =
          owner.id ?? owner.fullyQualifiedName ?? owner.name ?? String(index);

        return (
          <div
            className="dq-owner-item"
            data-testid={`dq-owner-${ownerKey}`}
            key={ownerKey}
            title={ownerLabel}>
            <ProfilePicture
              className="dq-owner-avatar"
              displayName={owner.displayName}
              isTeam={owner.type === 'team'}
              name={owner.name ?? owner.fullyQualifiedName ?? ''}
              width="24"
            />
            <span className="dq-owner-name">{ownerLabel}</span>
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

export const renderDQDimensionTags = (tags: TagLabel[] = []) => {
  const dimensionTags = tags.filter(
    (tag) => tag.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.dimension
  );

  if (dimensionTags.length === 0) {
    return NO_DATA_PLACEHOLDER;
  }

  return (
    <div className="d-flex flex-column items-start gap-1">
      {dimensionTags.map((tag) => {
        const tagName = tag.tagFQN.split('.').at(-1) ?? '';
        const lowerName = tagName.toLowerCase();
        let pillVariant = 'dq-pill-dimension';

        if (lowerName.includes('completeness')) {
          pillVariant = 'dq-pill-completeness';
        } else if (lowerName.includes('accuracy')) {
          pillVariant = 'dq-pill-accuracy';
        } else if (lowerName.includes('consistency')) {
          pillVariant = 'dq-pill-consistency';
        } else if (lowerName.includes('compliance')) {
          pillVariant = 'dq-pill-compliance';
        } else if (lowerName.includes('timeliness')) {
          pillVariant = 'dq-pill-timeliness';
        }

        return (
          <Tag className={`dq-value-pill ${pillVariant}`} key={tag.tagFQN}>
            {getTagLabel(tag)}
          </Tag>
        );
      })}
    </div>
  );
};

export const renderDQClassificationTags = (
  tags: TagLabel[] = [],
  classification: string,
  variant: 'source' | 'population' | 'method' | 'frequency' | 'neutral' = 'neutral'
) => {
  const matchingTags = tags.filter(
    (tag) => tag.tagFQN.split('.')[0] === classification
  );

  if (matchingTags.length === 0) {
    return NO_DATA_PLACEHOLDER;
  }

  return (
    <div className="d-flex flex-column items-start gap-1">
      {matchingTags.map((tag) => (
        <Tag
          className={`dq-value-pill dq-value-pill-${variant}`}
          key={tag.tagFQN}>
          {getTagLabel(tag)}
        </Tag>
      ))}
    </div>
  );
};

export const renderDQMarkdown = (value?: string, className?: string) =>
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

export const renderDQCdeCode = (
  record: ModifiedGlossaryTerm,
  extension?: DQExtension
) => {
  const cdeCode = extension?.cdeCode;
  const relatedTerms = record.relatedTerms as Array<
    TermRelation | EntityReference
  > | undefined;
  const relatedCdeRelation = relatedTerms?.find((rel) => {
    const term = (rel as TermRelation)?.term ?? (rel as EntityReference);

    return term?.fullyQualifiedName?.includes(DATA_DICTIONARY_GLOSSARY_NAME);
  });
  const relatedCde =
    (relatedCdeRelation as TermRelation)?.term ??
    (relatedCdeRelation as EntityReference);

  const targetFqn =
    relatedCde?.fullyQualifiedName ??
    (cdeCode ? `${DATA_DICTIONARY_GLOSSARY_NAME}.${cdeCode}` : undefined);

  if (targetFqn && (cdeCode || relatedCde)) {
    return (
      <Link
        className="dq-cde-pill-link"
        title={getEntityName(relatedCde) || cdeCode}
        to={getGlossaryPath(targetFqn)}>
        <Tag className="dq-cde-pill">
          {cdeCode || relatedCde?.name || getEntityName(relatedCde)}
        </Tag>
      </Link>
    );
  }

  if (cdeCode) {
    return <Tag className="dq-cde-pill">{cdeCode}</Tag>;
  }

  return NO_DATA_PLACEHOLDER;
};

export const renderDQQualityThreshold = (threshold?: string) => {
  if (!threshold?.trim()) {
    return NO_DATA_PLACEHOLDER;
  }

  return (
    <Tag className="dq-value-pill dq-value-pill-threshold font-medium">
      {threshold}
    </Tag>
  );
};

export const getDQGlossaryTableColumns = ({
  handleLoadMoreChildren,
  loadingChildren,
  t,
}: DQGlossaryTableColumnsProps): ColumnsType<ModifiedGlossaryTerm> => [
  {
    title: t('dq.rule-code'),
    dataIndex: 'name',
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.NAME,
    fixed: 'left',
    width: 110,
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

      // Lấy mã quy tắc từ extension hoặc tên chuẩn (bỏ suffix _2, _3 nếu có)
      const displayRuleCode = name?.split('_')[0] || name;

      return (
        <Link
          className="dq-code-link font-semibold cursor-pointer"
          data-testid={`dq-code-${name}`}
          to={getGlossaryPath(record.fullyQualifiedName ?? name)}>
          {displayRuleCode}
        </Link>
      );
    },
  },
  {
    title: t('dq.cde-code'),
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.CDE_CODE,
    fixed: 'left',
    width: 100,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : renderDQCdeCode(record, record.extension as DQExtension | undefined),
  },
  {
    title: t('dq.cde-name'),
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.CDE_NAME,
    fixed: 'left',
    width: 180,
    render: (_, record) => {
      if (record.isLoadMoreButton) {
        return null;
      }
      const ext = record.extension as DQExtension | undefined;

      return ext?.cdeName || NO_DATA_PLACEHOLDER;
    },
  },
  {
    title: t('dq.dimension'),
    dataIndex: 'tags',
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.DIMENSION,
    width: 180,
    render: (tags: TagLabel[] = [], record) =>
      record.isLoadMoreButton ? null : renderDQDimensionTags(tags),
  },
  {
    title: t('dq.business-rule'),
    dataIndex: 'description',
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.DESCRIPTION,
    width: 280,
    render: (description: string, record) =>
      record.isLoadMoreButton ? null : renderDQMarkdown(description),
  },
  {
    title: t('dq.rule-explanation'),
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.RULE_EXPLANATION,
    width: 280,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : renderDQMarkdown(
            (record.extension as DQExtension | undefined)?.ruleExplanation
          ),
  },
  {
    title: t('dq.other-constraints'),
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.OTHER_CONSTRAINTS,
    width: 220,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : renderDQMarkdown(
            (record.extension as DQExtension | undefined)?.otherConstraints
          ),
  },
  {
    title: t('dq.exceptions'),
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.EXCEPTIONS,
    width: 220,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : renderDQMarkdown(
            (record.extension as DQExtension | undefined)?.exceptions
          ),
  },
  {
    title: t('dq.target-population'),
    dataIndex: 'tags',
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.TARGET_POPULATION,
    width: 180,
    render: (tags: TagLabel[] = [], record) =>
      record.isLoadMoreButton
        ? null
        : renderDQClassificationTags(
            tags,
            DQ_TAG_CLASSIFICATIONS.targetPopulation,
            'population'
          ),
  },
  {
    title: t('dq.method'),
    dataIndex: 'tags',
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.METHOD,
    width: 220,
    render: (tags: TagLabel[] = [], record) =>
      record.isLoadMoreButton
        ? null
        : renderDQClassificationTags(
            tags,
            DQ_TAG_CLASSIFICATIONS.method,
            'method'
          ),
  },
  {
    title: t('dq.frequency'),
    dataIndex: 'tags',
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.FREQUENCY,
    width: 110,
    render: (tags: TagLabel[] = [], record) =>
      record.isLoadMoreButton
        ? null
        : renderDQClassificationTags(
            tags,
            DQ_TAG_CLASSIFICATIONS.frequency,
            'frequency'
          ),
  },
  {
    title: t('dq.quality-threshold'),
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.QUALITY_THRESHOLD,
    width: 160,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : renderDQQualityThreshold(
            (record.extension as DQExtension | undefined)?.qualityThreshold
          ),
  },
  {
    title: t('dq.data-source'),
    dataIndex: 'tags',
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.DATA_SOURCE,
    width: 140,
    render: (tags: TagLabel[] = [], record) =>
      record.isLoadMoreButton
        ? null
        : renderDQClassificationTags(
            tags,
            DQ_TAG_CLASSIFICATIONS.dataSource,
            'source'
          ),
  },
];
