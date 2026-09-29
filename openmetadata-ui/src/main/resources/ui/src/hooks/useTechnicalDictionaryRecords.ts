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
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TECHNICAL_DEFAULT_PAGE_SIZE,
  TECHNICAL_PAGE_SIZE_OPTIONS,
  TECHNICAL_SEARCH_DEBOUNCE_MS,
} from '../constants/TechnicalDictionary.constants';
import {
  EMPTY_TECHNICAL_FILTERS,
  TechnicalDictionaryFilters,
  TechnicalDictionaryRow,
} from '../pages/TechnicalDictionaryPage/technicalDictionary.interface';
import { toTechnicalDictionaryRow } from '../pages/TechnicalDictionaryPage/TechnicalDictionaryRows';
import { searchTechnicalRecords } from '../rest/technicalDictionaryAPI';

const LIST_KEYS: Array<keyof TechnicalDictionaryFilters> = [
  'statuses',
  'sourceServices',
  'cdeMapping',
  'cdeTermIds',
  'sourceStatuses',
  'elementType',
  'generationType',
  'creationMethod',
  'timeliness',
  'systemOwnerIds',
];
const PAGE_PARAM = 'page';
const PAGE_SIZE_PARAM = 'pageSize';
const QUERY_PARAM = 'q';
const VERSION_VIEW_PARAM = 'versionView';

const splitList = (value: string | null): string[] =>
  value ? value.split(',').filter(Boolean) : [];

export const parseTechnicalFilters = (
  params: URLSearchParams
): TechnicalDictionaryFilters => {
  const filters: TechnicalDictionaryFilters = {
    ...EMPTY_TECHNICAL_FILTERS,
    q: params.get(QUERY_PARAM) ?? '',
    versionView: params.get(VERSION_VIEW_PARAM) === 'ALL' ? 'ALL' : 'LATEST',
  };
  LIST_KEYS.forEach((key) => {
    (filters[key] as string[]) = splitList(params.get(key));
  });

  return filters;
};

/** Writes only values that differ from the defaults so the URL stays clean. */
export const writeTechnicalFilters = (
  params: URLSearchParams,
  filters: TechnicalDictionaryFilters
): URLSearchParams => {
  const next = new URLSearchParams(params);
  filters.q ? next.set(QUERY_PARAM, filters.q) : next.delete(QUERY_PARAM);
  filters.versionView === 'ALL'
    ? next.set(VERSION_VIEW_PARAM, 'ALL')
    : next.delete(VERSION_VIEW_PARAM);
  LIST_KEYS.forEach((key) => {
    const values = filters[key] as string[];
    values.length > 0 ? next.set(key, values.join(',')) : next.delete(key);
  });

  return next;
};

const parsePositive = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

interface UseRecordsInput {
  glossaryId?: string;
  businessVersion?: string;
}

export const useTechnicalDictionaryRecords = ({
  glossaryId,
  businessVersion,
}: UseRecordsInput) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(
    () => parseTechnicalFilters(searchParams),
    [searchParams]
  );
  const requestedPageSize = parsePositive(
    searchParams.get(PAGE_SIZE_PARAM),
    TECHNICAL_DEFAULT_PAGE_SIZE
  );
  const pageSize = TECHNICAL_PAGE_SIZE_OPTIONS.includes(requestedPageSize)
    ? requestedPageSize
    : TECHNICAL_DEFAULT_PAGE_SIZE;
  const page = parsePositive(searchParams.get(PAGE_PARAM), 1);
  const [rows, setRows] = useState<TechnicalDictionaryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchText, setSearchText] = useState(filters.q);
  const generation = useRef(0);

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => URLSearchParams) =>
      setSearchParams((current) => mutate(new URLSearchParams(current))),
    [setSearchParams]
  );

  const setFilters = useCallback(
    (patch: Partial<TechnicalDictionaryFilters>) =>
      updateParams((params) => {
        const next = writeTechnicalFilters(params, {
          ...parseTechnicalFilters(params),
          ...patch,
        });
        next.delete(PAGE_PARAM);

        return next;
      }),
    [updateParams]
  );

  const setPage = useCallback(
    (nextPage: number) =>
      updateParams((params) => {
        nextPage > 1
          ? params.set(PAGE_PARAM, String(nextPage))
          : params.delete(PAGE_PARAM);

        return params;
      }),
    [updateParams]
  );

  const setPageSize = useCallback(
    (nextSize: number) =>
      updateParams((params) => {
        nextSize === TECHNICAL_DEFAULT_PAGE_SIZE
          ? params.delete(PAGE_SIZE_PARAM)
          : params.set(PAGE_SIZE_PARAM, String(nextSize));
        params.delete(PAGE_PARAM);

        return params;
      }),
    [updateParams]
  );

  const commitSearch = useMemo(
    () =>
      debounce(
        (value: string) => setFilters({ q: value.trim() }),
        TECHNICAL_SEARCH_DEBOUNCE_MS
      ),
    [setFilters]
  );

  useEffect(() => () => commitSearch.cancel(), [commitSearch]);

  const changeSearchText = useCallback(
    (value: string) => {
      setSearchText(value);
      commitSearch(value);
    },
    [commitSearch]
  );

  useEffect(() => {
    if (!glossaryId || !businessVersion) {
      return undefined;
    }
    const current = ++generation.current;
    const controller = new AbortController();
    setIsLoading(true);
    setFailed(false);
    searchTechnicalRecords(
      {
        glossary: glossaryId,
        parentBusinessVersion: businessVersion,
        q: filters.q,
        statuses: filters.statuses,
        sourceServices: filters.sourceServices,
        cdeMapping: filters.cdeMapping,
        cdeTermIds: filters.cdeTermIds,
        systemOwnerIds: filters.systemOwnerIds,
        sourceStatuses: filters.sourceStatuses,
        elementTypes: filters.elementType,
        generationTypes: filters.generationType,
        creationMethods: filters.creationMethod,
        timeliness: filters.timeliness,
        versionView: filters.versionView,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      },
      controller.signal
    )
      .then((response) => {
        if (current === generation.current) {
          setRows(response.data.map(toTechnicalDictionaryRow));
          setTotal(response.paging.total);
        }
      })
      .catch(() => {
        if (current === generation.current && !controller.signal.aborted) {
          setRows([]);
          setTotal(0);
          setFailed(true);
        }
      })
      .finally(() => {
        if (current === generation.current) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [glossaryId, businessVersion, filters, page, pageSize, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return {
    rows,
    total,
    isLoading,
    failed,
    filters,
    page,
    pageSize,
    searchText,
    setSearchText: changeSearchText,
    setFilters,
    setPage,
    setPageSize,
    reload,
  };
};
