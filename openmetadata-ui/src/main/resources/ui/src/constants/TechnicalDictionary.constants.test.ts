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
  it('uses an isolated column preference key', () => {
    expect(TECHNICAL_DICTIONARY_COLUMN_PREFERENCE_KEY).toBe(
      'governedGlossary.TECHNICAL_DICTIONARY.v1'
    );
  });

  it('lists the nineteen business columns in the documented order plus the action column', () => {
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS).toHaveLength(20);
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS.slice(0, 4)).toEqual([
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATABASE_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SCHEMA_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.TABLE_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.COLUMN_NAME,
    ]);
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS.slice(-2)).toEqual([
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.STATUS,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.ACTIONS,
    ]);
  });

  it('keeps the four source columns, version, release type and status always visible', () => {
    expect(TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS).toEqual(
      expect.arrayContaining([
        TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.COLUMN_NAME,
        TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.STATUS,
      ])
    );
  });
});
