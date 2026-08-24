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

import { APPLICATION_BRAND_NAME, rebrandLocaleResources } from './BrandUtils';

describe('BrandUtils', () => {
  it('rebrands strings at every level of a locale resource', () => {
    const resources = {
      title: 'Welcome to OpenMetadata',
      nested: {
        items: ['OpenMetadata API', '{{brandName}} documentation'],
      },
    };

    expect(rebrandLocaleResources(resources)).toEqual({
      title: `Welcome to ${APPLICATION_BRAND_NAME}`,
      nested: {
        items: [`${APPLICATION_BRAND_NAME} API`, '{{brandName}} documentation'],
      },
    });
  });
});
