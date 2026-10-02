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

import { ROUTES } from './constants';
import { PORTAL_SIDEBAR_LIST } from './LeftSidebar.constants';

describe('PORTAL_SIDEBAR_LIST', () => {
  it('shows the Basic Consumer menu', () => {
    const menu = PORTAL_SIDEBAR_LIST.map((item) => ({
      key: item.key,
      children: item.children?.map((child) => child.key),
    }));

    expect(menu).toEqual([
      { key: ROUTES.MY_DATA, children: undefined },
      { key: ROUTES.EXPLORE, children: undefined },
      { key: ROUTES.DATA_MARKETPLACE_SECTION, children: [ROUTES.DOMAIN] },
      { key: 'governance', children: [ROUTES.DATA_DICTIONARY] },
    ]);
  });
});
