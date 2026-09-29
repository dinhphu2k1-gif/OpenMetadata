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
import { isEmpty } from 'lodash';
import {
  EntityReference,
  TagLabel,
} from '../../generated/entity/data/glossaryTerm';
import { TECHNICAL_CLASSIFICATIONS } from '../../constants/TechnicalDictionary.constants';
import { TechnicalRecordApiRow } from '../../rest/technicalDictionaryAPI';
import { getCDEReleaseVersionType } from '../../utils/CDEReleaseVersionTypeUtils';
import Fqn from '../../utils/Fqn';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';

const text = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value);

export const findClassificationTag = (
  tags: TagLabel[] | undefined,
  classification: string
): TagLabel | undefined =>
  tags?.find((tag) => tag.tagFQN?.startsWith(`${classification}.`));

const parentFqn = (fqn: string, depth: number): string | undefined => {
  let result: string | undefined;
  try {
    const parts = Fqn.split(fqn);
    result =
      parts.length > depth ? Fqn.build(...parts.slice(0, depth)) : undefined;
  } catch {
    result = undefined;
  }

  return result;
};

const asReference = (value: unknown): EntityReference | undefined =>
  value && typeof value === 'object' && 'id' in value
    ? (value as EntityReference)
    : undefined;

const asRank = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** Converts one flat read-model row into the table/modal view model. */
export const toTechnicalDictionaryRow = (
  row: TechnicalRecordApiRow
): TechnicalDictionaryRow => {
  const extension = row.extension ?? {};
  const columnFqn = text(extension.sourceColumnFqn);
  const relation = isEmpty(row.relatedTerms)
    ? undefined
    : row.relatedTerms?.[0];

  return {
    key: `${row.termId}:${row.businessVersion}:${row.recordType}`,
    termId: row.termId,
    businessVersion: row.businessVersion,
    parentBusinessVersion: row.parentBusinessVersion,
    status: row.entityStatus,
    recordType: row.recordType,
    workingRevision: row.workingRevision,
    databaseName: text(extension.sourceDatabase),
    databaseFqn: columnFqn ? parentFqn(columnFqn, 2) : undefined,
    schemaName: text(extension.sourceSchema),
    schemaFqn: columnFqn ? parentFqn(columnFqn, 3) : undefined,
    tableName: text(extension.sourceTable),
    tableFqn: columnFqn ? parentFqn(columnFqn, 4) : undefined,
    columnName: text(extension.sourceColumn) || text(row.displayName),
    columnFqn,
    serviceName: text(extension.sourceService),
    dataType: text(extension.sourceDataType),
    description: text(row.description),
    rank: asRank(extension.survivorshipRank),
    cdeCode: row.cdeCode ?? '',
    cdeName: row.cdeName ?? '',
    cdeTermId: relation?.term?.id,
    cdeRelation: relation,
    dataOwners: row.dataOwners ?? [],
    elementType: findClassificationTag(
      row.tags,
      TECHNICAL_CLASSIFICATIONS.ELEMENT_TYPE
    ),
    generationType: findClassificationTag(
      row.tags,
      TECHNICAL_CLASSIFICATIONS.GENERATION_TYPE
    ),
    creationMethod: findClassificationTag(
      row.tags,
      TECHNICAL_CLASSIFICATIONS.CREATION_METHOD
    ),
    timeliness: findClassificationTag(
      row.tags,
      TECHNICAL_CLASSIFICATIONS.TIMELINESS
    ),
    systemOwner: asReference(extension.systemOwner),
    releaseVersionType:
      getCDEReleaseVersionType(
        extension.releaseVersionType,
        row.businessVersion
      ) ?? '',
    sourceStatus: row.sourceStatus ?? 'Available',
  };
};

export const getTagLabel = (tag?: TagLabel): string =>
  tag ? tag.displayName || tag.name || tag.tagFQN.split('.').pop() || '' : '';

/** Rows the user may edit: an unlocked Draft working representation. */
export const isEditableRow = (row: TechnicalDictionaryRow): boolean =>
  row.recordType === 'working' && row.status === 'Draft';

export const isSourceUnavailable = (row: TechnicalDictionaryRow): boolean =>
  row.sourceStatus === 'Unavailable';
