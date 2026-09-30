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
  EntityReference,
  TagLabel,
  TermRelation,
} from '../../generated/entity/data/glossaryTerm';
import {
  TechnicalRecordType,
  TechnicalSourceStatus,
} from '../../rest/technicalDictionaryAPI';

/** One Technical Dictionary record representation, shaped for the table and modal. */
export interface TechnicalDictionaryRow {
  key: string;
  termId: string;
  businessVersion: string;
  parentBusinessVersion: string;
  status: string;
  recordType: TechnicalRecordType;
  workingRevision?: number;
  hasPublished: boolean;
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
  cdeRelation?: TermRelation;
  dataOwners: EntityReference[];
  elementType?: TagLabel;
  generationType?: TagLabel;
  creationMethod?: TagLabel;
  timeliness?: TagLabel;
  systemOwner?: EntityReference;
  releaseVersionType: string;
  sourceStatus: TechnicalSourceStatus;
}

/** Filters that are reflected in the URL and sent to the server. */
export interface TechnicalDictionaryFilters {
  q: string;
  statuses: string[];
  sourceServices: string[];
  cdeMapping: string[];
  cdeTermIds: string[];
  sourceStatuses: string[];
  elementType: string[];
  generationType: string[];
  creationMethod: string[];
  timeliness: string[];
  systemOwnerIds: string[];
}

export const EMPTY_TECHNICAL_FILTERS: TechnicalDictionaryFilters = {
  q: '',
  statuses: [],
  sourceServices: [],
  cdeMapping: [],
  cdeTermIds: [],
  sourceStatuses: [],
  elementType: [],
  generationType: [],
  creationMethod: [],
  timeliness: [],
  systemOwnerIds: [],
};

/** What the signed-in user may do; the backend remains the authority. */
export interface TechnicalDictionaryCapabilities {
  canViewWorking: boolean;
  canEditWorking: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canCreateVersion: boolean;
  canArchive: boolean;
}

export interface TechnicalCatalogState {
  businessVersion: string;
  status: string;
  workingRevision?: number;
  isWorking: boolean;
  isReadOnly: boolean;
}
