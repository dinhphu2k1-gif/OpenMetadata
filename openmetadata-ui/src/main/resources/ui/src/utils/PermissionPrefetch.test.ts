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

import { getLoggedInUserPermissions } from '../rest/permissionAPI';
import {
  clearPrefetchedPermissions,
  consumePrefetchedPermissions,
  prefetchLoggedInUserPermissions,
} from './PermissionPrefetch';

jest.mock('../rest/permissionAPI', () => ({
  getLoggedInUserPermissions: jest.fn().mockResolvedValue({ data: [] }),
}));

const mockGetLoggedInUserPermissions =
  getLoggedInUserPermissions as jest.MockedFunction<
    typeof getLoggedInUserPermissions
  >;

describe('PermissionPrefetch', () => {
  beforeEach(() => {
    clearPrefetchedPermissions();
    jest.clearAllMocks();
  });

  it('deduplicates prefetch and consumes the promise once', () => {
    const firstPromise = prefetchLoggedInUserPermissions();
    const secondPromise = prefetchLoggedInUserPermissions();

    expect(firstPromise).toBe(secondPromise);
    expect(mockGetLoggedInUserPermissions).toHaveBeenCalledTimes(1);
    expect(consumePrefetchedPermissions()).toBe(firstPromise);
    expect(consumePrefetchedPermissions()).toBeUndefined();
  });

  it('clears a prefetched promise', () => {
    prefetchLoggedInUserPermissions();
    clearPrefetchedPermissions();

    expect(consumePrefetchedPermissions()).toBeUndefined();
  });
});
