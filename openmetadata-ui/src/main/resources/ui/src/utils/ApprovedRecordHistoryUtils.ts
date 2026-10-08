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

import {
  ApprovedRecordHistoryEntry,
  ApprovedRecordHistoryScope,
} from '../components/common/ApprovedRecordHistory/ApprovedRecordHistory.interface';
import { GlossaryTermCorrectionHistoryEntry } from '../rest/glossaryAPI';
import { TechnicalCorrectionEntry } from '../rest/technicalDictionaryAPI';

const COMMON_LABEL_KEYS: Record<string, string> = {
  description: 'label.description',
  synonyms: 'label.synonym-plural',
  reviewers: 'label.reviewer-plural',
  relatedTerms: 'label.related-term-plural',
  'extension.effectiveDate': 'cde.effective-date',
  'extension.expirationDate': 'cde.expiration-date',
  'extension.releaseLevel': 'cde.release-level',
  'extension.releaseVersionType': 'cde.release-version-type',
  'extension.relatedRegulatoryDocuments': 'cde.related-regulatory-documents',
};

const SCOPE_LABEL_KEYS: Record<
  ApprovedRecordHistoryScope,
  Record<string, string>
> = {
  cde: {
    displayName: 'cde.business-term-name',
    owners: 'cde.data-owner',
    domains: 'cde.business-group',
    'tags.DataSource': 'cde.data-source',
    'tags.DataClassification': 'cde.data-classification',
    'tags.PersonalData': 'cde.personal-data',
    'extension.dataQualityRules': 'cde.data-quality-rules',
    'extension.entityRelationship': 'cde.entity-relationship',
  },
  dq: {
    displayName: 'dq.rule-name',
    owners: 'label.owner-plural',
    domains: 'label.domain-plural',
    'tags.DataQualityDimension': 'dq.dimension',
    'tags.DataQualityTargetPopulation': 'dq.target-population',
    'tags.DataQualityMethod': 'dq.method',
    'tags.DataQualityFrequency': 'dq.frequency',
    'extension.qualityThreshold': 'dq.quality-threshold',
    'extension.ruleExplanation': 'dq.rule-explanation',
    'extension.otherConstraints': 'dq.other-constraints',
  },
  technical: {
    cde: 'label.cde-code-ref',
    rank: 'label.rank',
    elementType: 'label.data-element-type',
    generationType: 'label.generation-type',
    creationMethod: 'label.creation-method',
    timeliness: 'label.timeliness',
    systemOwner: 'label.technical-data-steward',
  },
};

/** Translation key of a changed field; an unknown field falls back to its name. */
export const getApprovedRecordFieldLabelKey = (
  scope: ApprovedRecordHistoryScope,
  field: string
): string =>
  SCOPE_LABEL_KEYS[scope][field] ?? COMMON_LABEL_KEYS[field] ?? field;

export const fromGlossaryCorrection = (
  entry: GlossaryTermCorrectionHistoryEntry
): ApprovedRecordHistoryEntry => ({
  id: entry.historyId,
  approvedAt: entry.supersededAt,
  approvedBy: entry.supersededBy,
  proposedAt: entry.proposedAt,
  proposedBy: entry.proposedBy,
  changes: entry.changes ?? [],
});

export const fromTechnicalCorrection = (
  entry: TechnicalCorrectionEntry
): ApprovedRecordHistoryEntry => ({
  id: entry.id,
  approvedAt: entry.approvedAt,
  approvedBy: entry.approvedBy,
  proposedAt: entry.proposedAt,
  proposedBy: entry.proposedBy,
  changes: entry.changes,
});
