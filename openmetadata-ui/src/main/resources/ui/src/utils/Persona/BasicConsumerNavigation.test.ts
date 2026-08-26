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

import { ROUTES } from '../../constants/constants';
import {
  hideBasicConsumerMarketplaceOverview,
  isBasicConsumerPersona,
} from './BasicConsumerNavigation';

describe('BasicConsumerNavigation', () => {
  it('recognizes the Basic Consumer and standard restricted personas by name or FQN', () => {
    expect(isBasicConsumerPersona({ name: 'BasicConsumerPersona' })).toBe(true);
    expect(isBasicConsumerPersona({ name: 'DataConsumerPersona' })).toBe(true);
    expect(isBasicConsumerPersona({ name: 'DataProposerPersona' })).toBe(true);
    expect(isBasicConsumerPersona({ name: 'DataStewardPersona' })).toBe(true);
    expect(
      isBasicConsumerPersona({
        fullyQualifiedName: 'persona.BasicConsumerPersona',
      })
    ).toBe(true);
    expect(
      isBasicConsumerPersona({
        fullyQualifiedName: 'persona.DataConsumerPersona',
      })
    ).toBe(true);
    expect(isBasicConsumerPersona({ name: 'GeneralUser' })).toBe(false);
  });

  it('hides only the marketplace overview child', () => {
    const items = [
      {
        key: ROUTES.DATA_MARKETPLACE_SECTION,
        title: 'label.data-marketplace-section',
        icon: 'svg-mock' as unknown as SvgComponent,
        dataTestId: 'data-marketplace-section',
        children: [
          {
            key: ROUTES.DATA_MARKETPLACE,
            title: 'label.overview',
            icon: 'svg-mock' as unknown as SvgComponent,
            dataTestId: 'data-marketplace',
          },
          {
            key: ROUTES.DOMAIN,
            title: 'label.domain-plural',
            icon: 'svg-mock' as unknown as SvgComponent,
            dataTestId: 'domain',
          },
        ],
      },
    ];

    const result = hideBasicConsumerMarketplaceOverview(items);

    expect(result[0].children?.map((child) => child.key)).toEqual([
      ROUTES.DOMAIN,
    ]);
  });
});
