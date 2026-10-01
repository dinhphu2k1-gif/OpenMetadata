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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  deleteTechnicalRecord,
  exportTechnicalSnapshot,
  updateTechnicalRecord,
} from '../../rest/technicalDictionaryAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import TechnicalDictionaryPage, {
  isResetBannerVisible,
} from './TechnicalDictionaryPage.component';

const ROW = {
  key: 'term-1',
  termId: 'term-1',
  revision: 3,
  columnName: 'NAME',
  columnFqn: 'ipcas.core.dbo.CUSTOMER.NAME',
  description: 'Tên khách hàng',
  cdeTermId: 'cde-1',
  cdeCode: 'CDE1',
  cdeName: 'Tên khách hàng',
} as unknown as TechnicalDictionaryRow;

const mockContextState = {
  context: {
    glossaryId: 'glossary-1',
    dataDictionaryVersion: '2' as string | null,
    previousDataDictionaryVersion: '1',
    resetAt: undefined as number | undefined,
  },
  dataDictionaryVersion: '2' as string | undefined,
  capabilities: {
    canView: true,
    canEdit: true,
    canImport: true,
    canExport: true,
  },
  isLoading: false,
  error: undefined as string | undefined,
  reload: jest.fn().mockResolvedValue(undefined),
};
const mockReloadRecords = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: false }),
}));
jest.mock('../../hooks/useTechnicalDictionaryContext', () => ({
  useTechnicalDictionaryContext: () => mockContextState,
}));
jest.mock('../../hooks/useTechnicalDictionaryOptions', () => ({
  useTechnicalDictionaryOptions: () => ({
    elementTypes: [],
    generationTypes: [],
    creationMethods: [],
    timeliness: [],
    teams: [{ id: 'team-1', name: 'khcl', type: 'team' }],
    services: [],
    isLoading: false,
  }),
}));
jest.mock('../../hooks/useTechnicalDictionaryRecords', () => ({
  useTechnicalDictionaryRecords: () => ({
    rows: [ROW],
    total: 1,
    isLoading: false,
    failed: false,
    filters: {},
    page: 1,
    pageSize: 25,
    searchText: '',
    setSearchText: jest.fn(),
    setFilters: jest.fn(),
    setPage: jest.fn(),
    setPageSize: jest.fn(),
    reload: mockReloadRecords,
  }),
}));
jest.mock('../../rest/technicalDictionaryAPI', () => ({
  deleteTechnicalRecord: jest.fn().mockResolvedValue(undefined),
  exportTechnicalDictionary: jest.fn(),
  exportTechnicalSnapshot: jest
    .fn()
    .mockResolvedValue({ blob: new Blob(), fileName: 'snapshot.xlsx' }),
  getTechnicalStats: jest.fn().mockResolvedValue({
    totalColumns: 1,
    totalTables: 1,
    totalSources: 1,
    mapped: 1,
  }),
  rebuildTechnicalIndex: jest.fn(),
  updateTechnicalRecord: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('../../components/common/Loader/Loader', () => () => (
  <div>loader</div>
));
jest.mock(
  '../../components/Modals/ConfirmationModal/ConfirmationModal',
  () => ({
    __esModule: true,
    default: ({
      visible,
      header,
      bodyText,
      confirmText,
      onConfirm,
    }: {
      visible: boolean;
      header: string;
      bodyText: string;
      confirmText: string;
      onConfirm: () => void;
    }) =>
      visible ? (
        <div data-testid="confirmation">
          <span>{header}</span>
          <span>{bodyText}</span>
          <button onClick={onConfirm}>{confirmText}</button>
        </div>
      ) : null,
  })
);
jest.mock('./TechnicalDictionaryTable.component', () => ({
  __esModule: true,
  default: ({
    onEdit,
    onDelete,
    onView,
    rows,
  }: {
    rows: TechnicalDictionaryRow[];
    onEdit: (row: TechnicalDictionaryRow) => void;
    onView: (row: TechnicalDictionaryRow) => void;
    onDelete: (row: TechnicalDictionaryRow) => void;
  }) => (
    <div data-testid="table">
      <button onClick={() => onEdit(rows[0])}>edit</button>
      <button onClick={() => onView(rows[0])}>view</button>
      <button onClick={() => onDelete(rows[0])}>delete</button>
    </div>
  ),
}));
jest.mock('./TechnicalDictionaryHeader.component', () => ({
  __esModule: true,
  default: ({ dataDictionaryVersion }: { dataDictionaryVersion?: string }) => (
    <div data-testid="header">{dataDictionaryVersion}</div>
  ),
}));
jest.mock('./TechnicalRecordModal.component', () => ({
  __esModule: true,
  default: ({
    open,
    onSave,
    mode,
  }: {
    open: boolean;
    mode: string;
    onSave: (values: unknown) => void;
  }) =>
    open ? (
      <div data-testid={`record-modal-${mode}`}>
        <button
          onClick={() =>
            onSave({
              rank: 2,
              systemOwnerId: 'team-1',
              elementType: 'DataElementType.AtomicDataElement',
            })
          }>
          save
        </button>
        <button onClick={() => onSave({ cde: null })}>clear-cde</button>
      </div>
    ) : null,
}));
jest.mock('./TechnicalSnapshotsModal.component', () => () => null);
jest.mock('./TechnicalDictionaryToolbar.component', () => () => null);
jest.mock('./TechnicalAddColumnModal.component', () => () => null);
jest.mock(
  '../../components/PageLayoutV1/PageLayoutV1',
  () =>
    ({ children }: { children: React.ReactNode }) =>
      <div>{children}</div>
);
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => () => null
);

describe('TechnicalDictionaryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextState.error = undefined;
    mockContextState.dataDictionaryVersion = '2';
    mockContextState.context.dataDictionaryVersion = '2';
    mockContextState.context.resetAt = undefined;
    mockContextState.capabilities.canEdit = true;
  });

  it('shows an error result instead of a table when the context cannot be loaded', () => {
    mockContextState.error = 'failed';

    render(<TechnicalDictionaryPage isEmbedded />);

    expect(
      screen.getByText('message.technical-dictionary-load-failed')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
  });

  it('explains that the dictionary is unavailable until a Data Dictionary is approved', () => {
    mockContextState.dataDictionaryVersion = undefined;
    mockContextState.context.dataDictionaryVersion = null;

    render(<TechnicalDictionaryPage isEmbedded />);

    expect(
      screen.getByText('message.technical-data-dictionary-not-approved')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
  });

  it('saves the edited values with the revision that was read, without a workflow', async () => {
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(await screen.findByText('save'));

    await waitFor(() => expect(updateTechnicalRecord).toHaveBeenCalledTimes(1));

    expect(updateTechnicalRecord).toHaveBeenCalledWith('term-1', {
      expectedRevision: 3,
      cde: 'cde-1',
      rank: 2,
      elementType: 'DataElementType.AtomicDataElement',
      generationType: undefined,
      creationMethod: undefined,
      timeliness: undefined,
      systemOwnerId: 'team-1',
    });
    expect(mockReloadRecords).toHaveBeenCalled();
  });

  it('clears the CDE when the user clears the selector', async () => {
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(await screen.findByText('clear-cde'));

    await waitFor(() => expect(updateTechnicalRecord).toHaveBeenCalled());

    expect(
      (updateTechnicalRecord as jest.Mock).mock.calls[0][1].cde
    ).toBeUndefined();
  });

  it('deletes a declaration with its revision after confirmation', async () => {
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('delete'));

    expect(deleteTechnicalRecord).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('label.delete'));

    await waitFor(() =>
      expect(deleteTechnicalRecord).toHaveBeenCalledWith('term-1', 3)
    );

    expect(mockReloadRecords).toHaveBeenCalled();
  });

  it('reloads the list and explains a revision conflict', async () => {
    (updateTechnicalRecord as jest.Mock).mockRejectedValueOnce({
      response: { status: 409, data: { code: 'TD_RECORD_REVISION_CONFLICT' } },
    });
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(await screen.findByText('save'));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(
        'message.technical-record-changed-by-someone'
      )
    );

    expect(mockReloadRecords).toHaveBeenCalled();
  });

  it('reloads the context when the record vanished in a reset', async () => {
    (updateTechnicalRecord as jest.Mock).mockRejectedValueOnce({
      response: { status: 404, data: { code: 'TD_RECORD_NOT_FOUND' } },
    });
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(await screen.findByText('save'));

    await waitFor(() => expect(mockContextState.reload).toHaveBeenCalled());

    expect(showErrorToast).toHaveBeenCalledWith(
      'message.technical-dictionary-was-reset'
    );
  });

  it('offers the previous snapshot in the banner after a reset', async () => {
    mockContextState.context.resetAt = Date.now();

    render(<TechnicalDictionaryPage isEmbedded />);

    expect(
      screen.getByTestId('technical-dictionary-reset-banner')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('technical-reset-banner-download'));

    await waitFor(() =>
      expect(exportTechnicalSnapshot).toHaveBeenCalledWith('1')
    );
  });
});

describe('isResetBannerVisible', () => {
  const now = 1_700_000_000_000;
  const DAY = 24 * 60 * 60 * 1000;

  it('shows for a month after a reset', () => {
    expect(isResetBannerVisible(now - 29 * DAY, now, false)).toBe(true);
    expect(isResetBannerVisible(now - 31 * DAY, now, false)).toBe(false);
  });

  it('stays hidden when there was no reset or the user closed it', () => {
    expect(isResetBannerVisible(undefined, now, false)).toBe(false);
    expect(isResetBannerVisible(now, now, true)).toBe(false);
  });
});
