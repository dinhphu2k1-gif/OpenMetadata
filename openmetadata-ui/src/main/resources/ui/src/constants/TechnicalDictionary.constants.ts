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

export const TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS = {
  DATABASE_NAME: 'databaseName',
  SCHEMA_NAME: 'schemaName',
  TABLE_NAME: 'tableName',
  COLUMN_NAME: 'columnName',
  DATA_OWNERS: 'dataOwners',
  SERVICE_NAME: 'serviceName',
  STATUS: 'status',
  CDE_CODE: 'cdeCode',
  CDE_NAME: 'cdeName',
  SURVIVORSHIP_RANK: 'rank',
  DATA_TYPE: 'dataType',
  ELEMENT_TYPE: 'elementType',
  GENERATION_TYPE: 'generationType',
  CREATION_METHOD: 'creationMethod',
  TIMELINESS: 'timeliness',
  SYSTEM_OWNER: 'systemOwner',
  DESCRIPTION: 'description',
  UPDATED_AT: 'updatedAt',
  UPDATED_BY: 'updatedBy',
  ACTIONS: 'actions',
};

const KEYS = TECHNICAL_DICTIONARY_TABLE_COLUMNS_KEYS;

/** Default dictionary fields in display order; update metadata columns remain optional. */
export const TECHNICAL_DICTIONARY_DEFAULT_VISIBLE_COLUMNS = [
  KEYS.DATABASE_NAME,
  KEYS.SCHEMA_NAME,
  KEYS.TABLE_NAME,
  KEYS.COLUMN_NAME,
  KEYS.SERVICE_NAME,
  KEYS.CDE_CODE,
  KEYS.CDE_NAME,
  KEYS.SURVIVORSHIP_RANK,
  KEYS.DATA_TYPE,
  KEYS.ELEMENT_TYPE,
  KEYS.GENERATION_TYPE,
  KEYS.CREATION_METHOD,
  KEYS.TIMELINESS,
  KEYS.DESCRIPTION,
  KEYS.STATUS,
  KEYS.ACTIONS,
];

export const TECHNICAL_DICTIONARY_STATIC_VISIBLE_COLUMNS = [
  KEYS.DATABASE_NAME,
  KEYS.SCHEMA_NAME,
  KEYS.TABLE_NAME,
  KEYS.COLUMN_NAME,
  KEYS.STATUS,
  KEYS.ACTIONS,
];

// v4 moves the status column to the end, so an older saved layout is not applied again.
export const TECHNICAL_DICTIONARY_COLUMN_PREFERENCE_KEY =
  'technicalDictionary.v4';

export const TECHNICAL_CLASSIFICATIONS = {
  ELEMENT_TYPE: 'DataElementType',
  GENERATION_TYPE: 'FieldGenerationType',
  CREATION_METHOD: 'DataCreationMethod',
  TIMELINESS: 'DataTimeliness',
} as const;

export const TECHNICAL_CLASSIFICATION_LIST = Object.values(
  TECHNICAL_CLASSIFICATIONS
);

export const TECHNICAL_PAGE_SIZE_OPTIONS = [10, 15, 25, 50];
export const TECHNICAL_DEFAULT_PAGE_SIZE = 25;
export const TECHNICAL_SEARCH_DEBOUNCE_MS = 500;
export const TECHNICAL_MAX_RANK = 999;
export const TECHNICAL_GLOSSARY_PAGE_PATH = '/technical-dictionary';
