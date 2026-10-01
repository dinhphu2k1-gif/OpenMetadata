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
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  NO_TECHNICAL_CAPABILITIES,
  TechnicalDictionaryCapabilities,
} from '../pages/TechnicalDictionaryPage/technicalDictionary.interface';
import {
  getTechnicalContext,
  TechnicalContext,
} from '../rest/technicalDictionaryAPI';

export type TechnicalContextError = 'forbidden' | 'failed';

export interface TechnicalContextResult {
  context?: TechnicalContext;
  /** Data Dictionary version the dictionary is bound to; undefined until one is approved. */
  dataDictionaryVersion?: string;
  capabilities: TechnicalDictionaryCapabilities;
  isLoading: boolean;
  error?: TechnicalContextError;
  reload: () => Promise<void>;
}

const toError = (error: unknown): TechnicalContextError =>
  (error as AxiosError | undefined)?.response?.status === 403
    ? 'forbidden'
    : 'failed';

/** The Data Dictionary version the Technical Dictionary follows, and what the user may do. */
export const useTechnicalDictionaryContext = (): TechnicalContextResult => {
  const [context, setContext] = useState<TechnicalContext>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TechnicalContextError>();

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      setContext(await getTechnicalContext());
    } catch (failure) {
      setError(toError(failure));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return useMemo(
    () => ({
      context,
      dataDictionaryVersion: context?.dataDictionaryVersion ?? undefined,
      capabilities: context?.capabilities ?? NO_TECHNICAL_CAPABILITIES,
      isLoading,
      error,
      reload,
    }),
    [context, isLoading, error, reload]
  );
};
