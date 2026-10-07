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

import { TFunction } from 'i18next';
import vi from '../../../locale/languages/vi-vn.json';
import { localizeDqMessage } from './DQRuleTests.utils';

type Messages = Record<string, string>;
const messages = vi.dq.test.messages as Messages;

// Resolves keys from the Vietnamese locale and fills the {{params}}, as i18next does
const t = ((key: string, params: Record<string, string> = {}) =>
  (messages[key.replace('dq.test.messages.', '')] ?? key).replace(
    /{{(\w+)}}/g,
    (_, name) => params[name]
  )) as unknown as TFunction;

describe('localizeDqMessage', () => {
  it.each([
    [
      'Found nullCount=1. It should be 0',
      'Ghi nhận nullCount=1, kỳ vọng bằng 0.',
    ],
    [
      'Found 17 value(s) matching regex pattern vs 20 value(s) in the column.',
      'Có 17 giá trị khớp biểu thức chính quy trên tổng 20 giá trị của cột.',
    ],
    [
      'Found 3 value(s) matching the forbidden regex pattern.',
      'Có 3 giá trị khớp biểu thức chính quy bị cấm.',
    ],
    [
      'Found rowCount=5 vs. the expected min=10,  max=20.',
      'Ghi nhận rowCount=5, kỳ vọng min=10,  max=20.',
    ],
    [
      'Found columnCount=1 column vs. the expected min=2 and max=5',
      'Ghi nhận columnCount=1 cột, kỳ vọng min=2 và max=5.',
    ],
    [
      'Found valuesCount=10 vs. uniqueCount=8. Both counts should be equal for column values to be unique.',
      'Ghi nhận valuesCount=10 so với uniqueCount=8; hai số này phải bằng nhau để các giá trị trong cột là duy nhất.',
    ],
    [
      'Found 4 row(s). Test query is expected to return >= 5 row(s).',
      'Truy vấn trả về 4 dòng, kỳ vọng >= 5 dòng.',
    ],
    ['Found 2 different rows.', 'Có 2 dòng khác biệt.'],
    [
      'Dimension region=EU: Found nullCount=2. It should be 0',
      'Chiều region=EU: Ghi nhận nullCount=2, kỳ vọng bằng 0.',
    ],
  ])('translates %s', (message, expected) => {
    expect(localizeDqMessage(t, message)).toBe(expected);
  });

  it('counts the rows the pass rate is based on', () => {
    expect(
      localizeDqMessage(
        t,
        'Found 17 value(s) matching regex pattern vs 20 value(s) in the column.',
        { passedRows: 17, totalRows: 40 }
      )
    ).toBe('Có 17 giá trị khớp biểu thức chính quy trên tổng 40 giá trị của cột.');
  });

  it('keeps a message it does not know', () => {
    expect(localizeDqMessage(t, 'ERROR: connection lost')).toBe(
      'ERROR: connection lost'
    );
  });
});
