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

import { getTechnicalColumnMetadata } from './TechnicalDictionaryMetadata';

describe('technical column metadata from search results', () => {
  it('preserves a_brcd rank stored on the column without CDE rules', () => {
    expect(
      getTechnicalColumnMetadata({
        fullyQualifiedName: 'MIS.MISDB.ms1.TBMS_SBVRUNTP.a_brcd',
        dataTypeDisplay: 'varchar2(6)',
        extension: { survivorshipRank: 1, survivorshipNote: 'Primary source' },
      })
    ).toEqual({
      dataLength: 6,
      scale: undefined,
      survivorshipRank: 1,
      survivorshipNote: 'Primary source',
    });
  });

  it('matches CDE rules regardless of FQN casing and keeps the matching note', () => {
    expect(
      getTechnicalColumnMetadata(
        {
          fullyQualifiedName: 'MIS.MISDB.ms1.TBMS_SBVRUNTP.a_brcd',
          extension: { survivorshipRank: 3, survivorshipNote: 'Column note' },
        },
        new Map([['mis.misdb.ms1.tbms_sbvruntp.a_brcd', { rank: 1 }]])
      )
    ).toMatchObject({ survivorshipRank: 1, survivorshipNote: undefined });
  });

  it.each([
    ['varchar2(6)', 6, undefined],
    ['nvarchar2(300)', 300, undefined],
    ['VARCHAR2(20 CHAR)', 20, undefined],
    ['decimal(18, 2)', 18, 2],
    ['NUMBER(10,0)', 10, 0],
    ['timestamp(6)', undefined, undefined],
    ['integer', undefined, undefined],
    ['varchar(max)', undefined, undefined],
  ])(
    'reads dimensions from %s without inventing a length',
    (dataTypeDisplay, dataLength, scale) => {
      expect(getTechnicalColumnMetadata({ dataTypeDisplay })).toMatchObject({
        dataLength,
        scale,
      });
    }
  );

  it('prefers explicit dimensions over the SQL display', () => {
    expect(
      getTechnicalColumnMetadata({
        dataTypeDisplay: 'decimal(18,2)',
        dataLength: 12,
        scale: 0,
      })
    ).toMatchObject({ dataLength: 12, scale: 0 });
  });

  it('uses numeric precision when data length is absent', () => {
    expect(
      getTechnicalColumnMetadata({ precision: 15, scale: 3 })
    ).toMatchObject({ dataLength: 15, scale: 3 });
  });
});
