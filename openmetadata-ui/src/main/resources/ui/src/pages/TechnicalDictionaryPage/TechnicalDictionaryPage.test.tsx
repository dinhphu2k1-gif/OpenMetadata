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
  bulkApproveTechnicalRecords,
  bulkRejectTechnicalRecords,
  bulkSubmitTechnicalRecords,
  getTechnicalChangeRequest,
} from '../../rest/technicalDictionaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import TechnicalDictionaryPage from './TechnicalDictionaryPage.component';

const ROW = {
  key: 'term-1',
  termId: 'term-1',
  revision: 3,
  status: 'Approved',
  createdBy: 'maker',
  columnName: 'NAME',
  columnFqn: 'ipcas.core.dbo.CUSTOMER.NAME',
  description: 'Tên khách hàng',
  cdeTermId: 'cde-1',
  cdeCode: 'CDE1',
  cdeName: 'Tên khách hàng',
} as unknown as TechnicalDictionaryRow;

const IN_REVIEW_BY_MAKER = {
  ...ROW,
  key: 'term-2',
  termId: 'term-2',
  revision: 5,
  status: 'In Review',
  columnName: 'AGE',
  createdBy: 'maker',
} as unknown as TechnicalDictionaryRow;
const IN_REVIEW_BY_CHECKER = {
  ...IN_REVIEW_BY_MAKER,
  key: 'term-3',
  termId: 'term-3',
  revision: 7,
  columnName: 'OWN',
  createdBy: 'checker',
} as unknown as TechnicalDictionaryRow;
const DRAFT_ROW = {
  ...ROW,
  key: 'term-5',
  termId: 'term-5',
  revision: 2,
  status: 'Draft',
  columnName: 'NOTE',
  createdBy: 'checker',
} as unknown as TechnicalDictionaryRow;
const OTHER_DRAFT_ROW = {
  ...DRAFT_ROW,
  key: 'term-6',
  termId: 'term-6',
  revision: 4,
  columnName: 'MEMO',
} as unknown as TechnicalDictionaryRow;
const REJECTED_ROW = {
  ...DRAFT_ROW,
  key: 'term-7',
  termId: 'term-7',
  revision: 6,
  status: 'Rejected',
  columnName: 'OLD',
} as unknown as TechnicalDictionaryRow;
const APPROVED_ROW = {
  ...ROW,
  key: 'term-4',
  termId: 'term-4',
  columnName: 'DONE',
} as unknown as TechnicalDictionaryRow;

let mockRows: TechnicalDictionaryRow[] = [ROW];
let mockFilters: Record<string, unknown> = {};

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
    canApprove: true,
    canImport: true,
    canExport: true,
  },
  isLoading: false,
  error: undefined as string | undefined,
  reload: jest.fn().mockResolvedValue(undefined),
};
const mockReloadRecords = jest.fn();
const mockViewSnapshot = jest.fn();
let mockSnapshotVersion: string | undefined;

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: false }),
}));
jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: (selector: (state: any) => unknown) =>
    selector({ currentUser: { name: 'checker' } }),
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
    rows: mockRows,
    total: mockRows.length,
    isLoading: false,
    failed: false,
    filters: mockFilters,
    page: 1,
    pageSize: 25,
    searchText: '',
    snapshotVersion: mockSnapshotVersion,
    viewSnapshot: mockViewSnapshot,
    setSearchText: jest.fn(),
    setFilters: jest.fn(),
    setPage: jest.fn(),
    setPageSize: jest.fn(),
    reload: mockReloadRecords,
  }),
}));
jest.mock('../../rest/technicalDictionaryAPI', () => ({
  deleteTechnicalRecord: jest.fn().mockResolvedValue(undefined),
  getTechnicalChangeRequest: jest.fn(),
  saveTechnicalChangeRequest: jest.fn().mockResolvedValue({ revision: 1 }),
  approveTechnicalChangeRequest: jest.fn().mockResolvedValue({}),
  rejectTechnicalChangeRequest: jest.fn().mockResolvedValue({}),
  submitTechnicalChangeRequest: jest.fn().mockResolvedValue({}),
  withdrawTechnicalChangeRequest: jest.fn().mockResolvedValue({}),
  withdrawTechnicalRecord: jest.fn().mockResolvedValue({}),
  getTechnicalPendingRequests: jest.fn().mockResolvedValue({
    data: [],
    paging: { total: 0, limit: 25, offset: 0 },
    counts: { create: 0, update: 0, delete: 0 },
  }),
  approveTechnicalRecord: jest.fn().mockResolvedValue({}),
  bulkApproveTechnicalRecords: jest.fn(),
  bulkRejectTechnicalRecords: jest.fn(),
  bulkSubmitTechnicalRecords: jest.fn(),
  submitTechnicalRecord: jest.fn().mockResolvedValue({}),
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
  rejectTechnicalRecord: jest.fn().mockResolvedValue({}),
  updateTechnicalRecord: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    isDisabled,
    onPress,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    isDisabled?: boolean;
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} disabled={isDisabled} onClick={onPress}>
      {children}
    </button>
  ),
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
    onView,
    rows,
    bulkActionBar,
    selectedRowKeys,
    onSelectionChange,
  }: {
    rows: TechnicalDictionaryRow[];
    bulkActionBar?: React.ReactNode;
    selectedRowKeys: string[];
    onSelectionChange: (keys: string[]) => void;
    onView: (row: TechnicalDictionaryRow) => void;
  }) => (
    <div data-testid="table">
      <button onClick={() => onView(rows[0])}>open-row</button>
      <button onClick={() => onSelectionChange(rows.map((row) => row.key))}>
        select-all
      </button>
      <span data-testid="selected-keys">{selectedRowKeys.join(',')}</span>
      {bulkActionBar}
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
    onApprove,
    onReject,
    onSubmit,
    onEdit,
    onDelete,
  }: {
    open: boolean;
    mode: string;
    onSave: (values: unknown) => void;
    onApprove?: () => void;
    onReject?: () => void;
    onSubmit?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
  }) =>
    open ? (
      <div data-testid={`record-modal-${mode}`}>
        <button
          onClick={() =>
            onSave({
              rank: 2,
              systemOwners: [{ id: 'team-1', type: 'team' }],
              elementType: 'DataElementType.AtomicDataElement',
            })
          }>
          save
        </button>
        <button onClick={() => onSave({ cde: null })}>clear-cde</button>
        {onEdit && <button onClick={onEdit}>edit-modal</button>}
        {onDelete && <button onClick={onDelete}>delete-modal</button>}
        {onApprove && <button onClick={onApprove}>approve-modal</button>}
        {onReject && <button onClick={onReject}>reject-modal</button>}
        {onSubmit && <button onClick={onSubmit}>submit-modal</button>}
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
    mockContextState.capabilities.canApprove = true;
    ROW.status = 'Approved';
    ROW.createdBy = 'maker';
    mockRows = [ROW];
    mockFilters = {};
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

  it('offers to submit only a draft, and only to someone who may edit', () => {
    ROW.status = 'In Review';
    const { unmount } = render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('open-row'));

    expect(screen.queryByText('submit-modal')).not.toBeInTheDocument();

    unmount();
    ROW.status = 'Rejected';
    const rejected = render(<TechnicalDictionaryPage isEmbedded />);
    fireEvent.click(screen.getByText('open-row'));

    expect(screen.queryByText('submit-modal')).not.toBeInTheDocument();

    rejected.unmount();
    ROW.status = 'Draft';
    mockContextState.capabilities.canEdit = false;
    render(<TechnicalDictionaryPage isEmbedded />);
    fireEvent.click(screen.getByText('open-row'));

    expect(screen.queryByText('submit-modal')).not.toBeInTheDocument();
  });

  it('does not offer the edit form to a user who cannot edit', () => {
    mockContextState.capabilities.canEdit = false;
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('open-row'));

    expect(screen.queryByText('edit-modal')).not.toBeInTheDocument();
    expect(screen.queryByText('delete-modal')).not.toBeInTheDocument();
  });
});

describe('TechnicalDictionaryPage record pages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextState.error = undefined;
    mockContextState.dataDictionaryVersion = '2';
    mockSnapshotVersion = undefined;
    ROW.status = 'Approved';
    mockRows = [ROW];
    mockFilters = {};
  });

  it('opens a record on its own page, carrying the version', () => {
    render(<TechnicalDictionaryPage isEmbedded />);
    fireEvent.click(screen.getByText('open-row'));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/technical-dictionary/${ROW.termId}?businessVersion=2`
    );
  });

  it('opens a pending change as its working view', () => {
    mockRows = [{ ...ROW, rowRole: 'CHANGE', hasPendingChange: true }];
    render(<TechnicalDictionaryPage isEmbedded />);
    fireEvent.click(screen.getByText('open-row'));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/technical-dictionary/${ROW.termId}?businessVersion=2&view=working`
    );
  });

  it('opens a frozen record under its replaced version', () => {
    mockSnapshotVersion = '1';
    render(<TechnicalDictionaryPage isEmbedded />);
    fireEvent.click(screen.getByText('open-row'));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/technical-dictionary/${ROW.termId}?businessVersion=1`
    );
  });
});

describe('TechnicalDictionaryPage snapshot view', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextState.error = undefined;
    mockContextState.dataDictionaryVersion = '2';
    mockContextState.context.dataDictionaryVersion = '2';
    mockContextState.context.resetAt = undefined;
    mockContextState.capabilities.canEdit = true;
    mockContextState.capabilities.canApprove = true;
    ROW.status = 'Approved';
    mockRows = [ROW];
    mockFilters = {};
  });

  afterEach(() => {
    mockSnapshotVersion = undefined;
  });

  it('offers no way to act on a frozen row, even to an editor and approver', () => {
    mockSnapshotVersion = '1';

    render(<TechnicalDictionaryPage isEmbedded />);
    fireEvent.click(screen.getByText('select-all'));

    expect(screen.queryByTestId('technical-bulk-bar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('open-row'));

    expect(screen.queryByText('edit-modal')).not.toBeInTheDocument();
    expect(screen.queryByText('delete-modal')).not.toBeInTheDocument();
    expect(screen.queryByText('approve-modal')).not.toBeInTheDocument();
    expect(getTechnicalChangeRequest).not.toHaveBeenCalled();
  });
});

describe('TechnicalDictionaryPage bulk review', () => {
  const bulkResult = (
    overrides: Partial<{
      succeeded: number;
      failed: number;
      results: unknown[];
    }> = {}
  ) => ({
    succeeded: 2,
    failed: 0,
    results: [
      { termId: 'term-1', outcome: 'SUCCEEDED' },
      { termId: 'term-2', outcome: 'SUCCEEDED' },
    ],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockContextState.error = undefined;
    mockContextState.dataDictionaryVersion = '2';
    mockContextState.context.dataDictionaryVersion = '2';
    mockContextState.context.resetAt = undefined;
    mockContextState.capabilities.canEdit = true;
    mockContextState.capabilities.canApprove = true;
    ROW.status = 'In Review';
    mockRows = [ROW, IN_REVIEW_BY_MAKER, IN_REVIEW_BY_CHECKER, APPROVED_ROW];
    mockFilters = {};
    (bulkApproveTechnicalRecords as jest.Mock).mockResolvedValue(bulkResult());
    (bulkRejectTechnicalRecords as jest.Mock).mockResolvedValue(bulkResult());
    (bulkSubmitTechnicalRecords as jest.Mock).mockResolvedValue(bulkResult());
  });

  afterEach(() => {
    ROW.status = 'Approved';
  });

  it('shows the bar only once a row is ticked and only to an editor or approver', () => {
    const { unmount } = render(<TechnicalDictionaryPage isEmbedded />);

    expect(screen.queryByTestId('technical-bulk-bar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('select-all'));

    expect(screen.getByTestId('technical-bulk-bar')).toBeInTheDocument();

    unmount();
    mockContextState.capabilities.canApprove = false;
    mockContextState.capabilities.canEdit = false;
    render(<TechnicalDictionaryPage isEmbedded />);
    fireEvent.click(screen.getByText('select-all'));

    expect(screen.queryByTestId('technical-bulk-bar')).not.toBeInTheDocument();
  });

  it('offers no action when no ticked row can be reviewed by this user', () => {
    mockRows = [IN_REVIEW_BY_CHECKER, APPROVED_ROW];
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));

    expect(
      screen.queryByTestId('technical-bulk-approve')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('technical-bulk-reject')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('technical-bulk-submit')
    ).not.toBeInTheDocument();
    expect(screen.getByText('message.bulk-no-actions')).toBeInTheDocument();
  });

  it('confirms and approves only the ticked rows this user may review', async () => {
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByTestId('technical-bulk-approve'));

    expect(bulkApproveTechnicalRecords).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('save-button'));

    await waitFor(() =>
      expect(bulkApproveTechnicalRecords).toHaveBeenCalledWith([
        { id: 'term-1', expectedRevision: 3 },
        { id: 'term-2', expectedRevision: 5 },
      ])
    );

    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.technical-bulk-approved'
    );
    expect(mockReloadRecords).toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.queryByTestId('technical-bulk-bar')).not.toBeInTheDocument()
    );

    expect(screen.getByTestId('selected-keys')).toBeEmptyDOMElement();
  });

  it('rejects the ticked rows without a reason', async () => {
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByTestId('technical-bulk-reject'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('save-button'));

    await waitFor(() =>
      expect(bulkRejectTechnicalRecords).toHaveBeenCalledWith([
        { id: 'term-1', expectedRevision: 3 },
        { id: 'term-2', expectedRevision: 5 },
      ])
    );

    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.technical-bulk-rejected'
    );
  });

  it('lists what failed instead of a toast when a record could not be reviewed', async () => {
    (bulkApproveTechnicalRecords as jest.Mock).mockResolvedValue(
      bulkResult({
        succeeded: 1,
        failed: 1,
        results: [
          { termId: 'term-1', outcome: 'SUCCEEDED' },
          {
            termId: 'term-2',
            outcome: 'FAILED',
            code: 'TD_RANK_DUPLICATE',
            message: "Rank 1 of this CDE is already held by Column 'x'",
          },
        ],
      })
    );
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByTestId('technical-bulk-approve'));
    fireEvent.click(screen.getByTestId('save-button'));

    const result = await screen.findByTestId('technical-bulk-result-list');

    expect(result).toHaveTextContent('NAME');
    expect(result).toHaveTextContent(
      "Rank 1 of this CDE is already held by Column 'x'"
    );
    expect(showSuccessToast).not.toHaveBeenCalled();
    expect(mockReloadRecords).toHaveBeenCalled();
    expect(screen.getByTestId('technical-bulk-result-AGE')).toHaveClass(
      'tech-review-result--failed'
    );
  });

  it('reloads the context when a record vanished in a reset', async () => {
    (bulkApproveTechnicalRecords as jest.Mock).mockResolvedValue(
      bulkResult({
        succeeded: 0,
        failed: 2,
        results: [
          {
            termId: 'term-1',
            outcome: 'FAILED',
            code: 'TD_RECORD_NOT_FOUND',
            message: 'gone',
          },
          {
            termId: 'term-2',
            outcome: 'FAILED',
            code: 'TD_RECORD_NOT_FOUND',
            message: 'gone',
          },
        ],
      })
    );
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByTestId('technical-bulk-approve'));
    fireEvent.click(screen.getByTestId('save-button'));

    await waitFor(() => expect(mockContextState.reload).toHaveBeenCalled());
  });

  it('keeps the selection and reports an error when the request itself fails', async () => {
    (bulkApproveTechnicalRecords as jest.Mock).mockRejectedValue({
      response: { status: 403, data: { message: 'forbidden' } },
    });
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByTestId('technical-bulk-approve'));
    fireEvent.click(screen.getByTestId('save-button'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(screen.getByTestId('technical-bulk-bar')).toBeInTheDocument();
  });

  it('submits only the ticked drafts', async () => {
    mockRows = [DRAFT_ROW, OTHER_DRAFT_ROW, ROW, APPROVED_ROW];
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByTestId('technical-bulk-submit'));

    fireEvent.click(screen.getByTestId('save-button'));

    await waitFor(() =>
      expect(bulkSubmitTechnicalRecords).toHaveBeenCalledWith([
        { id: 'term-5', expectedRevision: 2 },
        { id: 'term-6', expectedRevision: 4 },
      ])
    );

    expect(showSuccessToast).toHaveBeenCalledWith(
      'message.technical-bulk-submitted'
    );
    expect(bulkApproveTechnicalRecords).not.toHaveBeenCalled();
    expect(mockReloadRecords).toHaveBeenCalled();
  });

  it('leaves ticked rejected records out of the submission', async () => {
    mockRows = [DRAFT_ROW, REJECTED_ROW, ROW, APPROVED_ROW];
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByTestId('technical-bulk-submit'));
    fireEvent.click(screen.getByTestId('save-button'));

    await waitFor(() =>
      expect(bulkSubmitTechnicalRecords).toHaveBeenCalledWith([
        { id: 'term-5', expectedRevision: 2 },
      ])
    );
  });

  it('offers no action for ticked rejected records', () => {
    mockRows = [REJECTED_ROW];
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));

    expect(
      screen.queryByTestId('technical-bulk-submit')
    ).not.toBeInTheDocument();
    expect(screen.getByText('message.bulk-no-actions')).toBeInTheDocument();
  });

  it('lists the drafts that could not be submitted', async () => {
    mockRows = [DRAFT_ROW, OTHER_DRAFT_ROW];
    (bulkSubmitTechnicalRecords as jest.Mock).mockResolvedValue(
      bulkResult({
        succeeded: 1,
        failed: 1,
        results: [
          { termId: 'term-5', outcome: 'SUCCEEDED' },
          {
            termId: 'term-6',
            outcome: 'FAILED',
            code: 'TD_CDE_SCOPE_NOT_ACTIVE',
            message: 'The CDE is no longer approved',
          },
        ],
      })
    );
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByTestId('technical-bulk-submit'));
    fireEvent.click(screen.getByTestId('save-button'));

    const result = await screen.findByTestId('technical-bulk-result-list');

    expect(result).toHaveTextContent('The CDE is no longer approved');
    expect(showSuccessToast).not.toHaveBeenCalled();
  });

  it('leaves Submit out when no ticked row is a draft', () => {
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));

    expect(
      screen.queryByTestId('technical-bulk-submit')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('technical-bulk-approve')).toBeEnabled();
    expect(
      screen.queryByText('message.bulk-no-actions')
    ).not.toBeInTheDocument();
  });

  it('shows one chip for each status among the ticked rows', () => {
    mockRows = [DRAFT_ROW, ROW, IN_REVIEW_BY_MAKER, APPROVED_ROW];
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));

    expect(
      screen
        .getByTestId('technical-bulk-bar')
        .querySelectorAll('.bulk-selection-chip')
    ).toHaveLength(3);
  });

  it('gives an approver who cannot edit no Submit, and an editor who cannot approve no Approve or Reject', () => {
    mockContextState.capabilities.canEdit = false;
    const { unmount } = render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));

    expect(
      screen.queryByTestId('technical-bulk-submit')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('technical-bulk-approve')).toBeInTheDocument();

    unmount();
    mockContextState.capabilities.canEdit = true;
    mockContextState.capabilities.canApprove = false;
    mockRows = [...mockRows, DRAFT_ROW];
    render(<TechnicalDictionaryPage isEmbedded />);
    fireEvent.click(screen.getByText('select-all'));

    expect(screen.getByTestId('technical-bulk-submit')).toBeInTheDocument();
    expect(
      screen.queryByTestId('technical-bulk-approve')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('technical-bulk-reject')
    ).not.toBeInTheDocument();
  });

  it('clears the selection with the bar action and when the filters change', () => {
    const { rerender } = render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('select-all'));
    fireEvent.click(screen.getByTestId('technical-bulk-clear'));

    expect(screen.queryByTestId('technical-bulk-bar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('select-all'));

    expect(screen.getByTestId('technical-bulk-bar')).toBeInTheDocument();

    mockFilters = { q: 'customer' };
    rerender(<TechnicalDictionaryPage isEmbedded />);

    expect(screen.queryByTestId('technical-bulk-bar')).not.toBeInTheDocument();
  });
});
