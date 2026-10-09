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
import { useApplicationsProvider } from '../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import ApplicationsRouteLoadingGuard from './ApplicationsRouteLoadingGuard';

jest.mock(
  '../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: jest.fn(),
  })
);

const mockUseApplicationsProvider =
  useApplicationsProvider as jest.MockedFunction<
    typeof useApplicationsProvider
  >;

describe('ApplicationsRouteLoadingGuard', () => {
  it('shows a local loader instead of route content while apps load', () => {
    mockUseApplicationsProvider.mockReturnValue({
      isApplicationsLoading: true,
    } as ReturnType<typeof useApplicationsProvider>);

    render(
      <ApplicationsRouteLoadingGuard>
        <div>Not found</div>
      </ApplicationsRouteLoadingGuard>
    );

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByText('Not found')).not.toBeInTheDocument();
    expect(screen.queryByTestId('full-screen-loader')).not.toBeInTheDocument();
  });
});
