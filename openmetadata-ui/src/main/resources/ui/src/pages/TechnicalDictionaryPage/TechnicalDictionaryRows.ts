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
  TechnicalBulkReviewOutcome,
  TechnicalChangeRequest,
  TechnicalColumnCandidate,
  TechnicalRecordApiRow,
  TechnicalTagValue,
} from '../../rest/technicalDictionaryAPI';
import Fqn from '../../utils/Fqn';
import {
  TechnicalBulkResultItem,
  TechnicalDictionaryRow,
} from './technicalDictionary.interface';

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
    // The two rows of a pending update share the record id.
    key: row.rowRole === 'CHANGE' ? `${row.termId}:change` : row.termId,
    rowRole: row.rowRole,
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
    systemOwners: row.systemOwners ?? [],
    sourceStatus: row.sourceStatus ?? 'Available',
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    hasPendingChange: row.hasPendingChange,
    changeRequestId: row.changeRequestId,
    changeRequestStatus: row.changeRequestStatus,
    changeOperation: row.changeOperation,
    changeCreatedBy: row.changeCreatedBy,
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
  (row.status === 'In Review' || row.changeRequestStatus === 'InReview') &&
  Boolean(currentUserName) &&
  (row.hasPendingChange
    ? row.changeCreatedBy !== currentUserName
    : row.createdBy !== currentUserName);

/** `database / schema / table` of the Column of a record. */
export const getTechnicalRecordPath = (row: TechnicalDictionaryRow): string =>
  [row.databaseName, row.schemaName, row.tableName].filter(Boolean).join(' / ');

/** The records of a selection that the current user may approve or reject. */
export const getReviewableTechnicalRecords = (
  rows: TechnicalDictionaryRow[],
  canApprove: boolean,
  currentUserName?: string
): TechnicalDictionaryRow[] =>
  rows.filter((row) =>
    canReviewTechnicalRecord(row, canApprove, currentUserName)
  );

/** The drafts of a selection that the current user may send for approval. */
export const getSubmittableTechnicalRecords = (
  rows: TechnicalDictionaryRow[],
  canEdit: boolean
): TechnicalDictionaryRow[] =>
  canEdit ? rows.filter((row) => row.status === 'Draft') : [];

/** Pairs each outcome of a bulk review with the row it was for, in the order of the request. */
export const toBulkResultItems = (
  rows: TechnicalDictionaryRow[],
  outcomes: TechnicalBulkReviewOutcome[]
): TechnicalBulkResultItem[] => {
  const rowsById = new Map(rows.map((row) => [row.termId, row]));

  return outcomes.flatMap((outcome) => {
    const row = rowsById.get(outcome.termId);

    return row ? [{ row, outcome }] : [];
  });
};

/** A not-yet-declared Column as the empty row the declaration form starts from. */
export const candidateToRow = (
  candidate: TechnicalColumnCandidate
): TechnicalDictionaryRow => ({
  key: candidate.columnKey,
  termId: '',
  revision: 0,
  status: 'Draft',
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
  systemOwners: [],
  sourceStatus: 'Available',
});

const CHANGE_STATUS = {
  InReview: 'In Review',
  Rejected: 'Rejected',
  Draft: 'Draft',
} as const;

/** The proposal of a pending change as a row of its own, next to the approved row it changes. */
export const toWorkingRow = (change: TechnicalChangeRequest) => {
  const approved = toTechnicalDictionaryRow(change.approvedRecord);
  const working: TechnicalDictionaryRow = {
    ...toTechnicalDictionaryRow(change.proposedRecord ?? change.approvedRecord),
    revision: change.revision,
    status: CHANGE_STATUS[change.status],
    createdBy: change.createdBy,
    hasPendingChange: true,
    changeRequestId: change.id,
    changeRequestStatus: change.status,
    changeOperation: change.operation,
    changeCreatedBy: change.createdBy,
  };

  return { approved, working };
};
