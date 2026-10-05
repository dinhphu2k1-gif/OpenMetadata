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
  TechnicalColumnCandidate,
  TechnicalRecordApiRow,
  TechnicalTagValue,
} from '../../rest/technicalDictionaryAPI';
import Fqn from '../../utils/Fqn';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';

const text = (value: unknown): string =>
  value === undefined || value === null ? '' : String(value);

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

/** Converts one flat read-model row into the table/modal view model. */
export const toTechnicalDictionaryRow = (
  row: TechnicalRecordApiRow
): TechnicalDictionaryRow => {
  const columnFqn = text(row.columnFqn);

  return {
    key: row.termId,
    termId: row.termId,
    revision: row.revision,
    status: row.status ?? 'Approved',
    createdBy: row.createdBy,
    submittedAt: row.submittedAt,
    submittedBy: row.submittedBy,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy,
    reviewComment: row.reviewComment,
    databaseName: text(row.database),
    databaseFqn: columnFqn ? parentFqn(columnFqn, 2) : undefined,
    schemaName: text(row.schema),
    schemaFqn: columnFqn ? parentFqn(columnFqn, 3) : undefined,
    tableName: text(row.table),
    tableFqn: columnFqn ? parentFqn(columnFqn, 4) : undefined,
    columnName: text(row.column),
    columnFqn,
    serviceName: text(row.service),
    dataType: text(row.dataType),
    description: text(row.description),
    rank: typeof row.rank === 'number' ? row.rank : undefined,
    cdeCode: text(row.cde?.code),
    cdeName: text(row.cde?.name),
    cdeTermId: row.cde?.id,
    dataOwners: row.dataOwners ?? [],
    elementType: row.elementType,
    generationType: row.generationType,
    creationMethod: row.creationMethod,
    timeliness: row.timeliness,
    systemOwner: row.systemOwner,
    sourceStatus: row.sourceStatus ?? 'Available',
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  };
};

export const getTagLabel = (tag?: TechnicalTagValue): string =>
  tag ? tag.label || tag.fqn.split('.').pop() || '' : '';

export const isSourceUnavailable = (row: TechnicalDictionaryRow): boolean =>
  row.sourceStatus === 'Unavailable';

/** UI guard only; the API repeats both the permission and maker-checker checks. */
export const canReviewTechnicalRecord = (
  row: TechnicalDictionaryRow,
  canApprove: boolean,
  currentUserName?: string
): boolean =>
  canApprove &&
  row.status === 'In Review' &&
  Boolean(currentUserName) &&
  row.createdBy !== currentUserName;

/** A not-yet-declared Column as the empty row the declaration form starts from. */
export const candidateToRow = (
  candidate: TechnicalColumnCandidate
): TechnicalDictionaryRow => ({
  key: candidate.columnKey,
  termId: '',
  revision: 0,
  status: 'In Review',
  databaseName: text(candidate.sourceDatabase),
  databaseFqn: parentFqn(candidate.columnFqn, 2),
  schemaName: text(candidate.sourceSchema),
  schemaFqn: parentFqn(candidate.columnFqn, 3),
  tableName: text(candidate.sourceTable),
  tableFqn: parentFqn(candidate.columnFqn, 4),
  columnName: text(candidate.sourceColumn),
  columnFqn: candidate.columnFqn,
  serviceName: text(candidate.sourceService),
  dataType: text(candidate.sourceDataType),
  description: text(candidate.description),
  cdeCode: '',
  cdeName: '',
  dataOwners: [],
  sourceStatus: 'Available',
});
