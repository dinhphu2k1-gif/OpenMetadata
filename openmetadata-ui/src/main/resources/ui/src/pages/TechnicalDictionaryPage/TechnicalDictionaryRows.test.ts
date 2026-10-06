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
import { TechnicalRecordApiRow } from '../../rest/technicalDictionaryAPI';
import {
  candidateToRow,
  canReviewTechnicalRecord,
  getReviewableTechnicalRecords,
  getSubmittableTechnicalRecords,
  getTagLabel,
  getTechnicalRecordPath,
  isSourceUnavailable,
  toBulkResultItems,
  toTechnicalDictionaryRow,
} from './TechnicalDictionaryRows';

const apiRow = (
  overrides: Partial<TechnicalRecordApiRow> = {}
): TechnicalRecordApiRow => ({
  termId: 'term-1',
  columnKey: 'column-key',
  columnFqn: 'ipcas.core.dbo.CUSTOMER.NAME',
  service: 'ipcas',
  database: 'core',
  schema: 'dbo',
  table: 'CUSTOMER',
  column: 'NAME',
  dataType: 'varchar(100)',
  description: 'Tên khách hàng',
  sourceStatus: 'Available',
  revision: 3,
  status: 'Approved',
  createdBy: 'maker',
  cde: { id: 'cde-1', code: 'CDE1', name: 'Tên khách hàng' },
  dataOwners: [{ id: 'owner-1', name: 'Ban KHCL' }],
  rank: 2,
  elementType: {
    fqn: 'DataElementType.AtomicDataElement',
    label: 'Dữ liệu nguyên tố',
  },
  timeliness: { fqn: 'DataTimeliness.T1', label: 'T+1' },
  systemOwners: [{ id: 'team-1', name: 'Ban CNTT', type: 'team' }],
  updatedAt: 1700000000000,
  updatedBy: 'admin',
  ...overrides,
});

describe('toTechnicalDictionaryRow', () => {
  it('keeps the two rows of a pending update apart by key', () => {
    const approved = toTechnicalDictionaryRow(apiRow({ rowRole: 'APPROVED' }));
    const change = toTechnicalDictionaryRow(
      apiRow({ rowRole: 'CHANGE', status: 'Draft' })
    );

    expect(approved.key).toBe('term-1');
    expect(change.key).toBe('term-1:change');
    expect(change.termId).toBe(approved.termId);
  });

  it('maps source, CDE and classification fields', () => {
    const row = toTechnicalDictionaryRow(apiRow());

    expect(row.key).toBe('term-1');
    expect(row.revision).toBe(3);
    expect(row.status).toBe('Approved');
    expect(row.createdBy).toBe('maker');
    expect(row.databaseName).toBe('core');
    expect(row.tableName).toBe('CUSTOMER');
    expect(row.columnName).toBe('NAME');
    expect(row.serviceName).toBe('ipcas');
    expect(row.dataType).toBe('varchar(100)');
    expect(row.rank).toBe(2);
    expect(row.cdeCode).toBe('CDE1');
    expect(row.cdeTermId).toBe('cde-1');
    expect(getTagLabel(row.timeliness)).toBe('T+1');
    expect(getTagLabel(row.elementType)).toBe('Dữ liệu nguyên tố');
    expect(row.generationType).toBeUndefined();
    expect(row.systemOwners[0].id).toBe('team-1');
    expect(row.dataOwners).toHaveLength(1);
  });

  it('maps pending-change metadata without replacing Approved values', () => {
    const row = toTechnicalDictionaryRow(
      apiRow({
        hasPendingChange: true,
        changeRequestId: 'change-1',
        changeRequestStatus: 'InReview',
        changeOperation: 'UPDATE',
        changeCreatedBy: 'maker',
      })
    );

    expect(row.status).toBe('Approved');
    expect(row.cdeCode).toBe('CDE1');
    expect(row.hasPendingChange).toBe(true);
    expect(row.changeRequestStatus).toBe('InReview');
  });

  it('derives the parent FQNs used for entity links', () => {
    const row = toTechnicalDictionaryRow(apiRow());

    expect(row.databaseFqn).toBe('ipcas.core');
    expect(row.schemaFqn).toBe('ipcas.core.dbo');
    expect(row.tableFqn).toBe('ipcas.core.dbo.CUSTOMER');
  });

  it('leaves the CDE fields empty for a Column that is not mapped', () => {
    const row = toTechnicalDictionaryRow(
      apiRow({ cde: undefined, rank: undefined, dataOwners: undefined })
    );

    expect(row.cdeCode).toBe('');
    expect(row.cdeTermId).toBeUndefined();
    expect(row.rank).toBeUndefined();
    expect(row.dataOwners).toEqual([]);
  });

  it('falls back to the last tag segment when no label was indexed', () => {
    expect(getTagLabel({ fqn: 'DataTimeliness.T2', label: '' })).toBe('T2');
    expect(getTagLabel(undefined)).toBe('');
  });

  it('recognizes a source that is no longer available', () => {
    expect(
      isSourceUnavailable(
        toTechnicalDictionaryRow(apiRow({ sourceStatus: 'Unavailable' }))
      )
    ).toBe(true);
    expect(isSourceUnavailable(toTechnicalDictionaryRow(apiRow()))).toBe(false);
  });
});

describe('candidateToRow', () => {
  it('starts the declaration form from the physical Column', () => {
    const row = candidateToRow({
      columnKey: 'key-1',
      columnFqn: 'ipcas.core.dbo.CUSTOMER.NAME',
      declared: false,
      sourceService: 'ipcas',
      sourceDatabase: 'core',
      sourceSchema: 'dbo',
      sourceTable: 'CUSTOMER',
      sourceColumn: 'NAME',
      sourceDataType: 'varchar(100)',
      description: 'Tên khách hàng',
    });

    expect(row.termId).toBe('');
    expect(row.columnName).toBe('NAME');
    expect(row.tableFqn).toBe('ipcas.core.dbo.CUSTOMER');
    expect(row.cdeCode).toBe('');
    expect(row.sourceStatus).toBe('Available');
    expect(row.status).toBe('Draft');
  });
});

describe('canReviewTechnicalRecord', () => {
  const row = toTechnicalDictionaryRow(
    apiRow({ status: 'In Review', createdBy: 'maker' })
  );

  it('allows an independent approver to review an in-review record', () => {
    expect(canReviewTechnicalRecord(row, true, 'checker')).toBe(true);
  });

  it('hides review actions from the maker and users without approval permission', () => {
    expect(canReviewTechnicalRecord(row, true, 'maker')).toBe(false);
    expect(canReviewTechnicalRecord(row, false, 'checker')).toBe(false);
    expect(canReviewTechnicalRecord(row, true, undefined)).toBe(false);
  });

  it('uses the proposal maker for an Approved record with a pending change', () => {
    const pending = toTechnicalDictionaryRow(
      apiRow({
        status: 'Approved',
        hasPendingChange: true,
        changeRequestStatus: 'InReview',
        changeCreatedBy: 'proposal-maker',
      })
    );

    expect(canReviewTechnicalRecord(pending, true, 'checker')).toBe(true);
    expect(canReviewTechnicalRecord(pending, true, 'proposal-maker')).toBe(
      false
    );
  });
});

describe('getReviewableTechnicalRecords', () => {
  const inReview = (termId: string, createdBy: string) =>
    toTechnicalDictionaryRow(
      apiRow({ termId, status: 'In Review', createdBy })
    );
  const rows = [
    inReview('by-maker', 'maker'),
    inReview('by-checker', 'checker'),
    toTechnicalDictionaryRow(
      apiRow({ termId: 'approved', status: 'Approved' })
    ),
    toTechnicalDictionaryRow(
      apiRow({ termId: 'rejected', status: 'Rejected' })
    ),
    inReview('by-maker-again', 'maker'),
  ];

  it('keeps only in-review records created by somebody else, in order', () => {
    expect(
      getReviewableTechnicalRecords(rows, true, 'checker').map(
        (row) => row.termId
      )
    ).toEqual(['by-maker', 'by-maker-again']);
  });

  it('keeps nothing for a user without approval permission or a known name', () => {
    expect(getReviewableTechnicalRecords(rows, false, 'checker')).toEqual([]);
    expect(getReviewableTechnicalRecords(rows, true, undefined)).toEqual([]);
  });
});

describe('record summaries', () => {
  const row = toTechnicalDictionaryRow(apiRow());

  it('writes the path of the Column as database / schema / table', () => {
    expect(getTechnicalRecordPath(row)).toBe('core / dbo / CUSTOMER');
  });
});

describe('toBulkResultItems', () => {
  const first = toTechnicalDictionaryRow(apiRow({ termId: 'first' }));
  const second = toTechnicalDictionaryRow(apiRow({ termId: 'second' }));

  it('pairs each outcome with its row in the order of the response', () => {
    const items = toBulkResultItems(
      [first, second],
      [
        {
          termId: 'second',
          outcome: 'FAILED',
          code: 'TD_RANK_DUPLICATE',
          message: 'Rank taken',
        },
        { termId: 'first', outcome: 'SUCCEEDED' },
      ]
    );

    expect(items.map((item) => item.row.termId)).toEqual(['second', 'first']);
    expect(items[0].outcome.message).toBe('Rank taken');
  });

  it('skips an outcome for a record that was not on screen', () => {
    expect(
      toBulkResultItems([first], [{ termId: 'other', outcome: 'SUCCEEDED' }])
    ).toEqual([]);
  });
});

describe('getSubmittableTechnicalRecords', () => {
  const rows = (
    ['Draft', 'In Review', 'Approved', 'Rejected', 'Draft'] as const
  ).map((status, index) =>
    toTechnicalDictionaryRow(apiRow({ termId: `row-${index}`, status }))
  );

  it('keeps only drafts, in order, for a user who may edit', () => {
    expect(
      getSubmittableTechnicalRecords(rows, true).map((row) => row.termId)
    ).toEqual(['row-0', 'row-4']);
  });

  it('keeps nothing for a user who may not edit', () => {
    expect(getSubmittableTechnicalRecords(rows, false)).toEqual([]);
  });
});
