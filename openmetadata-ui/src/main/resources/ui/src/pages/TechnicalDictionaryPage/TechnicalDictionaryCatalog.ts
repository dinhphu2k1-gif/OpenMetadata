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
import { uniq } from 'lodash';
import { compareBusinessVersions } from '../../utils/BusinessVersionUtils';
import { TechnicalCatalogState } from './technicalDictionary.interface';

interface CatalogVersion {
  businessVersion?: string;
  entityStatus?: string;
  workingRevision?: number;
}

interface ResolveCatalogInput {
  requested?: string | null;
  working?: CatalogVersion;
  published: CatalogVersion[];
}

export interface ResolvedCatalog {
  versions: string[];
  catalog?: TechnicalCatalogState;
}

const ARCHIVED = 'Archived';

/**
 * Picks the catalog version to show: an explicit request wins, otherwise the
 * working version (when the user can see one), otherwise the newest active
 * published version. An unknown explicit version resolves to no catalog so the
 * caller can show "not found" instead of silently falling back.
 */
export const resolveTechnicalCatalog = ({
  requested,
  working,
  published,
}: ResolveCatalogInput): ResolvedCatalog => {
  const versions = uniq(
    [
      working?.businessVersion,
      ...published.map((item) => item.businessVersion),
    ].filter((version): version is string => Boolean(version))
  ).sort((left, right) => compareBusinessVersions(right, left));
  const newestActive = published
    .filter((item) => item.entityStatus !== ARCHIVED && item.businessVersion)
    .sort((left, right) =>
      compareBusinessVersions(
        right.businessVersion as string,
        left.businessVersion as string
      )
    )[0];
  const selected =
    requested ??
    working?.businessVersion ??
    newestActive?.businessVersion ??
    versions[0];

  if (!selected || !versions.includes(selected)) {
    return { versions };
  }
  const isWorking = working?.businessVersion === selected;
  const source = isWorking
    ? working
    : published.find((item) => item.businessVersion === selected);
  const status = source?.entityStatus ?? 'Approved';

  return {
    versions,
    catalog: {
      businessVersion: selected,
      status,
      workingRevision: isWorking ? working?.workingRevision : undefined,
      isWorking,
      isReadOnly: status === ARCHIVED,
    },
  };
};
