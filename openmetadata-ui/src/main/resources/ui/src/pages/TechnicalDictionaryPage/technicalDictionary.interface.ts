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
import {
  TechnicalCapabilities,
  TechnicalNamedReference,
  TechnicalSourceStatus,
  TechnicalTagValue,
} from '../../rest/technicalDictionaryAPI';

/** One declared Column, shaped for the table and modal. */
export interface TechnicalDictionaryRow {
  key: string;
  termId: string;
  revision: number;
  databaseName: string;
  databaseFqn?: string;
  schemaName: string;
  schemaFqn?: string;
  tableName: string;
  tableFqn?: string;
  columnName: string;
  columnFqn: string;
  serviceName: string;
  dataType: string;
  description: string;
  rank?: number;
  cdeCode: string;
  cdeName: string;
  cdeTermId?: string;
  dataOwners: TechnicalNamedReference[];
  elementType?: TechnicalTagValue;
  generationType?: TechnicalTagValue;
  creationMethod?: TechnicalTagValue;
  timeliness?: TechnicalTagValue;
  systemOwner?: TechnicalNamedReference;
  sourceStatus: TechnicalSourceStatus;
  updatedAt?: number;
  updatedBy?: string;
}

/** Filters that are reflected in the URL and sent to the server. */
export interface TechnicalDictionaryFilters {
  q: string;
  sourceServices: string[];
  cdeTermIds: string[];
  elementType: string[];
  generationType: string[];
  creationMethod: string[];
  timeliness: string[];
}

export const EMPTY_TECHNICAL_FILTERS: TechnicalDictionaryFilters = {
  q: '',
  sourceServices: [],
  cdeTermIds: [],
  elementType: [],
  generationType: [],
  creationMethod: [],
  timeliness: [],
};

/** What the signed-in user may do; the backend remains the authority. */
export type TechnicalDictionaryCapabilities = TechnicalCapabilities;

export const NO_TECHNICAL_CAPABILITIES: TechnicalDictionaryCapabilities = {
  canView: false,
  canEdit: false,
  canImport: false,
  canExport: false,
};
