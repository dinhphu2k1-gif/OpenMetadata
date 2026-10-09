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
  formatApprovedRecordValue,
  isLongTextApprovedRecordField,
} from './ApprovedRecordHistoryUtils';

jest.mock('./i18next/LocalUtil', () => ({
  t: (key: string) =>
    (({ 'label.yes': 'Có', 'label.no': 'Không' } as Record<string, string>)[
      key
    ] ?? key),
}));

describe('formatApprovedRecordValue', () => {
  it.each([
    ['Y', 'Có'],
    ['N', 'Không'],
  ])('formats the data quality value %s', (value, expected) => {
    expect(formatApprovedRecordValue('extension.dataQualityRules', value)).toBe(
      expected
    );
  });

  it('joins values from a JSON array', () => {
    expect(formatApprovedRecordValue('rank', '["a","b"]')).toBe('a, b');
  });

  it.each([undefined, null, '', '  '])(
    'returns undefined for an empty value',
    (value) => {
      expect(formatApprovedRecordValue('rank', value)).toBeUndefined();
    }
  );
});

describe('isLongTextApprovedRecordField', () => {
  it.each([
    'description',
    'extension.entityRelationship',
    'extension.relatedRegulatoryDocuments',
    'extension.ruleExplanation',
    'extension.otherConstraints',
  ])('returns true for %s', (field) => {
    expect(isLongTextApprovedRecordField(field)).toBe(true);
  });

  it('returns false for a short field', () => {
    expect(isLongTextApprovedRecordField('rank')).toBe(false);
  });
});
