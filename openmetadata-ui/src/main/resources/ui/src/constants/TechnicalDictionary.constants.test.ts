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
  TECHNICAL_DICTIONARY_COLUMN_PREFERENCE_KEY,
  TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS,
  TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS,
} from './TechnicalDictionary.constants';

describe('TechnicalDictionary constants', () => {
  it('uses a preference key that drops the layout of the versioned dictionary', () => {
    expect(TECHNICAL_DICTIONARY_COLUMN_PREFERENCE_KEY).toBe(
      'technicalDictionary.v6'
    );
  });

  it('lists the field first and its status last, with the dictionary fields in between', () => {
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS).toHaveLength(13);
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS[0]).toBe(
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.FIELD_NAME
    );
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS.slice(-1)).toEqual([
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.STATUS,
    ]);
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS).toContain(
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SYSTEM_OWNER
    );
  });

  it('keeps the update columns optional and hidden by default', () => {
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS).not.toContain(
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.UPDATED_AT
    );
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS).not.toContain(
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.UPDATED_BY
    );
  });

  it('keeps the field and its status always visible', () => {
    expect(TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS).toEqual([
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.FIELD_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.STATUS,
    ]);
  });
});
