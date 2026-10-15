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

import { act, render, screen, waitFor } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import {
  getDqRuleLatestRun,
  getDqRuleResults,
  getDqRuleTrend,
} from '../../../rest/dqRuleTestAPI';
import DQRuleTestResults from './DQRuleTestResults.component';
import { DQRuleResults, DQTestCapabilities } from './DQRuleTests.interface';

jest.mock('../../../rest/dqRuleTestAPI', () => ({
  getDqRuleResults: jest.fn(),
  getDqRuleTrend: jest.fn(),
  getDqRuleLatestRun: jest.fn(),
  runDqRuleTests: jest.fn(),
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
  errors: 0,
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

const errorRow = (index: number) => ({
  ...results.testCases[0],
  testCaseId: null,
  testCaseFqn: null,
  column: {
    fqn: `core.db.s.kh${index}.cccd`,
    table: `kh${index}`,
    service: 'core',
  },
  state: 'ERROR',
  stateReason: 'RECONCILE_FAILED',
  thresholdResult: 'NO_RESULT',
  nativeStatus: null,
  passedRowsPercentage: null,
  failedRows: null,
  timestamp: null,
});

describe('DQRuleTestResults', () => {
  const defaultTranslation = (useTranslation as jest.Mock)();

  afterEach(() => {
    (useTranslation as jest.Mock).mockReturnValue(defaultTranslation);
  });

  beforeEach(() => {
    (getDqRuleResults as jest.Mock).mockResolvedValue(results);
    (getDqRuleTrend as jest.Mock).mockResolvedValue({
      days: 30,
      points: [],
      versions: [],
    });
    (getDqRuleLatestRun as jest.Mock).mockResolvedValue({ state: 'success' });
  });

  it('shows status and the testcase rows', async () => {
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
    expect(screen.getByText('97.10%')).toBeInTheDocument();
    expect(screen.getByText(/4.?211/)).toBeInTheDocument();
    expect(screen.getByTestId('dq-spec-summary')).toHaveTextContent('Not null');
    expect(screen.getByTestId('dq-run-now')).toBeEnabled();
  });

  it('shows one empty state when no test is declared', async () => {
    const onDeclare = jest.fn();
    (getDqRuleResults as jest.Mock).mockResolvedValue({
      ...results,
      status: 'NOT_DECLARED',
      specs: [],
      testCases: [],
      summary: { ...summary, specs: 0, applied: 0, passed: 0, failed: 0 },
    });
    render(
      <DQRuleTestResults
        declareAction={{ label: 'Declare', hint: 'Hint', onClick: onDeclare }}
        ruleId="r1"
      />
    );

    expect(
      await screen.findByTestId('dq-results-not-declared')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dq-run-now')).not.toBeInTheDocument();

    screen.getByTestId('dq-declare-tests').click();

    expect(screen.getByText('Hint')).toBeInTheDocument();
    expect(onDeclare).toHaveBeenCalled();
  });

  it('explains when declared tests apply to no column', async () => {
    (getDqRuleResults as jest.Mock).mockResolvedValue({
      ...results,
      status: 'NO_RESULT',
      testCases: [],
      summary: { ...summary, applied: 0, passed: 0, failed: 0 },
    });
    render(<DQRuleTestResults ruleId="r1" />);

    expect(
      await screen.findByTestId('dq-results-no-columns')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dq-declare-tests')).not.toBeInTheDocument();
  });

  it('hides the run action without run rights', async () => {
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

  it('counts every failed testcase, not only the rows of the page', async () => {
    (useTranslation as jest.Mock).mockReturnValue({
      ...defaultTranslation,
      t: (key: string, options?: { count?: number }) =>
        options?.count === undefined ? key : `${key}:${options.count}`,
    });
    (getDqRuleResults as jest.Mock).mockResolvedValue({
      ...results,
      status: 'NO_RESULT',
      summary: { ...summary, applied: 0, passed: 0, failed: 0, errors: 29 },
      testCases: Array.from({ length: 25 }, (_, index) => errorRow(index)),
      paging: { offset: 0, limit: 25, total: 29 },
    });
    render(<DQRuleTestResults ruleId="r1" />);

    expect(await screen.findByTestId('dq-sync-error')).toHaveTextContent(
      'dq.test.sync-error-description:29'
    );
    expect(screen.getByTitle('2')).toBeInTheDocument();
  });

  it('hides the applied version results when another version is viewed', async () => {
    (getDqRuleResults as jest.Mock).mockResolvedValue({
      ...results,
      rule: { ...results.rule, businessVersion: '1.1' },
    });
    render(<DQRuleTestResults ruleId="r1" viewedBusinessVersion="1.0" />);

    expect(
      await screen.findByTestId('dq-results-other-version')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('dq-rule-test-results')
    ).not.toBeInTheDocument();
  });

  it('shows the results of a replaced version without run actions', async () => {
    (getDqRuleResults as jest.Mock).mockResolvedValue({
      ...results,
      rule: { ...results.rule, businessVersion: '1.0', appliedUntil: 1000 },
    });
    render(
      <DQRuleTestResults
        capabilities={{ canRun: true } as DQTestCapabilities}
        ruleId="r1"
        viewedBusinessVersion="1.0"
      />
    );

    expect(
      await screen.findByTestId('dq-results-replaced-version')
    ).toBeInTheDocument();
    expect(screen.getByTestId('dq-rule-test-results')).toBeInTheDocument();
    expect(screen.queryByTestId('dq-run-now')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dq-results-archived')).not.toBeInTheDocument();
    expect(getDqRuleResults).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ businessVersion: '1.0' })
    );
  });

  it('keeps the results of the version on screen when an earlier read ends last', async () => {
    let resolveApplied: (value: DQRuleResults) => void = () => undefined;
    (getDqRuleResults as jest.Mock).mockImplementation(
      (_ruleId: string, params: { businessVersion?: string }) =>
        params.businessVersion === '1.1'
          ? new Promise((resolve) => {
              resolveApplied = resolve;
            })
          : Promise.resolve({
              ...results,
              rule: {
                ...results.rule,
                businessVersion: '1.0',
                appliedUntil: 1000,
              },
            })
    );
    const { rerender } = render(
      <DQRuleTestResults ruleId="r1" viewedBusinessVersion="1.1" />
    );
    rerender(<DQRuleTestResults ruleId="r1" viewedBusinessVersion="1.0" />);

    expect(
      await screen.findByTestId('dq-results-replaced-version')
    ).toBeInTheDocument();

    await act(async () => {
      resolveApplied({
        ...results,
        rule: { ...results.rule, businessVersion: '1.1' },
      });
    });

    expect(
      screen.getByTestId('dq-results-replaced-version')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('dq-results-other-version')
    ).not.toBeInTheDocument();
  });

  it('adds no version notice on the applied version', async () => {
    render(<DQRuleTestResults ruleId="r1" viewedBusinessVersion="1.0" />);

    await screen.findByTestId('dq-rule-test-results');

    expect(
      screen.queryByTestId('dq-results-other-version')
    ).not.toBeInTheDocument();
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
