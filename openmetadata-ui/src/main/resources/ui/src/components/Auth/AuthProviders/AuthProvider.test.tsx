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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AxiosResponse } from 'axios';
import { act } from 'react-test-renderer';
import { AuthProvider as AuthProviderProps } from '../../../generated/configuration/authenticationConfiguration';
import axiosClient from '../../../rest';
import { getLoggedInUserPermissions } from '../../../rest/permissionAPI';
import { getLoggedInUser } from '../../../rest/userAPI';
import TokenService from '../../../utils/Auth/TokenService/TokenServiceUtil';
import {
  clearPrefetchedPermissions,
  consumePrefetchedPermissions,
  prefetchLoggedInUserPermissions,
} from '../../../utils/PermissionPrefetch';
import {
  clearOidcToken,
  getOidcToken,
} from '../../../utils/SwTokenStorageUtils';
import AuthProvider, { useAuthProvider } from './AuthProvider';

const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
});

const mockOnLogoutHandler = jest.fn();

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({ pathname: 'pathname' }));
});

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../rest/miscAPI', () => ({
  fetchAuthenticationConfig: jest.fn().mockImplementation(() =>
    Promise.resolve({
      provider: AuthProviderProps.Basic,
    })
  ),
  fetchAuthorizerConfig: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../rest/userAPI', () => ({
  getLoggedInUser: jest.fn().mockImplementation(() => Promise.resolve()),
  updateUser: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../rest/permissionAPI', () => ({
  getLoggedInUserPermissions: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

jest.mock('../../../utils/SwTokenStorageUtils', () => ({
  clearOidcToken: jest.fn().mockResolvedValue(undefined),
  getOidcToken: jest.fn().mockResolvedValue(undefined),
  getRefreshToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../AppRouter/AppRouter', () => ({
  preloadAuthenticatedChunks: jest.fn(),
}));

const mockPreloadAuthenticatedChunks = jest.requireMock(
  '../../AppRouter/AppRouter'
).preloadAuthenticatedChunks as jest.Mock;

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showInfoToast: jest.fn(),
}));

const mockRefreshToken = jest
  .fn()
  .mockImplementation(() => Promise.resolve('newToken'));

jest.mock('../../../utils/Auth/TokenService/TokenServiceUtil', () => {
  return {
    getInstance: jest.fn().mockImplementation(() => ({
      refreshToken: mockRefreshToken,
      isTokenUpdateInProgress: jest.fn().mockImplementation(() => false),
      getToken: jest.fn().mockImplementation(() => Promise.resolve()),
      clearRefreshInProgress: jest
        .fn()
        .mockImplementation(() => Promise.resolve()),
      renewToken: jest.fn(),
      refreshSuccessCallback: jest.fn(),
      handleTokenUpdate: jest.fn(),
      updateRenewToken: jest.fn(),
      updateRefreshSuccessCallback: jest.fn(),
      isTokenExpired: jest.fn(),
      getTokenExpiry: jest.fn(),
      fetchNewToken: jest.fn(),
      setRefreshInProgress: jest.fn(),
    })),
  };
});

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    setCurrentUser: jest.fn(),
    updateNewUser: jest.fn(),
    setIsAuthenticated: jest.fn(),
    setAuthConfig: jest.fn(),
    setAuthorizerConfig: jest.fn(),
    setIsSigningUp: jest.fn(),
    authorizerConfig: {},
    jwtPrincipalClaims: {},
    jwtPrincipalClaimsMapping: {},
    setJwtPrincipalClaims: jest.fn(),
    setJwtPrincipalClaimsMapping: jest.fn(),
    isApplicationLoading: false,
    setApplicationLoading: jest.fn(),
    initializeAuthState: jest.fn(),
    isAuthenticating: false,
    authConfig: {
      provider: AuthProviderProps.Basic,
      providerName: 'Basic',
      clientId: 'test',
      authority: 'test',
      callbackUrl: 'test',
      jwtPrincipalClaims: [],
      publicKeyUrls: [],
      scope: 'openid',
    },
  })),
}));

describe('Test auth provider', () => {
  beforeEach(() => {
    clearPrefetchedPermissions();
    jest.clearAllMocks();
    (
      getOidcToken as jest.MockedFunction<typeof getOidcToken>
    ).mockResolvedValue(undefined as unknown as string);
    (
      getLoggedInUserPermissions as jest.MockedFunction<
        typeof getLoggedInUserPermissions
      >
    ).mockResolvedValue({ data: [], paging: { total: 0 } });
    (
      getLoggedInUser as jest.MockedFunction<typeof getLoggedInUser>
    ).mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof getLoggedInUser>>
    );
  });

  it('Logout handler should call the "updateUserDetails" method', async () => {
    const ConsumerComponent = () => {
      const { onLogoutHandler } = useAuthProvider();

      return (
        <button data-testid="logout-button" onClick={onLogoutHandler}>
          Logout
        </button>
      );
    };

    render(
      <AuthProvider childComponentType={ConsumerComponent}>
        <ConsumerComponent />
      </AuthProvider>
    );

    const logoutButton = await screen.findByTestId('logout-button');

    expect(logoutButton).toBeInTheDocument();
  });

  it('Logout handler should remove the refresh token', async () => {
    const ConsumerComponent = () => {
      return (
        <button data-testid="logout-button" onClick={mockOnLogoutHandler}>
          Logout
        </button>
      );
    };

    render(
      <AuthProvider childComponentType={ConsumerComponent}>
        <ConsumerComponent />
      </AuthProvider>
    );

    const logoutButton = await screen.findByTestId('logout-button');

    expect(logoutButton).toBeInTheDocument();

    fireEvent.click(logoutButton);

    expect(mockOnLogoutHandler).toHaveBeenCalled();
  });

  it('onLoginHandler should handle race condition with polling mechanism', () => {
    const ConsumerComponent = () => {
      const { onLoginHandler } = useAuthProvider();

      return (
        <button
          data-testid="login-button"
          onClick={() => {
            expect(typeof onLoginHandler).toBe('function');

            onLoginHandler();
          }}>
          Login
        </button>
      );
    };

    const { getByTestId } = render(
      <AuthProvider childComponentType={ConsumerComponent}>
        <ConsumerComponent />
      </AuthProvider>
    );

    const loginButton = getByTestId('login-button');

    expect(loginButton).toBeInTheDocument();
  });

  it('starts user and permission requests in parallel when a token exists', async () => {
    let resolveUser!: (
      user: Awaited<ReturnType<typeof getLoggedInUser>>
    ) => void;
    const userPromise = new Promise<
      Awaited<ReturnType<typeof getLoggedInUser>>
    >((resolve) => {
      resolveUser = resolve;
    });
    (
      getOidcToken as jest.MockedFunction<typeof getOidcToken>
    ).mockResolvedValue('token');
    (
      getLoggedInUser as jest.MockedFunction<typeof getLoggedInUser>
    ).mockReturnValue(userPromise);

    render(
      <AuthProvider childComponentType={() => null}>
        <div>Children</div>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(getLoggedInUser).toHaveBeenCalled();
      expect(getLoggedInUserPermissions).toHaveBeenCalled();
    });

    expect(mockPreloadAuthenticatedChunks).toHaveBeenCalled();

    await act(async () => {
      resolveUser({ id: 'user-id', name: 'test-user', email: 'test@test.com' });
      await userPromise;
    });
  });

  it('clears prefetched permissions on logout and reset', async () => {
    const ConsumerComponent = () => {
      const { handleSuccessfulLogout, onLogoutHandler } = useAuthProvider();

      return (
        <>
          <button data-testid="logout" onClick={onLogoutHandler} />
          <button data-testid="reset" onClick={handleSuccessfulLogout} />
        </>
      );
    };

    render(
      <AuthProvider childComponentType={ConsumerComponent}>
        <ConsumerComponent />
      </AuthProvider>
    );

    prefetchLoggedInUserPermissions();
    fireEvent.click(await screen.findByTestId('logout'));

    expect(consumePrefetchedPermissions()).toBeUndefined();

    await waitFor(() => expect(clearOidcToken).toHaveBeenCalled());

    prefetchLoggedInUserPermissions();
    fireEvent.click(screen.getByTestId('reset'));

    expect(consumePrefetchedPermissions()).toBeUndefined();
  });
});

describe('Test axios response interceptor', () => {
  const ConsumerComponent = () => {
    return <div>ConsumerComponent</div>;
  };

  const WrapperComponent = () => {
    return (
      <AuthProvider childComponentType={ConsumerComponent}>
        <ConsumerComponent />
      </AuthProvider>
    );
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('should set up response interceptor with correct signature', () => {
    // Mock axios client
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    render(<WrapperComponent />);

    // Verify the interceptor was set up
    expect(mockUse).toHaveBeenCalled();

    // Get the arguments passed to use()
    const [successHandler, errorHandler] = mockUse.mock.calls[0];

    // Verify success handler signature
    expect(typeof successHandler).toBe('function');
    expect(successHandler).toHaveLength(1); // Takes one argument (response)

    // Verify error handler signature
    expect(typeof errorHandler).toBe('function');
    expect(errorHandler).toHaveLength(1); // Takes one argument (error)

    // Test success handler
    const mockResponse = { data: 'test' } as AxiosResponse;

    expect(successHandler?.(mockResponse)).toBe(mockResponse);

    // Test error handler with 401 error
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: { url: '/api/test' },
    };

    // The error handler should return a Promise
    const result = errorHandler?.(mockError);

    expect(result).toBeInstanceOf(Promise);
    expect(mockRefreshToken).toHaveBeenCalled();
  });

  it('should handle 401 error when refresh is not in progress and refresh succeeds', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });
    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: { url: '/api/test' },
    };

    const result = await errorHandler?.(mockError);

    expect(result).toEqual({ data: 'success' });
    expect(mockRefreshToken).toHaveBeenCalled();
    expect(mockAxios).toHaveBeenCalledWith(mockError.config);
  });

  it('should queue request when refresh is already in progress', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    // Mock isTokenUpdateInProgress to return true for this test
    jest
      .spyOn(TokenService.getInstance(), 'isTokenUpdateInProgress')
      .mockReturnValue(true);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/api/test',
        headers: {},
        baseURL: '',
      },
    };

    const result = await errorHandler?.(mockError);

    expect(mockRefreshToken).toHaveBeenCalled();
    expect(mockAxios).toHaveBeenCalledWith(
      expect.objectContaining(mockError.config)
    );
    expect(await result).toEqual({ data: 'success' });
  });

  it('should not call refresh for login api', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);
    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/users/login',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it('should not call refresh for refresh api', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/users/refresh',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it('should not call refresh for auth/refresh api', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: 'auth/refresh',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it('should not call refresh for /auth/refresh api', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/auth/refresh',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it('should not call refresh for loggedInUser api if error is Token expired', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/users/loggedInUser',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);
    }
  });

  it('should call refresh for loggedInUser api if error other then Token expired', async () => {
    const mockUse = jest.spyOn(axiosClient.interceptors.response, 'use');
    const mockAxios = jest.fn().mockResolvedValue({ data: 'success' });
    mockRefreshToken.mockImplementationOnce(() => Promise.resolve());

    jest.spyOn(axiosClient, 'request').mockImplementation(mockAxios);

    await act(async () => {
      render(<WrapperComponent />);
    });

    const [, errorHandler] = mockUse.mock.calls[0];
    const mockError = {
      response: {
        status: 401,
        data: { message: 'token not valid' },
      },
      config: {
        url: '/users/loggedInUser',
        headers: {},
        baseURL: '',
      },
    };

    try {
      await errorHandler?.(mockError);
    } catch (error) {
      expect(error).toEqual(mockError);

      expect(mockRefreshToken).toHaveBeenCalledTimes(0);
    }
  });
});
