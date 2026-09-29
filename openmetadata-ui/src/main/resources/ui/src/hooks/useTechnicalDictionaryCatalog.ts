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
import { useSearchParams } from 'react-router-dom';
import { TECHNICAL_DICTIONARY_GLOSSARY_NAME } from '../constants/Glossary.contant';
import { Glossary } from '../generated/entity/data/glossary';
import {
  getGlossariesByName,
  getGlossaryVersionPermissions,
  getGlossaryWorkingVersion,
  getPublishedGlossaryVersions,
} from '../rest/glossaryAPI';
import {
  TechnicalCatalogState,
  TechnicalDictionaryCapabilities,
} from '../pages/TechnicalDictionaryPage/technicalDictionary.interface';
import { resolveTechnicalCatalog } from '../pages/TechnicalDictionaryPage/TechnicalDictionaryCatalog';

export const BUSINESS_VERSION_PARAM = 'businessVersion';

export type TechnicalCatalogError = 'notFound' | 'forbidden' | 'failed';

const NO_CAPABILITIES: TechnicalDictionaryCapabilities = {
  canViewWorking: false,
  canEditWorking: false,
  canSubmit: false,
  canApprove: false,
  canReject: false,
  canCreateVersion: false,
  canArchive: false,
};

export interface TechnicalCatalogResult {
  glossary?: Glossary;
  catalog?: TechnicalCatalogState;
  versions: string[];
  capabilities: TechnicalDictionaryCapabilities;
  isLoading: boolean;
  error?: TechnicalCatalogError;
  selectVersion: (businessVersion: string) => void;
  reload: () => Promise<void>;
}

const toError = (error: unknown): TechnicalCatalogError => {
  const status = (error as AxiosError | undefined)?.response?.status;

  return status === 403 ? 'forbidden' : status === 404 ? 'notFound' : 'failed';
};

/**
 * Resolves the Technical Dictionary glossary, the catalog versions the user may
 * see and the selected version. The default version is never written to the URL.
 */
export const useTechnicalDictionaryCatalog = (): TechnicalCatalogResult => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(BUSINESS_VERSION_PARAM);
  const [glossary, setGlossary] = useState<Glossary>();
  const [versions, setVersions] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<TechnicalCatalogState>();
  const [capabilities, setCapabilities] = useState(NO_CAPABILITIES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<TechnicalCatalogError>();

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const loaded = await getGlossariesByName(
        TECHNICAL_DICTIONARY_GLOSSARY_NAME
      );
      const [permissions, published] = await Promise.all([
        getGlossaryVersionPermissions(loaded.id).catch(() => undefined),
        getPublishedGlossaryVersions(loaded.id).catch(() => [] as Glossary[]),
      ]);
      const working = permissions?.canViewWorking
        ? await getGlossaryWorkingVersion(loaded.id).catch(() => undefined)
        : undefined;
      const resolved = resolveTechnicalCatalog({
        requested,
        working,
        published,
      });
      setGlossary(loaded);
      setVersions(resolved.versions);
      setCatalog(resolved.catalog);
      setCapabilities({ ...NO_CAPABILITIES, ...permissions });
      setError(resolved.catalog ? undefined : 'notFound');
    } catch (failure) {
      setError(toError(failure));
    } finally {
      setIsLoading(false);
    }
  }, [requested]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selectVersion = useCallback(
    (businessVersion: string) => {
      const next = new URLSearchParams(searchParams);
      next.set(BUSINESS_VERSION_PARAM, businessVersion);
      next.delete('page');
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  return useMemo(
    () => ({
      glossary,
      catalog,
      versions,
      capabilities,
      isLoading,
      error,
      selectVersion,
      reload,
    }),
    [
      glossary,
      catalog,
      versions,
      capabilities,
      isLoading,
      error,
      selectVersion,
      reload,
    ]
  );
};
