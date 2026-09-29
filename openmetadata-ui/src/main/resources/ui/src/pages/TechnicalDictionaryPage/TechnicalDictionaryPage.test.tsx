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
  createGlossaryTermWorkingVersion,
  transitionGlossaryTermWorkflow,
  updateGlossaryTermWorkingVersion,
} from '../../rest/glossaryAPI';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import TechnicalDictionaryPage from './TechnicalDictionaryPage.component';

const ROW = {
  key: 'term-1:2.0:working',
  termId: 'term-1',
  businessVersion: '2.0',
  parentBusinessVersion: '2',
  status: 'Draft',
  recordType: 'working',
  workingRevision: 3,
  columnName: 'NAME',
  columnFqn: 'ipcas.core.dbo.CUSTOMER.NAME',
  description: 'Tên khách hàng',
  cdeRelation: undefined,
} as unknown as TechnicalDictionaryRow;

const mockCatalogState = {
  glossary: { id: 'glossary-1' },
  catalog: {
    businessVersion: '2',
    status: 'Draft',
    isWorking: true,
    isReadOnly: false,
    workingRevision: 1,
  },
  versions: ['2'],
  capabilities: {
    canViewWorking: true,
    canEditWorking: true,
    canSubmit: true,
    canApprove: true,
    canReject: true,
    canCreateVersion: true,
    canArchive: false,
  },
  isLoading: false,
  error: undefined as string | undefined,
  selectVersion: jest.fn(),
  reload: jest.fn().mockResolvedValue(undefined),
};
const mockReloadRecords = jest.fn();

jest.mock('../../hooks/useTechnicalDictionaryCatalog', () => ({
  useTechnicalDictionaryCatalog: () => mockCatalogState,
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
jest.mock('../../rest/glossaryAPI', () => ({
  createGlossaryTermWorkingVersion: jest.fn().mockResolvedValue({}),
  transitionGlossaryTermWorkflow: jest.fn().mockResolvedValue({}),
  transitionGlossaryWorkflow: jest.fn().mockResolvedValue({}),
  updateGlossaryTermWorkingVersion: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../rest/technicalDictionaryAPI', () => ({
  exportTechnicalDictionary: jest.fn(),
  getTechnicalBootstrapJobs: jest.fn().mockResolvedValue([]),
  getTechnicalStats: jest.fn().mockResolvedValue({ totalColumns: 1 }),
  retryTechnicalBootstrapJob: jest.fn(),
}));
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('../../components/common/Loader/Loader', () => () => (
  <div>loader</div>
));
jest.mock('./TechnicalDictionaryTable.component', () => ({
  __esModule: true,
  default: ({
    onSubmit,
    onApprove,
    onReject,
    onReopen,
    onEdit,
    onCreateVersion,
    rows,
  }: {
    rows: TechnicalDictionaryRow[];
    onSubmit: (row: TechnicalDictionaryRow) => void;
    onApprove: (row: TechnicalDictionaryRow) => void;
    onReject: (row: TechnicalDictionaryRow) => void;
    onReopen: (row: TechnicalDictionaryRow) => void;
    onEdit: (row: TechnicalDictionaryRow) => void;
    onCreateVersion: (row: TechnicalDictionaryRow) => void;
  }) => (
    <div data-testid="table">
      <button onClick={() => onSubmit(rows[0])}>submit</button>
      <button onClick={() => onApprove(rows[0])}>approve</button>
      <button onClick={() => onReject(rows[0])}>reject</button>
      <button onClick={() => onReopen(rows[0])}>reopen</button>
      <button onClick={() => onEdit(rows[0])}>edit</button>
      <button onClick={() => onCreateVersion(rows[0])}>create-version</button>
    </div>
  ),
}));
jest.mock('./TechnicalDictionaryHeader.component', () => ({
  __esModule: true,
  default: () => <div data-testid="header" />,
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
jest.mock('./TechnicalBulkActionModal.component', () => () => null);
jest.mock('./TechnicalImportModal.component', () => () => null);
jest.mock('./TechnicalDictionaryToolbar.component', () => () => null);
jest.mock('./TechnicalBootstrapStatus.component', () => () => null);
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
    mockCatalogState.error = undefined;
  });

  it('shows a not-found result instead of a table when the catalog cannot be resolved', () => {
    mockCatalogState.error = 'notFound';

    render(<TechnicalDictionaryPage isEmbedded />);

    expect(
      screen.getByText('message.technical-dictionary-not-found')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('table')).not.toBeInTheDocument();
  });

  it('runs record workflow actions against the record scope with its working revision', async () => {
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('submit'));
    fireEvent.click(screen.getByText('approve'));
    fireEvent.click(screen.getByText('reject'));
    fireEvent.click(screen.getByText('reopen'));

    await waitFor(() =>
      expect(transitionGlossaryTermWorkflow).toHaveBeenCalledTimes(4)
    );

    expect(transitionGlossaryTermWorkflow).toHaveBeenCalledWith(
      'term-1',
      'submit',
      { expectedRevision: 3 },
      '2'
    );
    expect(transitionGlossaryTermWorkflow).toHaveBeenCalledWith(
      'term-1',
      'approve',
      { expectedRevision: 3 },
      '2'
    );
    expect(mockReloadRecords).toHaveBeenCalled();
  });

  it('creates the next minor version of a record inside the same catalog version', async () => {
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('create-version'));

    await waitFor(() =>
      expect(createGlossaryTermWorkingVersion).toHaveBeenCalledWith(
        'term-1',
        '2.1',
        '2'
      )
    );
  });

  it('saves only editable fields and never sends server-owned extension keys', async () => {
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(await screen.findByText('save'));

    await waitFor(() =>
      expect(updateGlossaryTermWorkingVersion).toHaveBeenCalledTimes(1)
    );
    const [termId, revision, payload, scope] = (
      updateGlossaryTermWorkingVersion as jest.Mock
    ).mock.calls[0];

    expect(termId).toBe('term-1');
    expect(revision).toBe(3);
    expect(scope).toBe('2');
    expect(Object.keys(payload.extension).sort()).toEqual([
      'survivorshipRank',
      'systemOwner',
    ]);
    expect(payload.extension.systemOwner).toMatchObject({
      id: 'team-1',
      type: 'team',
    });
    expect(payload.tags).toHaveLength(1);
    expect(payload.tags[0].tagFQN).toBe('DataElementType.AtomicDataElement');
    expect(payload.owners).toEqual([]);
  });

  it('clears the CDE relation when the user clears the selector', async () => {
    render(<TechnicalDictionaryPage isEmbedded />);

    fireEvent.click(screen.getByText('edit'));
    fireEvent.click(await screen.findByText('clear-cde'));

    await waitFor(() =>
      expect(updateGlossaryTermWorkingVersion).toHaveBeenCalled()
    );

    expect(
      (updateGlossaryTermWorkingVersion as jest.Mock).mock.calls[0][2]
        .relatedTerms
    ).toEqual([]);
  });
});
