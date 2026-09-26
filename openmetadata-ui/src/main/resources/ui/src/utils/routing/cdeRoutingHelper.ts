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

import { PLACEHOLDER_ROUTE_FQN, ROUTES } from '../../constants/constants';
import { getEncodedFqn } from '../StringUtils';

export const CDE_DETAIL_ROUTE_PATTERN = ROUTES.GLOSSARY_DETAILS;
export const CDE_DETAIL_RELATIVE_ROUTE_PATTERN =
  CDE_DETAIL_ROUTE_PATTERN.replace(ROUTES.GLOSSARY, '');

export const CDE_ROUTE_QUERY = {
  businessVersion: 'businessVersion',
  parentBusinessVersion: 'parentBusinessVersion',
  termId: 'termId',
  view: 'view',
} as const;

export const CDE_WORKING_VIEW = 'working';

export interface CdeRouteParams {
  fqn: string;
  businessVersion: string;
  parentBusinessVersion: string;
  termId?: string;
  isWorkingDraft?: boolean;
}

export interface CdeRouteLocation {
  pathname?: string;
  search?: string;
  /** The decoded value returned by useParams/useFqn takes precedence. */
  fqn?: string;
}

export interface ParsedCdeRoute {
  fqn?: string;
  businessVersion?: string;
  parentBusinessVersion?: string;
  termId?: string;
  isWorkingDraft: boolean;
  isValid: boolean;
  errors: string[];
}

const nonEmpty = (value: string | null | undefined) =>
  value?.trim() || undefined;

/**
 * Data Dictionary versions are integer scopes on the backend. Older UI
 * payloads can still expose the same scope as `1.0`, so normalize that legacy
 * representation before it is used in a route or an API request.
 */
export const normalizeCdeParentBusinessVersion = (
  value: string | null | undefined
): string | undefined => {
  const normalized = nonEmpty(value);
  if (!normalized) {
    return undefined;
  }

  const legacyDictionaryVersion = normalized.match(/^([1-9]\d*)\.0+$/);

  return legacyDictionaryVersion?.[1] ?? normalized;
};

/** Return the technical FQN of a CDE identity inside one Dictionary scope. */
export const getScopedCdeFqn = (
  fqn: string,
  parentBusinessVersion: string
): string => {
  const normalizedParentVersion = normalizeCdeParentBusinessVersion(
    parentBusinessVersion
  );
  if (!normalizedParentVersion) {
    throw new Error('parentBusinessVersion is required for a scoped CDE FQN');
  }

  return `${fqn.trim().replace(/@v[1-9]\d*$/, '')}@v${normalizedParentVersion}`;
};

const getFqnFromPathname = (pathname?: string) => {
  if (!pathname) {
    return undefined;
  }

  const glossaryPrefix = `${ROUTES.GLOSSARY}/`;
  if (!pathname.startsWith(glossaryPrefix)) {
    return undefined;
  }

  const encodedFqn = pathname.slice(glossaryPrefix.length).split('/')[0];
  if (!encodedFqn) {
    return undefined;
  }

  try {
    return decodeURIComponent(encodedFqn);
  } catch {
    return undefined;
  }
};

/** Build the canonical URL for a CDE term detail/working-draft page. */
export const getCdeDetailPath = ({
  fqn,
  businessVersion,
  parentBusinessVersion,
  termId,
  isWorkingDraft = false,
}: CdeRouteParams): string => {
  const normalizedFqn = nonEmpty(fqn);
  const normalizedBusinessVersion = nonEmpty(businessVersion);
  const normalizedParentVersion = normalizeCdeParentBusinessVersion(
    parentBusinessVersion
  );

  if (!normalizedFqn) {
    throw new Error('CDE fqn is required');
  }
  if (!normalizedBusinessVersion) {
    throw new Error('businessVersion is required for a CDE route');
  }
  if (!normalizedParentVersion) {
    throw new Error('parentBusinessVersion is required for a CDE route');
  }

  const pathname = CDE_DETAIL_ROUTE_PATTERN.replace(
    PLACEHOLDER_ROUTE_FQN,
    getEncodedFqn(normalizedFqn)
  );
  const search = new URLSearchParams();
  search.set(CDE_ROUTE_QUERY.businessVersion, normalizedBusinessVersion);
  search.set(CDE_ROUTE_QUERY.parentBusinessVersion, normalizedParentVersion);
  const normalizedTermId = nonEmpty(termId);
  if (normalizedTermId) {
    search.set(CDE_ROUTE_QUERY.termId, normalizedTermId);
  }
  if (isWorkingDraft) {
    search.set(CDE_ROUTE_QUERY.view, CDE_WORKING_VIEW);
  }

  return `${pathname}?${search.toString()}`;
};

/** @deprecated Prefer getCdeDetailPath for navigation. */
export const getCreatedDraftSearch = (
  currentSearch: string,
  businessVersion: string
): string => {
  const searchParams = new URLSearchParams(currentSearch);
  searchParams.set(CDE_ROUTE_QUERY.businessVersion, businessVersion);

  return searchParams.toString();
};

/** Parse and validate CDE route state from useLocation plus useParams/useFqn. */
export const parseCdeRoute = ({
  pathname,
  search = '',
  fqn,
}: CdeRouteLocation): ParsedCdeRoute => {
  const searchParams = new URLSearchParams(search);
  const parsedFqn = nonEmpty(fqn) ?? nonEmpty(getFqnFromPathname(pathname));
  const businessVersion = nonEmpty(
    searchParams.get(CDE_ROUTE_QUERY.businessVersion)
  );
  const parentBusinessVersion = normalizeCdeParentBusinessVersion(
    searchParams.get(CDE_ROUTE_QUERY.parentBusinessVersion)
  );
  const view = nonEmpty(searchParams.get(CDE_ROUTE_QUERY.view));
  const termId = nonEmpty(searchParams.get(CDE_ROUTE_QUERY.termId));
  const errors: string[] = [];

  if (!parsedFqn) {
    errors.push('CDE fqn is required');
  }
  if (!businessVersion) {
    errors.push('businessVersion is required');
  }
  if (!parentBusinessVersion) {
    errors.push('parentBusinessVersion is required');
  }
  if (view && view !== CDE_WORKING_VIEW) {
    errors.push(`Unsupported CDE view: ${view}`);
  }

  return {
    fqn: parsedFqn,
    businessVersion,
    parentBusinessVersion,
    termId,
    isWorkingDraft: view === CDE_WORKING_VIEW,
    isValid: errors.length === 0,
    errors,
  };
};
