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

import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import { DQOutcome, DQRuleStatus } from './DQRuleTests.interface';

/** StatusBadge look of each outcome; `icon` is the badge icon key, absent for the grey states. */
export const DQ_OUTCOME_BADGE: Record<
  DQRuleStatus,
  { status: StatusType; icon?: string }
> = {
  PASSED: { status: StatusType.Success, icon: 'Success' },
  FAILED: { status: StatusType.Failure, icon: 'Failed' },
  ABORTED: { status: StatusType.Aborted, icon: 'Aborted' },
  NO_RESULT: { status: StatusType.Archived },
  NOT_DECLARED: { status: StatusType.Archived },
};

export const DQ_OUTCOME_LABEL_KEY: Record<DQRuleStatus, string> = {
  PASSED: 'dq.test.status.passed',
  FAILED: 'dq.test.status.failed',
  ABORTED: 'dq.test.status.aborted',
  NO_RESULT: 'dq.test.status.no-result',
  NOT_DECLARED: 'dq.test.status.not-declared',
};

export const DQ_OUTCOMES: DQOutcome[] = [
  'PASSED',
  'FAILED',
  'ABORTED',
  'NO_RESULT',
];

export const DQ_RESULT_PAGE_SIZE = 25;

export const DQ_TREND_PERIODS = [30, 90];

export const DQ_RUN_POLL_INTERVAL_MS = 5000;

export const DQ_RUNNING_STATES = new Set(['running', 'queued']);

/** How long a run requested on the Portal may wait for the OpenMetadata server to start it. */
export const DQ_RUN_START_WAIT_MS = 180000;

/** Tolerance between the browser clock and the clock that stamps a pipeline run. */
export const DQ_RUN_CLOCK_SKEW_MS = 10000;

export const DQ_PIPELINE_STATE_BADGE: Record<
  string,
  { status: StatusType; icon?: string }
> = {
  failed: { status: StatusType.Failure, icon: 'Failed' },
  never: { status: StatusType.Archived },
  partialSuccess: { status: StatusType.Warning, icon: 'ActiveError' },
  queued: { status: StatusType.Pending, icon: 'Pending' },
  running: { status: StatusType.Running, icon: 'Running' },
  success: { status: StatusType.Success, icon: 'Success' },
};

export const DQ_SCHEDULE_PRESETS = [
  { key: 'daily', cron: '0 2 * * *' },
  { key: 'weekly', cron: '0 2 * * 1' },
  { key: 'monthly', cron: '0 2 1 * *' },
  { key: 'quarterly', cron: '0 2 1 1,4,7,10 *' },
];

export const DQ_DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export const DQ_TEST_FILTER_STATUSES: DQRuleStatus[] = [
  'NOT_DECLARED',
  'PASSED',
  'FAILED',
  'ABORTED',
  'NO_RESULT',
];

export const DQ_TEST_DEFINITION_LIMIT = 1000;

/** Method tag of a Rule checked by its own SQL; its new declarations default to SQL. */
export const DQ_SQL_METHOD_TAG_SUFFIX = 'TechnicalSqlRule';
