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

import { useEffect, useState } from 'react';
import { DQTestConfig } from '../components/Glossary/DQRuleTests/DQRuleTests.interface';
import { getDqTestConfig } from '../rest/dqRuleTestAPI';

let cachedConfig: Promise<DQTestConfig> | undefined;

export const resetDqTestConfigCache = () => {
  cachedConfig = undefined;
};

/** Capabilities of the caller on Data Quality Rule test execution, read once per session. */
export const useDqTestConfig = () => {
  const [config, setConfig] = useState<DQTestConfig>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    cachedConfig = cachedConfig ?? getDqTestConfig();
    cachedConfig
      .then((response) => active && setConfig(response))
      .catch(() => {
        resetDqTestConfigCache();
        active && setConfig(undefined);
      })
      .finally(() => active && setIsLoading(false));

    return () => {
      active = false;
    };
  }, []);

  return { config, isLoading };
};
