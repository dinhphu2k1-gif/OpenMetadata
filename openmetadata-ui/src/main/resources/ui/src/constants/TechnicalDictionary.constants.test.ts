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
      'technicalDictionary.v2'
    );
  });

  it('lists the fourteen fields in the documented order plus the action column', () => {
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS).toHaveLength(15);
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS.slice(0, 4)).toEqual([
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATABASE_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SCHEMA_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.TABLE_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.COLUMN_NAME,
    ]);
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS.slice(-2)).toEqual([
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DESCRIPTION,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.ACTIONS,
    ]);
  });

  it('keeps the update columns optional and hidden by default', () => {
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS).not.toContain(
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.UPDATED_AT
    );
    expect(TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS).not.toContain(
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.UPDATED_BY
    );
  });

  it('keeps the four source columns and the actions always visible', () => {
    expect(TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS).toEqual([
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.DATABASE_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.SCHEMA_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.TABLE_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.COLUMN_NAME,
      TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS.ACTIONS,
    ]);
  });
});
