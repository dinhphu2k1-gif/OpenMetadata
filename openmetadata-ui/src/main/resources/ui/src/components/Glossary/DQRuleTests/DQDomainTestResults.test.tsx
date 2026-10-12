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

import { render, screen } from '@testing-library/react';
import DQDomainTestResults from './DQDomainTestResults.component';

const mockScopeResults = jest.fn();

jest.mock('./DQScopeTestResults.component', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockScopeResults(props);

    return <div data-testid="scope-results" />;
  },
}));

jest.mock('../../../hooks/useDqTestConfig', () => ({
  useDqTestConfig: () => ({ config: { capabilities: { canRun: true } } }),
}));

describe('DQDomainTestResults', () => {
  it('shows the Data Quality Rules of the domain like a CDE', () => {
    render(<DQDomainTestResults domainId="domain-1" />);

    expect(screen.getByTestId('scope-results')).toBeInTheDocument();
    expect(mockScopeResults).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { type: 'domain', id: 'domain-1' },
        capabilities: { canRun: true },
      })
    );
  });
});
