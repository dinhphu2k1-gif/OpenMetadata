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
  parseTechnicalFilters,
  writeTechnicalFilters,
} from './useTechnicalDictionaryRecords';

describe('technical dictionary URL filters', () => {
  it('hides deleted records unless the URL asks for them', () => {
    expect(parseTechnicalFilters(new URLSearchParams('')).showDeleted).toBe(
      false
    );
    expect(
      parseTechnicalFilters(new URLSearchParams('showDeleted=true')).showDeleted
    ).toBe(true);
  });

  it('writes showDeleted only while it is on', () => {
    const on = writeTechnicalFilters(new URLSearchParams('page=2'), {
      ...parseTechnicalFilters(new URLSearchParams('')),
      showDeleted: true,
    });
    const off = writeTechnicalFilters(on, {
      ...parseTechnicalFilters(on),
      showDeleted: false,
    });

    expect(on.get('showDeleted')).toBe('true');
    expect(off.has('showDeleted')).toBe(false);
  });
});
