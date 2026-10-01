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
  getTagLabel,
  isSourceUnavailable,
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
  cde: { id: 'cde-1', code: 'CDE1', name: 'Tên khách hàng' },
  dataOwners: [{ id: 'owner-1', name: 'Ban KHCL' }],
  rank: 2,
  elementType: {
    fqn: 'DataElementType.AtomicDataElement',
    label: 'Dữ liệu nguyên tố',
  },
  timeliness: { fqn: 'DataTimeliness.T1', label: 'T+1' },
  systemOwner: { id: 'team-1', name: 'Ban CNTT' },
  updatedAt: 1700000000000,
  updatedBy: 'admin',
  ...overrides,
});

describe('toTechnicalDictionaryRow', () => {
  it('maps source, CDE and classification fields', () => {
    const row = toTechnicalDictionaryRow(apiRow());

    expect(row.key).toBe('term-1');
    expect(row.revision).toBe(3);
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
    expect(row.systemOwner?.id).toBe('team-1');
    expect(row.dataOwners).toHaveLength(1);
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
  });
});
