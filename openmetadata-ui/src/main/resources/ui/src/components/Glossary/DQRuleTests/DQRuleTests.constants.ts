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

import { DQOutcome, DQRuleStatus } from './DQRuleTests.interface';

export const DQ_OUTCOME_COLOR: Record<DQRuleStatus, string> = {
  PASSED: 'success',
  FAILED: 'error',
  ABORTED: 'warning',
  NO_RESULT: 'default',
  NOT_DECLARED: 'default',
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
