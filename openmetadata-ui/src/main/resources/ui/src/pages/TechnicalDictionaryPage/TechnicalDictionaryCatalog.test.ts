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
import { resolveTechnicalCatalog } from './TechnicalDictionaryCatalog';

const published = [
  { businessVersion: '1', entityStatus: 'Archived' },
  { businessVersion: '2', entityStatus: 'Approved' },
];

describe('resolveTechnicalCatalog', () => {
  it('prefers the working version by default', () => {
    const { catalog, versions } = resolveTechnicalCatalog({
      published,
      working: {
        businessVersion: '3',
        entityStatus: 'Draft',
        workingRevision: 4,
      },
    });

    expect(versions).toEqual(['3', '2', '1']);
    expect(catalog).toEqual({
      businessVersion: '3',
      status: 'Draft',
      workingRevision: 4,
      isWorking: true,
      isReadOnly: false,
    });
  });

  it('falls back to the newest active published version', () => {
    const { catalog } = resolveTechnicalCatalog({ published });

    expect(catalog?.businessVersion).toBe('2');
    expect(catalog?.isWorking).toBe(false);
    expect(catalog?.status).toBe('Approved');
  });

  it('honours an explicit historical version as read-only', () => {
    const { catalog } = resolveTechnicalCatalog({
      published,
      requested: '1',
      working: { businessVersion: '3', entityStatus: 'Draft' },
    });

    expect(catalog?.businessVersion).toBe('1');
    expect(catalog?.isReadOnly).toBe(true);
  });

  it('does not fall back when the requested version does not exist', () => {
    const { catalog, versions } = resolveTechnicalCatalog({
      published,
      requested: '9',
    });

    expect(catalog).toBeUndefined();
    expect(versions).toEqual(['2', '1']);
  });

  it('sorts versions numerically, not lexically', () => {
    const { versions } = resolveTechnicalCatalog({
      published: [
        { businessVersion: '2', entityStatus: 'Archived' },
        { businessVersion: '10', entityStatus: 'Approved' },
      ],
    });

    expect(versions).toEqual(['10', '2']);
  });

  it('returns no catalog when nothing exists', () => {
    expect(resolveTechnicalCatalog({ published: [] })).toEqual({
      versions: [],
    });
  });
});
