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

import { render, screen, waitFor } from '@testing-library/react';
import {
  getDqRuleLatestRun,
  getDqRuleResults,
  getDqRuleTrend,
} from '../../../rest/dqRuleTestAPI';
import DQRuleTestResults from './DQRuleTestResults.component';
import { DQRuleResults } from './DQRuleTests.interface';

jest.mock('../../../rest/dqRuleTestAPI', () => ({
  getDqRuleResults: jest.fn(),
  getDqRuleTrend: jest.fn(),
  getDqRuleLatestRun: jest.fn(),
  runDqRuleTests: jest.fn(),
  setDqRuleSchedule: jest.fn(),
  previewDqSchedule: jest.fn().mockResolvedValue({ nextRuns: [] }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockReturnValue(<div>Loader</div>)
);

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children }) => <a>{children}</a>),
}));

const summary = {
  specs: 2,
  applied: 3,
  notApplicable: 1,
  passed: 2,
  failed: 1,
  aborted: 0,
  noResult: 0,
  stale: 0,
  lastRunAt: 1790000000000,
};

const results: DQRuleResults = {
  rule: {
    id: 'r1',
    code: 'DQ3.1',
    threshold: '>= 99.5%',
    dimension: null,
    effective: true,
    businessVersion: '1.0',
  },
  schedule: {
    ruleId: 'r1',
    cron: '0 2 * * *',
    timezone: 'Asia/Ho_Chi_Minh',
    updatedBy: 'admin',
    updatedAt: 1,
    nextRuns: [1790086400000],
  },
  status: 'FAILED',
  summary,
  specs: [
    {
      key: 't1',
      name: 'Not null',
      kind: 'LIBRARY',
      retired: false,
      threshold: null,
      effectiveThreshold: '>= 99.5%',
      status: 'PASSED',
      summary,
    },
  ],
  testCases: [
    {
      testCaseId: 'tc1',
      testCaseFqn: 'core.kh.cccd.dqr__DQ3_1__t1',
      ruleId: 'r1',
      ruleCode: 'DQ3.1',
      spec: { key: 't1', name: 'Not null' },
      column: { fqn: 'core.db.s.kh.cccd', table: 'kh', service: 'core' },
      state: 'ACTIVE',
      stateReason: null,
      lastError: null,
      thresholdResult: 'FAILED',
      nativeStatus: 'Failed',
      passedRowsPercentage: 97.1,
      failedRows: 4211,
      timestamp: 1790000000000,
      stale: false,
    },
  ],
  hiddenTestCases: 0,
  paging: { offset: 0, limit: 25, total: 1 },
};

describe('DQRuleTestResults', () => {
  beforeEach(() => {
    (getDqRuleResults as jest.Mock).mockResolvedValue(results);
    (getDqRuleTrend as jest.Mock).mockResolvedValue({
      days: 30,
      points: [],
      versions: [],
    });
    (getDqRuleLatestRun as jest.Mock).mockResolvedValue({ state: 'success' });
  });

  it('shows status, schedule and the testcase rows', async () => {
    render(
      <DQRuleTestResults
        capabilities={{
          canView: true,
          canEdit: true,
          canRun: true,
          isAdmin: false,
        }}
        ruleId="r1"
      />
    );

    expect(
      await screen.findByTestId('dq-rule-test-results')
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('dq-outcome-FAILED')).toHaveLength(2);
    expect(screen.getByTestId('dq-schedule-line')).toHaveTextContent(
      '0 2 * * *'
    );
    expect(screen.getByText('97.10%')).toBeInTheDocument();
    expect(screen.getByText('4211')).toBeInTheDocument();
    expect(screen.getByTestId('dq-run-now')).toBeEnabled();
    expect(screen.getByTestId('dq-change-schedule')).toBeInTheDocument();
    expect(
      screen.queryByTestId('dq-no-schedule-warning')
    ).not.toBeInTheDocument();
  });

  it('hides run and schedule actions without edit rights', async () => {
    render(
      <DQRuleTestResults
        capabilities={{
          canView: true,
          canEdit: false,
          canRun: false,
          isAdmin: false,
        }}
        ruleId="r1"
      />
    );

    await screen.findByTestId('dq-rule-test-results');

    expect(screen.queryByTestId('dq-run-now')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dq-change-schedule')).not.toBeInTheDocument();
  });

  it('warns when the rule has no schedule', async () => {
    (getDqRuleResults as jest.Mock).mockResolvedValue({
      ...results,
      schedule: { ...results.schedule, cron: null, nextRuns: [] },
    });
    render(<DQRuleTestResults ruleId="r1" />);

    expect(
      await screen.findByTestId('dq-no-schedule-warning')
    ).toBeInTheDocument();
  });

  it('disables Run now while a run is in progress', async () => {
    (getDqRuleLatestRun as jest.Mock).mockResolvedValue({ state: 'running' });
    render(
      <DQRuleTestResults
        capabilities={{
          canView: true,
          canEdit: true,
          canRun: true,
          isAdmin: false,
        }}
        ruleId="r1"
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('dq-run-now')).toBeDisabled()
    );
  });

  it('shows the not-approved state when the rule was never applied', async () => {
    (getDqRuleResults as jest.Mock).mockRejectedValue({
      response: { data: { code: 'DQ_TEST_RUN_NOT_AVAILABLE' } },
    });
    render(<DQRuleTestResults ruleId="r1" />);

    expect(
      await screen.findByTestId('dq-results-not-applied')
    ).toBeInTheDocument();
  });

  it('flags an archived rule', async () => {
    (getDqRuleResults as jest.Mock).mockResolvedValue({
      ...results,
      rule: { ...results.rule, effective: false },
    });
    render(<DQRuleTestResults ruleId="r1" />);

    expect(
      await screen.findByTestId('dq-results-archived')
    ).toBeInTheDocument();
  });
});
