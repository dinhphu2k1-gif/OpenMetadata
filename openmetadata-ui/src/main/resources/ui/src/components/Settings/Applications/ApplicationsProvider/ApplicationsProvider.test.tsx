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
import { getInstalledApplicationList } from '../../../../rest/applicationAPI';
import {
  ApplicationsProvider,
  useApplicationsProvider,
} from './ApplicationsProvider';

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: { application: { ViewAll: true } },
  }),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

jest.mock('../../../../rest/applicationAPI', () => ({
  getInstalledApplicationList: jest.fn(),
}));

const mockGetInstalledApplicationList =
  getInstalledApplicationList as jest.MockedFunction<
    typeof getInstalledApplicationList
  >;
const mockSetApplicationsName = jest.fn();
const mockUseApplicationStore = jest.requireMock(
  '../../../../hooks/useApplicationStore'
).useApplicationStore as jest.Mock;

const Consumer = () => {
  const { applications, isApplicationsLoading } = useApplicationsProvider();

  return (
    <div>
      <span data-testid="application-count">{applications.length}</span>
      <span data-testid="loading-state">
        {isApplicationsLoading ? 'loading' : 'loaded'}
      </span>
    </div>
  );
};

describe('ApplicationsProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApplicationStore.mockReturnValue({
      setApplicationsName: mockSetApplicationsName,
    });
  });

  it('renders children while applications load and updates after resolution', async () => {
    let resolveApplications!: (
      applications: Awaited<ReturnType<typeof getInstalledApplicationList>>
    ) => void;
    const applicationsPromise = new Promise<
      Awaited<ReturnType<typeof getInstalledApplicationList>>
    >((resolve) => {
      resolveApplications = resolve;
    });
    mockGetInstalledApplicationList.mockReturnValue(applicationsPromise);

    render(
      <ApplicationsProvider>
        <Consumer />
      </ApplicationsProvider>
    );

    expect(screen.getByTestId('application-count')).toHaveTextContent('0');
    expect(screen.getByTestId('loading-state')).toHaveTextContent('loading');

    await act(async () => {
      resolveApplications([
        { id: 'app-id', name: 'test-app', type: 'application' },
      ]);
      await applicationsPromise;
    });

    expect(screen.getByTestId('application-count')).toHaveTextContent('1');
    expect(screen.getByTestId('loading-state')).toHaveTextContent('loaded');
  });

  it('keeps children rendered and uses an empty list after an error', async () => {
    mockGetInstalledApplicationList.mockRejectedValue(new Error('failed'));

    render(
      <ApplicationsProvider>
        <Consumer />
      </ApplicationsProvider>
    );

    expect(screen.getByTestId('application-count')).toHaveTextContent('0');

    await waitFor(() =>
      expect(screen.getByTestId('loading-state')).toHaveTextContent('loaded')
    );

    expect(screen.getByTestId('application-count')).toHaveTextContent('0');
    expect(mockSetApplicationsName).toHaveBeenCalledWith([]);
  });
});
