/*
 *  Copyright 2025 Collate.
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

import { TabSpecificField } from '../enums/entity.enum';
import {
  GlossaryTermRelationType,
  RelationCategory,
} from '../generated/configuration/glossaryTermRelationSettings';
import { EntityStatus } from '../generated/entity/data/glossaryTerm';
import i18n from '../utils/i18next/LocalUtil';

export const DEFAULT_GLOSSARY_TERM_RELATION_TYPES_FALLBACK: GlossaryTermRelationType[] =
  [
    {
      name: 'relatedTo',
      displayName: 'Related To',
      description: 'General associative relationship',
      isSymmetric: true,
      category: RelationCategory.Associative,
    },
  ];

export const GLOSSARY_TERM_TABLE_COLUMNS_KEYS = {
  NAME: 'name',
  DESCRIPTION: 'description',
  REVIEWERS: 'reviewers',
  SYNONYMS: 'synonyms',
  OWNERS: 'owners',
  STATUS: 'status',
  ACTIONS: 'actions',
};

export const CDE_GLOSSARY_TERM_FIELDS = [
  TabSpecificField.CHILDREN_COUNT,
  TabSpecificField.OWNERS,
  TabSpecificField.REVIEWERS,
  TabSpecificField.DOMAINS,
  TabSpecificField.TAGS,
  TabSpecificField.EXTENSION,
];

export const DATA_DICTIONARY_GLOSSARY_NAME = 'Data Dictionary';
export const DATA_DICTIONARY_GLOSSARY_DISPLAY_NAME =
  'Từ điển dữ liệu dùng chung';

export const isDataDictionaryGlossary = (
  ...identifiers: Array<string | undefined>
) =>
  identifiers.some(
    (identifier) =>
      identifier === DATA_DICTIONARY_GLOSSARY_NAME ||
      identifier === DATA_DICTIONARY_GLOSSARY_DISPLAY_NAME ||
      identifier?.startsWith(`${DATA_DICTIONARY_GLOSSARY_NAME}.`) ||
      identifier?.startsWith(`${DATA_DICTIONARY_GLOSSARY_DISPLAY_NAME}.`)
  );

export const DATA_QUALITY_GLOSSARY_NAME = 'Data Quality';
export const DATA_QUALITY_GLOSSARY_DISPLAY_NAME = 'Chất lượng dữ liệu';

export const isDataQualityGlossary = (
  ...identifiers: Array<string | undefined>
) =>
  identifiers.some(
    (identifier) =>
      identifier === DATA_QUALITY_GLOSSARY_NAME ||
      identifier === DATA_QUALITY_GLOSSARY_DISPLAY_NAME ||
      identifier?.startsWith(`${DATA_QUALITY_GLOSSARY_NAME}.`) ||
      identifier?.startsWith(`${DATA_QUALITY_GLOSSARY_DISPLAY_NAME}.`)
  );

export const TECHNICAL_DICTIONARY_GLOSSARY_NAME = 'Technical Dictionary';
export const TECHNICAL_DICTIONARY_GLOSSARY_DISPLAY_NAME = 'Từ điển kỹ thuật';

export const isTechnicalDictionaryGlossary = (
  ...identifiers: Array<string | undefined>
) =>
  identifiers.some(
    (identifier) =>
      identifier === TECHNICAL_DICTIONARY_GLOSSARY_NAME ||
      identifier === TECHNICAL_DICTIONARY_GLOSSARY_DISPLAY_NAME ||
      identifier?.startsWith(`${TECHNICAL_DICTIONARY_GLOSSARY_NAME}.`) ||
      identifier?.startsWith(`${TECHNICAL_DICTIONARY_GLOSSARY_DISPLAY_NAME}.`)
  );

export const DQ_GLOSSARY_TERM_FIELDS = [
  TabSpecificField.CHILDREN_COUNT,
  TabSpecificField.OWNERS,
  TabSpecificField.REVIEWERS,
  TabSpecificField.TAGS,
  TabSpecificField.EXTENSION,
  TabSpecificField.RELATED_TERMS,
];

export const DQ_GLOSSARY_TABLE_COLUMNS_KEYS = {
  NAME: 'name',
  CDE_CODE: 'dqCdeCode',
  CDE_NAME: 'dqCdeName',
  DIMENSION: 'dqDimension',
  DESCRIPTION: 'dqDescription',
  RULE_EXPLANATION: 'dqRuleExplanation',
  OTHER_CONSTRAINTS: 'dqOtherConstraints',
  EXCEPTIONS: 'dqExceptions',
  TARGET_POPULATION: 'dqTargetPopulation',
  METHOD: 'dqMethod',
  FREQUENCY: 'dqFrequency',
  QUALITY_THRESHOLD: 'dqQualityThreshold',
  DATA_SOURCE: 'dqDataSource',
};

export const DQ_DEFAULT_VISIBLE_COLUMNS = Object.values(
  DQ_GLOSSARY_TABLE_COLUMNS_KEYS
)
  .filter((key) => key !== DQ_GLOSSARY_TABLE_COLUMNS_KEYS.NAME)
  .concat(GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS);

export const DQ_STATIC_VISIBLE_COLUMNS = [
  DQ_GLOSSARY_TABLE_COLUMNS_KEYS.NAME,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS,
];

export const DQ_GLOSSARY_TABLE_PREFERENCE_KEY = 'dqGlossaryTerm';

export const CDE_GLOSSARY_TABLE_COLUMNS_KEYS = {
  NAME: 'name',
  DOMAINS: 'cdeDomains',
  DISPLAY_NAME: 'cdeDisplayName',
  DATA_SOURCE: 'cdeDataSource',
  DESCRIPTION: 'cdeDescription',
  ENTITY_RELATIONSHIP: 'cdeEntityRelationship',
  OWNERS: 'cdeOwners',
  DATA_CLASSIFICATION: 'cdeDataClassification',
  PERSONAL_DATA: 'cdePersonalData',
  RELATED_REGULATION: 'cdeRelatedRegulation',
  DATA_QUALITY_RULE: 'cdeDataQualityRule',
};

export const CDE_DEFAULT_VISIBLE_COLUMNS = Object.values(
  CDE_GLOSSARY_TABLE_COLUMNS_KEYS
)
  .filter((key) => key !== CDE_GLOSSARY_TABLE_COLUMNS_KEYS.NAME)
  .concat(GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS);

export const CDE_STATIC_VISIBLE_COLUMNS = [
  CDE_GLOSSARY_TABLE_COLUMNS_KEYS.NAME,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS,
];

export const CDE_GLOSSARY_TABLE_PREFERENCE_KEY = 'cdeGlossaryTerm';

export const DEFAULT_VISIBLE_COLUMNS = [
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.DESCRIPTION,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.OWNERS,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.STATUS,
];

export const STATIC_VISIBLE_COLUMNS = [
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.NAME,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS.ACTIONS,
];

export const GLOSSARY_TERM_STATUS_OPTIONS = [
  {
    value: 'all',
    text: i18n.t('label.all'),
  },
  ...Object.values(EntityStatus).map((status) => ({
    value: status,
    text: status,
  })),
];

export const GLOSSARY_TERM_APPROVAL_WORKFLOW_DEFINITION_NAME =
  'GlossaryTermApprovalWorkflow';
