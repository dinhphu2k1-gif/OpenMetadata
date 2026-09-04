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

import { LeftSidebarItem } from '../../components/MyData/LeftSidebar/LeftSidebar.interface';
import { ROUTES } from '../../constants/constants';
import { EntityReference } from '../../generated/entity/type';

export const BASIC_CONSUMER_PERSONA_NAME = 'BasicConsumerPersona';

export const RESTRICTED_PERSONA_NAMES = new Set([
  BASIC_CONSUMER_PERSONA_NAME,
]);

export const isBasicConsumerPersona = (
  persona?: Pick<EntityReference, 'name' | 'fullyQualifiedName'>
): boolean =>
  [persona?.name, persona?.fullyQualifiedName]
    .filter((value): value is string => Boolean(value))
    .some((value) => {
      const personaName = value.split('.').at(-1);
      return personaName ? RESTRICTED_PERSONA_NAMES.has(personaName) : false;
    });

export const hideBasicConsumerMarketplaceOverview = (
  items: LeftSidebarItem[]
): LeftSidebarItem[] =>
  items.map((item) => {
    if (item.key === 'governance') {
      return {
        ...item,
        children: item.children?.filter(
          (child) => child.key !== ROUTES.TECHNICAL_DICTIONARY
        ),
      };
    }
    if (item.key === ROUTES.DATA_MARKETPLACE_SECTION) {
      return {
        ...item,
        children: item.children?.filter(
          (child) => child.key !== ROUTES.DATA_MARKETPLACE
        ),
      };
    }

    return item;
  });
