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
  getDqScopeResults,
  getDqScopeTrend,
} from '../../../rest/dqRuleTestAPI';
import { DQScopeResults } from './DQRuleTests.interface';
import DQScopeTestResults from './DQScopeTestResults.component';

jest.mock('../../../rest/dqRuleTestAPI', () => ({
  getDqScopeResults: jest.fn(),
  getDqScopeTrend: jest.fn(),
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

const domainScope = { type: 'domain' as const, id: 'domain-1' };

const emptySummary = {
  specs: 0,
  applied: 0,
  notApplicable: 0,
  passed: 0,
  failed: 0,
  aborted: 0,
  noResult: 0,
  stale: 0,
  lastRunAt: null,
};

const notDeclaredResults: DQScopeResults = {
  domainId: 'domain-1',
  summary: {
    rules: 1,
    rulesWithTests: 0,
    rulesByStatus: { NOT_DECLARED: 1 },
    testCases: 0,
    passedTestCases: 0,
    passRate: null,
  },
  dimensions: [{ dimension: null, rules: 1, passedRules: 0, passRate: 0 }],
  rules: [
    {
      id: 'r1',
      code: 'DQ4.1',
      threshold: null,
      dimension: null,
      effective: true,
      businessVersion: '1.0',
      status: 'NOT_DECLARED',
      cron: null,
      specs: 0,
      columns: 0,
      summary: emptySummary,
    },
  ],
  testCases: [],
  hiddenTestCases: 0,
  paging: { offset: 0, limit: 25, total: 0 },
};

describe('DQScopeTestResults', () => {
  beforeEach(() => {
    (getDqScopeTrend as jest.Mock).mockResolvedValue({
      days: 30,
      points: [],
      versions: [],
    });
  });

  it('reads the results and the trend of the given scope', async () => {
    (getDqScopeResults as jest.Mock).mockResolvedValue(notDeclaredResults);

    render(<DQScopeTestResults scope={domainScope} />);

    await waitFor(() =>
      expect(getDqScopeResults).toHaveBeenCalledWith(
        domainScope,
        expect.objectContaining({ offset: 0 })
      )
    );

    expect(getDqScopeTrend).toHaveBeenCalledWith(domainScope, 30);
  });

  it('shows rules without tests apart and no pass rate without results', async () => {
    (getDqScopeResults as jest.Mock).mockResolvedValue(notDeclaredResults);

    render(<DQScopeTestResults scope={domainScope} />);

    expect(await screen.findByTestId('dq-cde-dimensions')).toHaveTextContent(
      'dq.test.cde.no-dimension'
    );
    expect(screen.getAllByText('dq.test.status.not-declared')).not.toHaveLength(
      0
    );
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);
  });

  it('shows one empty state when the scope has no rule', async () => {
    (getDqScopeResults as jest.Mock).mockResolvedValue({
      ...notDeclaredResults,
      summary: { ...notDeclaredResults.summary, rules: 0, rulesByStatus: {} },
      dimensions: [],
      rules: [],
    });

    render(<DQScopeTestResults scope={domainScope} />);

    expect(
      await screen.findByTestId('dq-scope-results-empty')
    ).toHaveTextContent('dq.test.cde.empty-title');
    expect(screen.queryByTestId('dq-cde-dimensions')).not.toBeInTheDocument();
  });
});
