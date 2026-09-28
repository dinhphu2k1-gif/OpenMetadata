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
import {
  DATA_DICTIONARY_GLOSSARY_NAME,
  DQ_GLOSSARY_TABLE_COLUMNS_KEYS,
} from '../../../constants/Glossary.contant';
import {
  EntityReference,
  EntityStatus,
  GlossaryTerm,
  TermRelation,
} from '../../../generated/entity/data/glossaryTerm';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { formatCDEDate } from '../../../utils/CDEDateUtils';
import Fqn from '../../../utils/Fqn';
import {
  getGovernedTermDetailPath,
  getScopedGovernedTermFqn,
} from '../../../utils/routing/cdeRoutingHelper';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { ModifiedGlossaryTerm } from './GlossaryTermTab.interface';

export type DQExtension = {
  cdeCode?: string;
  cdeName?: string;
  ruleExplanation?: string;
  otherConstraints?: string;
  relatedRegulatoryDocuments?: string;
  qualityThreshold?: string;
  releaseVersionType?: string;
  releaseLevel?: string | string[];
  effectiveDate?: string;
  expirationDate?: string;
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
};

import {
  getDictionaryReferenceLabel,
  renderDictionaryOwnerList,
  renderDictionaryMarkdown,
  renderDictionaryClassificationTags,
  getDictionaryTagLabel,
} from './DictionaryCellRenderers';
import {
  renderCDEReleaseLevel,
  renderCDEReleaseVersionType,
} from './CDEGlossaryTableColumns';

export const getDQReferenceLabel = getDictionaryReferenceLabel;

export const renderDQOwners = (owners: EntityReference[] = []) =>
  renderDictionaryOwnerList(owners, 'dq-owner');

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
            {getDictionaryTagLabel(tag)}
          </Tag>
        );
      })}
    </div>
  );
};

export const renderDQClassificationTags = (
  tags: TagLabel[] = [],
  classification: string,
  variant:
    | 'source'
    | 'population'
    | 'method'
    | 'frequency'
    | 'neutral' = 'neutral'
) => renderDictionaryClassificationTags(tags, classification, variant);

export const renderDQMarkdown = renderDictionaryMarkdown;

export const renderDQCdeCode = (
  record: ModifiedGlossaryTerm,
  extension?: DQExtension
) => {
  const cdeCode = extension?.cdeCode;
  const relatedTerms = record.relatedTerms as
    | Array<TermRelation | EntityReference>
    | undefined;
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

export const getDQCdeName = (record: ModifiedGlossaryTerm | GlossaryTerm) => {
  const relatedTerms = record.relatedTerms as
    | Array<TermRelation | EntityReference>
    | undefined;
  const relation = relatedTerms?.find((item) => {
    const term = (item as TermRelation)?.term ?? (item as EntityReference);

    return term?.fullyQualifiedName?.includes(DATA_DICTIONARY_GLOSSARY_NAME);
  });
  const term =
    (relation as TermRelation | undefined)?.term ??
    (relation as EntityReference | undefined);

  return getEntityName(term) || NO_DATA_PLACEHOLDER;
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
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.RULE_CODE,
    fixed: 'left',
    width: 110,
    render: (_: unknown, record) => {
      const name = record.name;
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

      const displayRuleCode = name;
      const glossaryFqn =
        record.glossary?.fullyQualifiedName ?? record.glossary?.name;
      const canonicalFqn = glossaryFqn
        ? Fqn.build(glossaryFqn, name)
        : record.fullyQualifiedName ?? name;
      const businessVersion = record.businessVersion ?? '1.0';
      const parentBusinessVersion =
        record.parentBusinessVersion ?? String(businessVersion).split('.')[0];
      const detailPath = getGovernedTermDetailPath({
        fqn: getScopedGovernedTermFqn(
          canonicalFqn,
          parentBusinessVersion
        ),
        businessVersion,
        parentBusinessVersion,
        termId: record.id,
        isWorkingDraft: record.entityStatus !== EntityStatus.Approved,
      });

      return (
        <Link
          className="dq-code-link font-semibold cursor-pointer"
          data-testid={`dq-code-${name}`}
          to={detailPath}>
          {displayRuleCode}
        </Link>
      );
    },
  },
  {
    title: t('dq.rule-name', 'Tên quy tắc'),
    dataIndex: 'displayName',
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.RULE_NAME,
    fixed: 'left',
    width: 220,
    render: (displayName: string | undefined, record) =>
      record.isLoadMoreButton
        ? null
        : displayName?.trim() || NO_DATA_PLACEHOLDER,
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
    width: 180,
    render: (_, record) => {
      if (record.isLoadMoreButton) {
        return null;
      }
      return getDQCdeName(record);
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
    title: t('cde.related-regulatory-documents'),
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.RELATED_REGULATORY_DOCUMENTS,
    width: 240,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : renderDQMarkdown(
            (record.extension as DQExtension | undefined)
              ?.relatedRegulatoryDocuments
          ),
  },
  {
    title: t('label.version'),
    dataIndex: 'businessVersion',
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.BUSINESS_VERSION,
    width: 110,
    render: (businessVersion: string | undefined, record) =>
      record.isLoadMoreButton ? null : businessVersion || NO_DATA_PLACEHOLDER,
  },
  {
    title: t('dq.release-version-type', 'Loại phiên bản phát hành'),
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.RELEASE_VERSION_TYPE,
    width: 190,
    render: (_, record) =>
      record.isLoadMoreButton
        ? null
        : renderCDEReleaseVersionType(
            (record.extension as DQExtension | undefined)?.releaseVersionType,
            record.businessVersion
          ),
  },
  {
    title: t('cde.release-level'),
    key: DQ_GLOSSARY_TABLE_COLUMNS_KEYS.RELEASE_LEVEL,
    width: 170,
    render: (_, record) =>
      renderCDEReleaseLevel(
        (record.extension as DQExtension | undefined)?.releaseLevel,
        t
      ),
  },
  ...(['effectiveDate', 'expirationDate'] as const).map((key) => ({
    title: String(
      t(key === 'effectiveDate' ? 'cde.effective-date' : 'cde.expiration-date')
    ),
    key:
      key === 'effectiveDate'
        ? DQ_GLOSSARY_TABLE_COLUMNS_KEYS.EFFECTIVE_DATE
        : DQ_GLOSSARY_TABLE_COLUMNS_KEYS.EXPIRATION_DATE,
    width: 160,
    render: (_: unknown, record: ModifiedGlossaryTerm) =>
      formatCDEDate((record.extension as DQExtension | undefined)?.[key]),
  })),
];
