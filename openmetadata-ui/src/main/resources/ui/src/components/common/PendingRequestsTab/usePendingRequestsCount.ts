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
import { useCallback, useEffect, useState } from 'react';
import { PendingRequestsAdapter } from './PendingRequestsTab.interface';

/**
 * Number of pending requests, for the tab label. It is read before the tab is opened, so the
 * approver sees how much is waiting without visiting it.
 */
export const usePendingRequestsCount = (
  adapter: PendingRequestsAdapter,
  enabled: boolean,
  refreshKey?: number | string
) => {
  const [count, setCount] = useState<number>();

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCount(undefined);

      return;
    }
    try {
      const { total } = await adapter.fetchRequests({ page: 1, pageSize: 10 });
      setCount(total);
    } catch {
      setCount(undefined);
    }
  }, [adapter, enabled]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  return { count, refresh };
};
