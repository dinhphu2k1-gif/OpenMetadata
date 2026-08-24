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

export const APPLICATION_BRAND_NAME = 'Agribank';

/**
 * Rebrands user-facing locale resources without changing technical identifiers
 * used by the API, schemas, or integrations.
 */
export const rebrandLocaleResources = <T>(resources: T): T =>
  JSON.parse(
    JSON.stringify(resources).replaceAll('OpenMetadata', APPLICATION_BRAND_NAME)
  ) as T;
