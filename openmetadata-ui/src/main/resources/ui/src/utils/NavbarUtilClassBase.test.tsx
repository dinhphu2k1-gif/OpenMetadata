/*
 *  Copyright 2024 Collate.
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

import { ROUTES } from '../constants/constants';
import navbarUtilClassBase from './NavbarUtilClassBase';

describe('NavbarUtilClassBase', () => {
  it('should expose only the internal API helper', () => {
    const result = navbarUtilClassBase.getHelpItems();
    const stringifyResult = JSON.stringify(result);

    expect(result).toHaveLength(1);
    expect(stringifyResult).toContain(ROUTES.SWAGGER);
    expect(stringifyResult).toContain('label.api-uppercase');
  });
});
