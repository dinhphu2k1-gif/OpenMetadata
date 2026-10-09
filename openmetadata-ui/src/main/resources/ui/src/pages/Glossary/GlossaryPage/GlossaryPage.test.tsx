/*
 *  Copyright 2022 Collate.
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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import ResizableLeftPanels from '../../../components/common/ResizablePanels/ResizableLeftPanels';
import * as useGlossaryStoreModule from '../../../components/Glossary/useGlossary.store';
import { ROUTES } from '../../../constants/constants';
import { Glossary } from '../../../generated/entity/data/glossary';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { MOCK_GLOSSARY } from '../../../mocks/Glossary.mock';
import {
  getGlossariesList,
  getGlossaryTermByFQN,
  getGlossaryTermsById,
  getGlossaryTermWorkingVersion,
  getGlossaryWorkingVersion,
  getPublishedGlossaryTerm,
  updateGlossaryTermWorkingVersion,
  updateGlossaryWorkingVersion,
} from '../../../rest/glossaryAPI';
import GlossaryPage from './GlossaryPage.component';

const mockNavigate = jest.fn();
let mockFqn = 'Business Glossary';
let mockLocationPathname = '/mock-path';
let mockLocationSearch = '';

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockImplementation(() => ({ fqn: mockFqn })),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    glossaryName: 'GlossaryName',
  }),
  useLocation: jest.fn().mockImplementation(() => ({
    pathname: mockLocationPathname,
    search: mockLocationSearch,
  })),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(() => ({
    paging: {},
    pageSize: 15,
    handlePagingChange: jest.fn(),
  })),
}));

jest.mock('../../../hooks/useElementInView', () => ({
  useElementInView: jest.fn(() => [jest.fn(), false]),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(() => ({ action: '' })),
}));

jest.mock('../../../components/MyData/LeftSidebar/LeftSidebar.component', () =>
  jest.fn().mockReturnValue(<p>Sidebar</p>)
);

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => {
  return {
    usePermissionProvider: jest.fn(() => ({
      permissions: {
        glossary: { ViewAll: true, ViewBasic: true },
        glossaryTerm: { ViewAll: true, ViewBasic: true },
      },
    })),
  };
});

jest.mock('../../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => {
    const WrappedComponent = (props: Record<string, unknown>) => (
      <Component {...props} />
    );

    return WrappedComponent;
  }),
}));

jest.mock('../../../context/AsyncDeleteProvider/AsyncDeleteProvider', () => ({
  useAsyncDeleteProvider: jest.fn(() => ({
    handleOnAsyncEntityDeleteConfirm: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockSetGlossaries = jest.fn();
const mockSetActiveGlossary = jest.fn();
const mockUpdateActiveGlossary = jest.fn();
let mockGlossaries = [MOCK_GLOSSARY];
let mockActiveGlossary: typeof MOCK_GLOSSARY | GlossaryTerm = MOCK_GLOSSARY;

jest.mock('../../../components/Glossary/useGlossary.store', () => ({
  useGlossaryStore: jest.fn(() => ({
    glossaries: mockGlossaries,
    setGlossaries: mockSetGlossaries,
    activeGlossary: mockActiveGlossary,
    setActiveGlossary: mockSetActiveGlossary,
    updateActiveGlossary: mockUpdateActiveGlossary,
  })),
}));

jest.mock('../../../components/Glossary/GlossaryV1.component', () => {
  return jest.fn().mockImplementation((props) => (
    <div>
      <p> Glossary.component</p>
      <p data-testid="historical-state">{String(props.isVersionsView)}</p>
      <button
        data-testid="handleGlossaryTermUpdate"
        onClick={() => props.onGlossaryTermUpdate(MOCK_GLOSSARY)}>
        handleGlossaryTermUpdate
      </button>
      <button
        data-testid="updateGlossaryTermDescription"
        onClick={() =>
          props.onGlossaryTermUpdate({
            ...MOCK_GLOSSARY,
            description: 'Updated term description',
          })
        }>
        updateGlossaryTermDescription
      </button>
      <button
        data-testid="handleGlossaryDelete"
        onClick={() => props.onGlossaryDelete(MOCK_GLOSSARY.id)}>
        handleGlossaryDelete
      </button>
      <button
        data-testid="handleGlossaryTermDelete"
        onClick={() => props.onGlossaryTermDelete(MOCK_GLOSSARY.id)}>
        handleGlossaryTermDelete
      </button>
      <button
        data-testid="updateGlossary"
        onClick={() => props.updateGlossary(MOCK_GLOSSARY)}>
        updateGlossary
      </button>
      <button
        data-testid="updateGlossaryDescription"
        onClick={() =>
          props.updateGlossary({ description: 'Updated description' })
        }>
        updateGlossaryDescription
      </button>
    </div>
  ));
});

jest.mock('../GlossaryLeftPanel/GlossaryLeftPanel.component', () => {
  return jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="glossary-left-panel-container">Left Panel</div>
    ));
});

jest.mock(
  '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => jest.fn().mockReturnValue(<div data-testid="error-placeholder" />)
);

jest.mock('../../../rest/glossaryAPI', () => ({
  deleteGlossary: jest.fn().mockImplementation(() => Promise.resolve()),
  deleteGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
  getGlossaryTermByFQN: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_GLOSSARY)),
  getGlossaryTermsById: jest.fn().mockResolvedValue(MOCK_GLOSSARY),
  getGlossariesList: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [MOCK_GLOSSARY],
      paging: { total: 1 },
    })
  ),
  getGlossaryVersionsList: jest.fn().mockResolvedValue({ versions: [] }),
  getGlossaryVersionPermissions: jest.fn().mockResolvedValue({
    canViewWorking: true,
    canViewPublished: true,
  }),
  getLatestPublishedGlossary: jest
    .fn()
    .mockResolvedValue({ ...MOCK_GLOSSARY, entityStatus: 'Approved' }),
  getGlossaryWorkingVersion: jest
    .fn()
    .mockResolvedValue({ ...MOCK_GLOSSARY, workingRevision: 1 }),
  invalidateGlossaryVersionPermissions: jest.fn(),
  getGlossaryTermWorkingVersion: jest
    .fn()
    .mockResolvedValue({ ...MOCK_GLOSSARY, workingRevision: 1 }),
  getPublishedGlossaryTerm: jest.fn().mockResolvedValue(MOCK_GLOSSARY),
  updateGlossaryWorkingVersion: jest
    .fn()
    .mockResolvedValue({ ...MOCK_GLOSSARY, workingRevision: 2 }),
  updateGlossaryTermWorkingVersion: jest
    .fn()
    .mockResolvedValue({ ...MOCK_GLOSSARY, workingRevision: 2 }),
}));

jest.mock(
  '../../../components/common/ResizablePanels/ResizableLeftPanels',
  () =>
    jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
      <div>
        {firstPanel.children}
        {secondPanel.children}
      </div>
    ))
);

jest.mock('../../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div>
      {firstPanel.children}
      {secondPanel.children}
    </div>
  ))
);

const mockProps = {
  pageTitle: 'glossary',
};

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
};

const createApiError = (status: number) =>
  ({ response: { status } } as AxiosError);

const createCde = (overrides: Partial<GlossaryTerm> = {}): GlossaryTerm =>
  ({
    ...MOCK_GLOSSARY,
    id: 'term-id',
    businessVersion: '1.0',
    parentBusinessVersion: '1',
    fullyQualifiedName: 'Data Dictionary.CDE1@v1',
    ...overrides,
  } as GlossaryTerm);

const setCdeRoute = (search = '') => {
  mockFqn = 'Data Dictionary.CDE1@v1';
  mockLocationPathname = '/glossary/Data%20Dictionary.CDE1%40v1';
  mockLocationSearch =
    search || '?businessVersion=1.0&parentBusinessVersion=1&termId=term-id';
};

describe('Test GlossaryComponent page', () => {
  it('GlossaryComponent Page Should render', async () => {
    render(<GlossaryPage {...mockProps} />);

    const glossaryComponent = await screen.findByText(/Glossary.component/i);

    expect(glossaryComponent).toBeInTheDocument();
  });

  it('All Function call should work properly - part 1', async () => {
    render(<GlossaryPage {...mockProps} />);

    const glossaryComponent = await screen.findByText(/Glossary.component/i);

    const updateGlossary = await screen.findByTestId('updateGlossary');

    expect(glossaryComponent).toBeInTheDocument();

    fireEvent.click(updateGlossary);
  });

  it('updates an inline attribute without navigating or reloading the glossary list', async () => {
    render(<GlossaryPage {...mockProps} />);

    const updateDescription = await screen.findByTestId(
      'updateGlossaryDescription'
    );

    // Ignore the initial list load; only calls caused by the inline update
    // matter for this regression.
    (getGlossariesList as jest.Mock).mockClear();
    mockNavigate.mockClear();

    fireEvent.click(updateDescription);

    await waitFor(() =>
      expect(updateGlossaryWorkingVersion).toHaveBeenCalledWith(
        MOCK_GLOSSARY.id,
        expect.any(Number),
        { description: 'Updated description' }
      )
    );

    expect(mockUpdateActiveGlossary).toHaveBeenCalledWith(
      expect.objectContaining({ workingRevision: 2 })
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getGlossariesList).not.toHaveBeenCalled();
  });

  it('does not refetch the working version when glossary metadata changes', async () => {
    const routeGlossary = {
      ...MOCK_GLOSSARY,
      fullyQualifiedName: 'Business Glossary',
    };
    (
      useGlossaryStoreModule.useGlossaryStore as unknown as jest.Mock
    ).mockImplementation(() => ({
      glossaries: [routeGlossary],
      setGlossaries: mockSetGlossaries,
      activeGlossary: routeGlossary,
      setActiveGlossary: mockSetActiveGlossary,
      updateActiveGlossary: mockUpdateActiveGlossary,
    }));

    const view = render(<GlossaryPage {...mockProps} />);

    await screen.findByText(/Glossary.component/i);
    await waitFor(() => expect(getGlossaryWorkingVersion).toHaveBeenCalled());
    (getGlossaryWorkingVersion as jest.Mock).mockClear();

    (
      useGlossaryStoreModule.useGlossaryStore as unknown as jest.Mock
    ).mockImplementation(() => ({
      glossaries: [{ ...routeGlossary, description: 'Updated description' }],
      setGlossaries: mockSetGlossaries,
      activeGlossary: {
        ...routeGlossary,
        description: 'Updated description',
      },
      setActiveGlossary: mockSetActiveGlossary,
      updateActiveGlossary: mockUpdateActiveGlossary,
    }));

    view.rerender(<GlossaryPage {...mockProps} />);

    expect(getGlossaryWorkingVersion).not.toHaveBeenCalled();

    (
      useGlossaryStoreModule.useGlossaryStore as unknown as jest.Mock
    ).mockImplementation(() => ({
      glossaries: [MOCK_GLOSSARY],
      setGlossaries: mockSetGlossaries,
      activeGlossary: MOCK_GLOSSARY,
      setActiveGlossary: mockSetActiveGlossary,
      updateActiveGlossary: mockUpdateActiveGlossary,
    }));
  });

  it('All Function call should work properly - part 2', async () => {
    render(<GlossaryPage {...mockProps} />);

    const glossaryComponent = await screen.findByText(/Glossary.component/i);

    const handleGlossaryTermUpdate = await screen.findByTestId(
      'handleGlossaryTermUpdate'
    );
    const handleGlossaryTermDelete = await screen.findByTestId(
      'handleGlossaryTermDelete'
    );

    expect(glossaryComponent).toBeInTheDocument();

    fireEvent.click(handleGlossaryTermUpdate);
    fireEvent.click(handleGlossaryTermDelete);
  });

  it('updates a glossary term without refetching page content', async () => {
    render(<GlossaryPage {...mockProps} />);

    const updateDescription = await screen.findByTestId(
      'updateGlossaryTermDescription'
    );
    (getGlossaryTermByFQN as jest.Mock).mockClear();
    (getGlossariesList as jest.Mock).mockClear();
    mockNavigate.mockClear();

    fireEvent.click(updateDescription);

    await waitFor(() =>
      expect(updateGlossaryTermWorkingVersion).toHaveBeenCalledWith(
        MOCK_GLOSSARY.id,
        expect.any(Number),
        expect.objectContaining({ description: 'Updated term description' })
      )
    );

    expect(mockSetActiveGlossary).toHaveBeenCalledWith(
      expect.objectContaining({ workingRevision: 2 })
    );
    expect(getGlossaryTermByFQN).not.toHaveBeenCalled();
    expect(getGlossariesList).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  describe('Render Sad Paths', () => {
    it('shows an error if updating the working term resolves without data', async () => {
      (updateGlossaryTermWorkingVersion as jest.Mock).mockResolvedValue('');
      render(<GlossaryPage {...mockProps} />);
      const handleGlossaryTermUpdate = await screen.findByTestId(
        'handleGlossaryTermUpdate'
      );

      expect(handleGlossaryTermUpdate).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(handleGlossaryTermUpdate);
      });
    });
  });

  describe('handleGlossaryDelete', () => {
    it('should update glossaries list and navigate to first remaining glossary after deletion', async () => {
      const secondGlossary = {
        ...MOCK_GLOSSARY,
        id: 'second-glossary-id',
        name: 'Second Glossary',
        fullyQualifiedName: 'Second Glossary',
      };
      (
        useGlossaryStoreModule.useGlossaryStore as unknown as jest.Mock
      ).mockImplementation(() => ({
        glossaries: [MOCK_GLOSSARY, secondGlossary],
        setGlossaries: mockSetGlossaries,
        activeGlossary: MOCK_GLOSSARY,
        setActiveGlossary: mockSetActiveGlossary,
        updateActiveGlossary: mockUpdateActiveGlossary,
      }));

      render(<GlossaryPage {...mockProps} />);

      const handleGlossaryDelete = await screen.findByTestId(
        'handleGlossaryDelete'
      );

      await act(async () => {
        fireEvent.click(handleGlossaryDelete);
      });

      expect(mockSetGlossaries).toHaveBeenLastCalledWith([secondGlossary]);
      expect(mockNavigate).toHaveBeenCalledWith('/glossary/Second%20Glossary');
    });

    it('should navigate to empty glossary path when no glossaries remain after deletion', async () => {
      (
        useGlossaryStoreModule.useGlossaryStore as unknown as jest.Mock
      ).mockImplementation(() => ({
        glossaries: [MOCK_GLOSSARY],
        setGlossaries: mockSetGlossaries,
        activeGlossary: MOCK_GLOSSARY,
        setActiveGlossary: mockSetActiveGlossary,
        updateActiveGlossary: mockUpdateActiveGlossary,
      }));

      render(<GlossaryPage {...mockProps} />);

      const handleGlossaryDelete = await screen.findByTestId(
        'handleGlossaryDelete'
      );

      await act(async () => {
        fireEvent.click(handleGlossaryDelete);
      });

      expect(mockSetGlossaries).toHaveBeenLastCalledWith([]);
      expect(mockNavigate).toHaveBeenCalledWith('/glossary');
    });

    it('should filter out deleted glossary from list', async () => {
      const glossary1 = {
        ...MOCK_GLOSSARY,
        id: 'glossary-1',
        name: 'Glossary 1',
        fullyQualifiedName: 'Glossary 1',
      };
      const glossary2 = {
        ...MOCK_GLOSSARY,
        name: 'Glossary 2',
        fullyQualifiedName: 'Glossary 2',
      };
      const glossary3 = {
        ...MOCK_GLOSSARY,
        id: 'glossary-3',
        name: 'Glossary 3',
        fullyQualifiedName: 'Glossary 3',
      };

      (
        useGlossaryStoreModule.useGlossaryStore as unknown as jest.Mock
      ).mockImplementation(() => ({
        glossaries: [glossary1, glossary2, glossary3],
        setGlossaries: mockSetGlossaries,
        activeGlossary: glossary2,
        setActiveGlossary: mockSetActiveGlossary,
        updateActiveGlossary: mockUpdateActiveGlossary,
      }));

      render(<GlossaryPage {...mockProps} />);

      const handleGlossaryDelete = await screen.findByTestId(
        'handleGlossaryDelete'
      );

      await act(async () => {
        fireEvent.click(handleGlossaryDelete);
      });

      expect(mockSetGlossaries).toHaveBeenLastCalledWith([
        glossary1,
        glossary3,
      ]);
      expect(mockNavigate).toHaveBeenCalledWith('/glossary/Glossary%201');
    });
  });

  it('should pass entity name as pageTitle to withPageLayout', async () => {
    await act(async () => {
      render(<GlossaryPage {...mockProps} />);
    });

    expect(ResizableLeftPanels).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTitle: 'Business glossary',
      }),
      expect.anything()
    );
  });

  it('should enable the left-panel collapse control for all glossaries', async () => {
    await act(async () => {
      render(<GlossaryPage {...mockProps} />);
    });

    expect(ResizableLeftPanels).toHaveBeenCalledWith(
      expect.objectContaining({
        collapsibleFirstPanel: true,
      }),
      expect.anything()
    );
  });

  describe('CDE route loading', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      setCdeRoute();
      mockGlossaries = [];
      mockActiveGlossary = createCde();
      (
        useGlossaryStoreModule.useGlossaryStore as unknown as jest.Mock
      ).mockImplementation(() => ({
        glossaries: mockGlossaries,
        setGlossaries: mockSetGlossaries,
        activeGlossary: mockActiveGlossary,
        setActiveGlossary: mockSetActiveGlossary,
        updateActiveGlossary: mockUpdateActiveGlossary,
      }));
      (getGlossariesList as jest.Mock).mockResolvedValue({
        data: [],
        paging: { total: 0 },
      });
      (getGlossaryTermsById as jest.Mock).mockResolvedValue(createCde());
      (getGlossaryTermByFQN as jest.Mock).mockResolvedValue(createCde());
      (getGlossaryTermWorkingVersion as jest.Mock).mockResolvedValue(
        createCde()
      );
      (getPublishedGlossaryTerm as jest.Mock).mockResolvedValue(createCde());
    });

    it('starts id, working, and published requests before any resolves', async () => {
      const currentRequest = createDeferred<GlossaryTerm>();
      const workingRequest = createDeferred<GlossaryTerm>();
      const publishedRequest = createDeferred<GlossaryTerm>();
      (getGlossaryTermsById as jest.Mock).mockReturnValue(
        currentRequest.promise
      );
      (getGlossaryTermWorkingVersion as jest.Mock).mockReturnValue(
        workingRequest.promise
      );
      (getPublishedGlossaryTerm as jest.Mock).mockReturnValue(
        publishedRequest.promise
      );

      render(<GlossaryPage {...mockProps} />);

      await waitFor(() => {
        expect(getGlossaryTermsById).toHaveBeenCalledWith('term-id');
        expect(getGlossaryTermWorkingVersion).toHaveBeenCalledWith(
          'term-id',
          '1'
        );
        expect(getPublishedGlossaryTerm).toHaveBeenCalledWith(
          'term-id',
          '1.0',
          '1'
        );
      });

      expect(mockSetActiveGlossary).not.toHaveBeenCalled();

      await act(async () => {
        currentRequest.resolve(createCde());
        workingRequest.reject(createApiError(404));
        publishedRequest.resolve(
          createCde({ entityStatus: EntityStatus.Archived })
        );
        await Promise.allSettled([
          currentRequest.promise,
          workingRequest.promise,
          publishedRequest.promise,
        ]);
      });

      await waitFor(() =>
        expect(mockSetActiveGlossary).toHaveBeenCalledWith(
          expect.objectContaining({ entityStatus: EntityStatus.Archived })
        )
      );

      expect(screen.getByTestId('historical-state')).toHaveTextContent('true');
    });

    it('uses a matching working version for a working-draft route', async () => {
      setCdeRoute(
        '?businessVersion=1.0&parentBusinessVersion=1&termId=term-id&view=working'
      );
      const working = createCde({
        description: 'working',
        entityStatus: EntityStatus.Draft,
      });
      (getGlossaryTermWorkingVersion as jest.Mock).mockResolvedValue(working);

      render(<GlossaryPage {...mockProps} />);

      await waitFor(() =>
        expect(mockSetActiveGlossary).toHaveBeenCalledWith(working)
      );

      expect(screen.getByTestId('historical-state')).toHaveTextContent('false');
    });

    it('uses a matching working version when published lookup fails', async () => {
      const working = createCde({ description: 'working fallback' });
      (getGlossaryTermWorkingVersion as jest.Mock).mockResolvedValue(working);
      (getPublishedGlossaryTerm as jest.Mock).mockRejectedValue(
        createApiError(404)
      );

      render(<GlossaryPage {...mockProps} />);

      await waitFor(() =>
        expect(mockSetActiveGlossary).toHaveBeenCalledWith(working)
      );
    });

    it('navigates to not found when the published version does not match', async () => {
      (getGlossaryTermWorkingVersion as jest.Mock).mockRejectedValue(
        createApiError(404)
      );
      (getPublishedGlossaryTerm as jest.Mock).mockResolvedValue(
        createCde({ businessVersion: '2.0' })
      );

      render(<GlossaryPage {...mockProps} />);

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOT_FOUND, {
          replace: true,
        })
      );
    });

    it.each([
      [403, ROUTES.FORBIDDEN],
      [404, ROUTES.NOT_FOUND],
    ])('maps an id request %s to the expected route', async (status, route) => {
      (getGlossaryTermsById as jest.Mock).mockRejectedValue(
        createApiError(status)
      );

      render(<GlossaryPage {...mockProps} />);

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(route, { replace: true })
      );
    });

    it('navigates to not found when the working request fails unexpectedly', async () => {
      (getGlossaryTermWorkingVersion as jest.Mock).mockRejectedValue(
        createApiError(500)
      );

      render(<GlossaryPage {...mockProps} />);

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(ROUTES.NOT_FOUND, {
          replace: true,
        })
      );
    });

    it('keeps FQN resolution sequential when termId is absent', async () => {
      setCdeRoute('?businessVersion=1.0&parentBusinessVersion=1');
      const currentRequest = createDeferred<GlossaryTerm>();
      const workingRequest = createDeferred<GlossaryTerm>();
      (getGlossaryTermByFQN as jest.Mock).mockReturnValue(
        currentRequest.promise
      );
      (getGlossaryTermWorkingVersion as jest.Mock).mockReturnValue(
        workingRequest.promise
      );

      render(<GlossaryPage {...mockProps} />);

      await waitFor(() => expect(getGlossaryTermByFQN).toHaveBeenCalled());

      expect(getGlossaryTermWorkingVersion).not.toHaveBeenCalled();
      expect(getPublishedGlossaryTerm).not.toHaveBeenCalled();

      await act(async () => {
        currentRequest.resolve(createCde());
        await currentRequest.promise;
      });
      await waitFor(() =>
        expect(getGlossaryTermWorkingVersion).toHaveBeenCalled()
      );

      expect(getPublishedGlossaryTerm).not.toHaveBeenCalled();

      await act(async () => {
        workingRequest.resolve(createCde());
        await workingRequest.promise;
      });
      await waitFor(() => expect(getPublishedGlossaryTerm).toHaveBeenCalled());
    });

    it('loads term details before the glossary list and does not refetch', async () => {
      const glossaryListRequest = createDeferred<{
        data: Glossary[];
        paging: { total: number };
      }>();
      (getGlossariesList as jest.Mock).mockReturnValue(
        glossaryListRequest.promise
      );
      (getGlossaryTermWorkingVersion as jest.Mock).mockRejectedValue(
        createApiError(404)
      );

      render(<GlossaryPage {...mockProps} />);

      await waitFor(() => expect(getGlossaryTermsById).toHaveBeenCalled());

      expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();

      await waitFor(() =>
        expect(mockSetActiveGlossary).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'term-id' })
        )
      );

      expect(
        await screen.findByText(/Glossary.component/i)
      ).toBeInTheDocument();

      await act(async () => {
        glossaryListRequest.resolve({ data: [], paging: { total: 0 } });
        await glossaryListRequest.promise;
      });

      expect(getGlossaryTermsById).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('error-placeholder')).not.toBeInTheDocument();
    });

    it('stops listing after the page containing the route glossary', async () => {
      (getGlossariesList as jest.Mock)
        .mockResolvedValueOnce({
          data: [
            {
              ...MOCK_GLOSSARY,
              fullyQualifiedName: 'Data Dictionary',
              name: 'Data Dictionary',
            },
          ],
          paging: { after: 'next-page', total: 2 },
        })
        .mockResolvedValueOnce({
          data: [{ ...MOCK_GLOSSARY, fullyQualifiedName: 'Other Glossary' }],
          paging: { total: 2 },
        });

      render(<GlossaryPage {...mockProps} />);

      await waitFor(() => expect(mockSetGlossaries).toHaveBeenCalled());

      expect(getGlossariesList).toHaveBeenCalledTimes(1);
    });
  });
});
