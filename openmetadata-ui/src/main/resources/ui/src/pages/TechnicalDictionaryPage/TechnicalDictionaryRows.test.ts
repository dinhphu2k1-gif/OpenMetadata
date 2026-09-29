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
  getTagLabel,
  isEditableRow,
  isSourceUnavailable,
  toTechnicalDictionaryRow,
} from './TechnicalDictionaryRows';

const apiRow = (
  overrides: Partial<TechnicalRecordApiRow> = {}
): TechnicalRecordApiRow => ({
  termId: 'term-1',
  name: 'column-key',
  displayName: 'NAME',
  description: 'Tên khách hàng',
  businessVersion: '2.1',
  parentBusinessVersion: '2',
  entityStatus: 'Draft',
  recordType: 'working',
  workingRevision: 3,
  tags: [
    { tagFQN: 'DataTimeliness.T1', displayName: 'T+1' } as never,
    { tagFQN: 'DataElementType.AtomicDataElement' } as never,
    { tagFQN: 'PII.Sensitive' } as never,
  ],
  relatedTerms: [{ term: { id: 'cde-1', type: 'glossaryTerm' } } as never],
  extension: {
    sourceColumnFqn: 'ipcas.core.dbo.CUSTOMER.NAME',
    sourceDatabase: 'core',
    sourceSchema: 'dbo',
    sourceTable: 'CUSTOMER',
    sourceColumn: 'NAME',
    sourceService: 'ipcas',
    sourceDataType: 'varchar(100)',
    survivorshipRank: 2,
    systemOwner: { id: 'team-1', type: 'team', name: 'khcl' },
  },
  sourceStatus: 'Available',
  cdeCode: 'CDE1',
  cdeName: 'Tên khách hàng',
  dataOwners: [{ id: 'owner-1', type: 'team', name: 'khcl' } as never],
  ...overrides,
});

describe('toTechnicalDictionaryRow', () => {
  it('maps source, CDE and classification fields', () => {
    const row = toTechnicalDictionaryRow(apiRow());

    expect(row.key).toBe('term-1:2.1:working');
    expect(row.databaseName).toBe('core');
    expect(row.tableName).toBe('CUSTOMER');
    expect(row.columnName).toBe('NAME');
    expect(row.serviceName).toBe('ipcas');
    expect(row.dataType).toBe('varchar(100)');
    expect(row.rank).toBe(2);
    expect(row.cdeCode).toBe('CDE1');
    expect(row.cdeTermId).toBe('cde-1');
    expect(getTagLabel(row.timeliness)).toBe('T+1');
    expect(getTagLabel(row.elementType)).toBe('AtomicDataElement');
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

  it('derives the release version type from the business version', () => {
    expect(toTechnicalDictionaryRow(apiRow()).releaseVersionType).toBe(
      'Bản phụ'
    );
    expect(
      toTechnicalDictionaryRow(apiRow({ businessVersion: '2.0' }))
        .releaseVersionType
    ).toBe('Bản chính');
  });

  it('tolerates rows without extension, tags, relations or owners', () => {
    const row = toTechnicalDictionaryRow(
      apiRow({
        extension: undefined,
        tags: undefined,
        relatedTerms: undefined,
        dataOwners: undefined as never,
      })
    );

    expect(row.rank).toBeUndefined();
    expect(row.cdeTermId).toBeUndefined();
    expect(row.columnName).toBe('NAME');
    expect(row.dataOwners).toEqual([]);
    expect(row.databaseFqn).toBeUndefined();
  });
});

describe('row predicates', () => {
  it('only unlocked Draft working rows are editable', () => {
    expect(isEditableRow(toTechnicalDictionaryRow(apiRow()))).toBe(true);
    expect(
      isEditableRow(
        toTechnicalDictionaryRow(apiRow({ entityStatus: 'In Review' }))
      )
    ).toBe(false);
    expect(
      isEditableRow(
        toTechnicalDictionaryRow(apiRow({ recordType: 'published' }))
      )
    ).toBe(false);
  });

  it('flags rows whose source column no longer exists', () => {
    expect(
      isSourceUnavailable(
        toTechnicalDictionaryRow(apiRow({ sourceStatus: 'Unavailable' }))
      )
    ).toBe(true);
    expect(isSourceUnavailable(toTechnicalDictionaryRow(apiRow()))).toBe(false);
  });
});
