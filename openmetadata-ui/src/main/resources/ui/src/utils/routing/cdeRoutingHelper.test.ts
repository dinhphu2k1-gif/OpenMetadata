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

import { getCdeDetailPath, parseCdeRoute } from './cdeRoutingHelper';

describe('cdeRoutingHelper', () => {
  it('builds a canonical working CDE URL and preserves FQN dots', () => {
    expect(
      getCdeDetailPath({
        fqn: 'Data Dictionary.Nhóm/Alo 1',
        businessVersion: '1.1',
        parentBusinessVersion: '2.0',
        isWorkingDraft: true,
      })
    ).toBe(
      '/glossary/Data%20Dictionary.Nh%C3%B3m%2FAlo%201?businessVersion=1.1&parentBusinessVersion=2&view=working'
    );
  });

  it('keeps scoped CDE identities distinct in the route', () => {
    expect(
      getCdeDetailPath({
        fqn: 'Data Dictionary.alo1@v2',
        businessVersion: '2.0',
        parentBusinessVersion: '2',
        isWorkingDraft: true,
      })
    ).toBe(
      '/glossary/Data%20Dictionary.alo1%40v2?businessVersion=2.0&parentBusinessVersion=2&view=working'
    );
  });

  it('parses the same route contract from location', () => {
    expect(
      parseCdeRoute({
        pathname: '/glossary/Data%20Dictionary.alo1',
        search:
          '?businessVersion=1.1&parentBusinessVersion=2.0&view=working',
      })
    ).toEqual({
      fqn: 'Data Dictionary.alo1',
      businessVersion: '1.1',
      parentBusinessVersion: '2',
      isWorkingDraft: true,
      isValid: true,
      errors: [],
    });
  });

  it('reports incomplete CDE routes without throwing', () => {
    const parsed = parseCdeRoute({
      pathname: '/glossary/Data%20Dictionary.alo1',
      search: '?businessVersion=1.0',
    });

    expect(parsed.isValid).toBe(false);
    expect(parsed.errors).toContain('parentBusinessVersion is required');
  });
});
