/*
 *  Copyright 2023 Collate.
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
  getEntityPermissionByFqn,
  getEntityPermissionById,
  getLoggedInUserPermissions,
  getResourcePermission,
} from '../../rest/permissionAPI';
import {
  clearPrefetchedPermissions,
  prefetchLoggedInUserPermissions,
} from '../../utils/PermissionPrefetch';
import PermissionProvider from './PermissionProvider';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('cookie-storage', () => ({
  CookieStorage: jest.fn().mockImplementation(() => {
    const { mockGetCookie } = jest.requireMock('cookie-storage');

    return { getItem: mockGetCookie, setItem: jest.fn() };
  }),
  mockGetCookie: jest.fn(),
}));

const mockGetCookie = jest.requireMock('cookie-storage')
  .mockGetCookie as jest.Mock;

jest.mock('../../rest/permissionAPI', () => ({
  getLoggedInUserPermissions: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
  getEntityPermissionById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  getEntityPermissionByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
  getResourcePermission: jest
    .fn()
    .mockImplementation(() => Promise.resolve({})),
}));

let currentUser: {
  id: string;
  name: string;
  roles?: { id: string }[];
  teams?: { id: string }[];
} | null = {
  id: '123',
  name: 'Test User',
};

jest.mock('../../hooks/useApplicationStore', () => {
  return {
    useApplicationStore: jest.fn().mockImplementation(() => ({
      currentUser,
    })),
  };
});

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <p>Loader</p>);
});

describe('PermissionProvider', () => {
  beforeEach(() => {
    currentUser = { id: '123', name: 'Test User' };
    clearPrefetchedPermissions();
    jest.clearAllMocks();
    (
      getLoggedInUserPermissions as jest.MockedFunction<
        typeof getLoggedInUserPermissions
      >
    ).mockResolvedValue({ data: [], paging: { total: 0 } });
  });

  it('Should render loader and call getLoggedInUserPermissions', async () => {
    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    // Verify that the API methods were called
    expect(getLoggedInUserPermissions).toHaveBeenCalled();

    expect(screen.getByText('Loader')).toBeInTheDocument();
    expect(await screen.findByTestId('children')).toBeInTheDocument();
  });

  it('Should render children and call apis when current user is present', async () => {
    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    // Verify that the API methods were called
    expect(getLoggedInUserPermissions).toHaveBeenCalled();
    expect(getEntityPermissionById).not.toHaveBeenCalled();
    expect(getEntityPermissionByFqn).not.toHaveBeenCalled();
    expect(getResourcePermission).not.toHaveBeenCalled();

    expect(await screen.findByTestId('children')).toBeInTheDocument();
  });

  it('Should not call apis when current user is undefined', async () => {
    currentUser = null;
    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    // Verify that the API methods were not called
    expect(getLoggedInUserPermissions).not.toHaveBeenCalled();
    expect(getEntityPermissionById).not.toHaveBeenCalled();
    expect(getEntityPermissionByFqn).not.toHaveBeenCalled();
    expect(getResourcePermission).not.toHaveBeenCalled();

    expect(screen.queryByText('Loader')).not.toBeInTheDocument();
    expect(await screen.findByTestId('children')).toBeInTheDocument();
  });

  it('consumes prefetched permissions without calling the API again', async () => {
    prefetchLoggedInUserPermissions();

    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    await screen.findByTestId('children');

    expect(getLoggedInUserPermissions).toHaveBeenCalledTimes(1);
  });

  it('fetches permissions from the API when there is no prefetch', async () => {
    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    await screen.findByTestId('children');

    expect(getLoggedInUserPermissions).toHaveBeenCalledTimes(1);
  });

  it('retries the API when prefetched permissions fail', async () => {
    (
      getLoggedInUserPermissions as jest.MockedFunction<
        typeof getLoggedInUserPermissions
      >
    )
      .mockRejectedValueOnce(new Error('unauthorized'))
      .mockResolvedValueOnce({ data: [], paging: { total: 0 } });
    prefetchLoggedInUserPermissions();

    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    await screen.findByTestId('children');

    expect(getLoggedInUserPermissions).toHaveBeenCalledTimes(2);
  });

  it('uses the API for team changes after consuming the initial prefetch', async () => {
    prefetchLoggedInUserPermissions();
    const { rerender } = render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );
    await screen.findByTestId('children');
    jest.clearAllMocks();
    currentUser = {
      id: '123',
      name: 'Test User',
      teams: [{ id: 'new-team' }],
    };

    rerender(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    await waitFor(() =>
      expect(getLoggedInUserPermissions).toHaveBeenCalledTimes(1)
    );
  });

  it('redirects to the stored path after permissions load', async () => {
    mockGetCookie.mockReturnValue('/stored-path');

    render(
      <PermissionProvider>
        <div data-testid="children">Children</div>
      </PermissionProvider>
    );

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/stored-path')
    );
  });
});
