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
import { TECHNICAL_BULK_CHUNK_SIZE } from '../../constants/TechnicalDictionary.constants';
import {
  runTechnicalBulkWorkflow,
  TechnicalBulkAction,
  TechnicalBulkRequest,
  TechnicalBulkResult,
} from '../../rest/technicalDictionaryAPI';
import { TechnicalDictionaryFilters } from './technicalDictionary.interface';

const MAX_REPORTED_FAILURES = 200;

const join = (values: string[]) => values.join(',');

/** The filters the server understands for a bulk selection; empty filters are omitted. */
export const buildBulkCriteria = (
  filters: TechnicalDictionaryFilters
): Record<string, string> => {
  const candidates: Record<string, string> = {
    q: filters.q,
    statuses: join(filters.statuses),
    sourceServices: join(filters.sourceServices),
    cdeMapping: join(filters.cdeMapping),
    cdeTermIds: join(filters.cdeTermIds),
    systemOwnerIds: join(filters.systemOwnerIds),
    sourceStatuses: join(filters.sourceStatuses),
    elementTypes: join(filters.elementType),
    generationTypes: join(filters.generationType),
    creationMethods: join(filters.creationMethod),
    timeliness: join(filters.timeliness),
  };

  return Object.fromEntries(
    Object.entries(candidates).filter(([, value]) => value !== '')
  );
};

export interface BulkOutcome {
  succeeded: number;
  failed: number;
  remaining: number;
  eligible: number;
  failures: TechnicalBulkResult['failures'];
}

type BulkApi = typeof runTechnicalBulkWorkflow;

/**
 * Applies one action chunk by chunk. Successful records leave the eligible set,
 * so the number of failures so far is the offset that skips them next time.
 */
export const runBulkUntilDone = async (
  action: TechnicalBulkAction,
  request: Omit<TechnicalBulkRequest, 'offset' | 'limit' | 'dryRun'>,
  onProgress: (progress: BulkOutcome) => void,
  isCancelled: () => boolean,
  api: BulkApi = runTechnicalBulkWorkflow
): Promise<BulkOutcome> => {
  const outcome: BulkOutcome = {
    succeeded: 0,
    failed: 0,
    remaining: 0,
    eligible: 0,
    failures: [],
  };
  let finished = false;
  let initialEligible: number | undefined;
  while (!finished) {
    const result = await api(action, {
      ...request,
      offset: outcome.failed,
      limit: TECHNICAL_BULK_CHUNK_SIZE,
    });
    outcome.succeeded += result.succeeded;
    outcome.failed += result.failedCount;
    outcome.remaining = result.remaining;
    initialEligible ??= result.eligible;
    outcome.eligible = initialEligible;
    outcome.failures = [...outcome.failures, ...result.failures].slice(
      0,
      MAX_REPORTED_FAILURES
    );
    onProgress({ ...outcome });
    finished =
      result.attempted === 0 || result.remaining === 0 || isCancelled();
  }

  return outcome;
};
