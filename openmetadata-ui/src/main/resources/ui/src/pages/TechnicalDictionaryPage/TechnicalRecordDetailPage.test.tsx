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
  approveTechnicalChangeRequest,
  getTechnicalChangeRequest,
  getTechnicalRecord,
  getTechnicalSnapshotRecord,
  saveTechnicalChangeRequest,
  submitTechnicalRecord,
  updateTechnicalRecord,
} from '../../rest/technicalDictionaryAPI';
import TechnicalRecordDetailPage from './TechnicalRecordDetailPage.component';

let mockSearch = '';
const mockCapabilities = { canEdit: true, canApprove: true };

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useParams: () => ({ termId: 'term-1' }),
  useSearchParams: () => [new URLSearchParams(mockSearch)],
}));
jest.mock('../../hooks/useTechnicalDictionaryContext', () => ({
  useTechnicalDictionaryContext: () => ({
    dataDictionaryVersion: '2',
    capabilities: mockCapabilities,
    isLoading: false,
  }),
}));
jest.mock('../../hooks/useTechnicalDictionaryOptions', () => ({
  useTechnicalDictionaryOptions: () => ({
    elementTypes: [],
    generationTypes: [],
    creationMethods: [],
    timeliness: [],
    isLoading: false,
  }),
}));
jest.mock('./TechnicalVersionBadges.component', () => () => (
  <span data-testid="badges" />
));
jest.mock('./TechnicalHistoryPanel.component', () => () => (
  <div data-testid="history-panel" />
));
jest.mock(
  '../../components/Modals/ConfirmationModal/ConfirmationModal',
  () => () => null
);
jest.mock(
  '../../components/Glossary/CDESelector/CDESelector.component',
  () => () => null
);
jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: (selector: (state: unknown) => unknown) =>
    selector({ currentUser: { name: 'checker' } }),
}));
jest.mock(
  '../../components/common/TagSelectableList/TagSelectableList.component',
  () => ({
    TagSelectableList: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  })
);
jest.mock(
  '../../components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  })
);
jest.mock('../../components/Tag/TagsViewer/TagsViewer', () => () => null);
jest.mock(
  '../../components/Glossary/CDESelectableList/CDESelectableList.component',
  () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  })
);
jest.mock(
  '../../components/common/ReviewActionConfirmModal/ReviewActionConfirmModal.component',
  () =>
    ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
      open ? <button data-testid="confirm-review" onClick={onConfirm} /> : null
);
jest.mock('../../rest/technicalDictionaryAPI', () => ({
  approveTechnicalChangeRequest: jest.fn().mockResolvedValue({}),
  submitTechnicalRecord: jest.fn().mockResolvedValue({}),
  updateTechnicalRecord: jest.fn().mockResolvedValue({}),
  saveTechnicalChangeRequest: jest.fn().mockResolvedValue({ revision: 1 }),
  getTechnicalChangeRequest: jest.fn(),
  exportTechnicalSnapshot: jest.fn(),
  getTechnicalRecord: jest.fn(),
  getTechnicalRecordVersions: jest
    .fn()
    .mockResolvedValue({ data: ['1'], currentRecordId: 'term-1' }),
  getTechnicalSnapshotRecord: jest.fn(),
}));
jest.mock('../../rest/glossaryAPI', () => ({
  getGlossaryTermsById: jest.fn(),
}));
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
jest.mock(
  '../../components/common/CopyToClipboardButton/CopyToClipboardButton',
  () => ({ CopyToClipboardButton: () => null })
);
jest.mock(
  '../../components/Glossary/GlossaryTerms/tabs/SurvivorshipRules/SurvivorshipBadge.component',
  () => () => <span data-testid="rank" />
);
jest.mock(
  '../../components/Glossary/GlossaryTermTab/DictionaryCellRenderers',
  () => ({
    renderDictionaryPastelTag: (label: string) => <span>{label}</span>,
  })
);

const RECORD = {
  termId: 'term-1',
  columnKey: 'key',
  columnFqn: 'svc.db.sch.KH.ten',
  service: 'Oracle_sandbox',
  database: 'ORCLPDB1',
  schema: 'core_kh',
  table: 'KH',
  column: 'ten',
  dataType: 'varchar2(100)',
  sourceStatus: 'Available',
  revision: 1,
  status: 'Approved',
  cde: { id: 'cde-1', code: 'CDE1', name: 'Tên khách hàng' },
  rank: 1,
  systemOwners: [{ id: 'team-1', name: 'Ban CNTT', type: 'team' }],
};

describe('TechnicalRecordDetailPage', () => {
  beforeEach(() => {
    mockSearch = '';
    mockCapabilities.canEdit = true;
    mockCapabilities.canApprove = true;
    jest.clearAllMocks();
  });

  it('shows the record in its sections', async () => {
    (getTechnicalRecord as jest.Mock).mockResolvedValue(RECORD);
    render(<TechnicalRecordDetailPage />);

    expect(
      await screen.findByTestId('technical-record-title')
    ).toHaveTextContent('ten');
    expect(screen.getByText('ORCLPDB1 / core_kh / KH')).toBeInTheDocument();
    expect(screen.getByText('Ban CNTT')).toBeInTheDocument();
    expect(screen.getByTestId('cde-code-CDE1')).toBeInTheDocument();
  });

  it('explains a record that no longer exists', async () => {
    (getTechnicalRecord as jest.Mock).mockRejectedValue({
      response: { status: 404 },
    });
    render(<TechnicalRecordDetailPage />);

    expect(
      await screen.findByTestId('technical-record-detail-error')
    ).toBeInTheDocument();
  });

  it('offers Edit on a current approved record and reads history from its tab', async () => {
    (getTechnicalRecord as jest.Mock).mockResolvedValue(RECORD);
    render(<TechnicalRecordDetailPage />);

    expect(
      await screen.findByTestId('technical-record-create-change')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('technical-record-history-tab'));

    expect(screen.getByTestId('history-panel')).toBeInTheDocument();
  });

  it('reads a replaced version by its businessVersion, read only', async () => {
    mockSearch = 'businessVersion=1';
    (getTechnicalSnapshotRecord as jest.Mock).mockResolvedValue(RECORD);
    render(<TechnicalRecordDetailPage />);

    expect(
      await screen.findByTestId('technical-record-download')
    ).toBeInTheDocument();
    expect(getTechnicalSnapshotRecord).toHaveBeenCalledWith('1', 'term-1');
    expect(screen.queryByTestId('technical-edit-rank')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('technical-record-history-tab')
    ).not.toBeInTheDocument();
  });

  it('lets another reviewer approve a change that is in review', async () => {
    mockSearch = 'businessVersion=2&view=working';
    (getTechnicalRecord as jest.Mock).mockResolvedValue({
      ...RECORD,
      hasPendingChange: true,
    });
    (getTechnicalChangeRequest as jest.Mock).mockResolvedValue({
      id: 'change-1',
      recordId: 'term-1',
      operation: 'UPDATE',
      baseRevision: 1,
      status: 'InReview',
      revision: 4,
      createdBy: 'maker',
      approvedRecord: RECORD,
      proposedRecord: { ...RECORD, rank: 2 },
    });
    render(<TechnicalRecordDetailPage />);

    fireEvent.click(await screen.findByTestId('technical-record-approve'));
    fireEvent.click(screen.getByTestId('confirm-review'));

    await waitFor(() =>
      expect(approveTechnicalChangeRequest).toHaveBeenCalledWith('term-1', 4)
    );
  });

  it('sends a draft for approval with the revision on screen', async () => {
    (getTechnicalRecord as jest.Mock).mockResolvedValue({
      ...RECORD,
      status: 'Draft',
      revision: 7,
    });
    render(<TechnicalRecordDetailPage />);

    fireEvent.click(await screen.findByTestId('technical-record-submit'));
    fireEvent.click(screen.getByTestId('confirm-review'));

    await waitFor(() =>
      expect(submitTechnicalRecord).toHaveBeenCalledWith('term-1', 7)
    );
  });

  it('creates a change draft from an approved record instead of editing it', async () => {
    (getTechnicalRecord as jest.Mock).mockResolvedValue(RECORD);
    render(<TechnicalRecordDetailPage />);

    expect(screen.queryByTestId('technical-edit-rank')).not.toBeInTheDocument();

    fireEvent.click(
      await screen.findByTestId('technical-record-create-change')
    );

    await waitFor(() =>
      expect(saveTechnicalChangeRequest).toHaveBeenCalledWith(
        'term-1',
        expect.objectContaining({ operation: 'UPDATE', expectedRevision: 1 })
      )
    );
  });

  it('edits the rank of a draft in place and saves it with the check button', async () => {
    (getTechnicalRecord as jest.Mock).mockResolvedValue({
      ...RECORD,
      status: 'Draft',
    });
    render(<TechnicalRecordDetailPage />);

    fireEvent.click(await screen.findByTestId('technical-edit-rank'));
    fireEvent.click(await screen.findByTestId('technical-rank-save'));

    await waitFor(() =>
      expect(updateTechnicalRecord).toHaveBeenCalledWith(
        'term-1',
        expect.objectContaining({ rank: 1, expectedRevision: 1 })
      )
    );
  });

  it('gives a reviewer no way to approve their own change', async () => {
    mockSearch = 'businessVersion=2&view=working';
    (getTechnicalRecord as jest.Mock).mockResolvedValue({
      ...RECORD,
      hasPendingChange: true,
    });
    (getTechnicalChangeRequest as jest.Mock).mockResolvedValue({
      id: 'change-1',
      recordId: 'term-1',
      operation: 'UPDATE',
      baseRevision: 1,
      status: 'InReview',
      revision: 4,
      createdBy: 'checker',
      approvedRecord: RECORD,
      proposedRecord: RECORD,
    });
    render(<TechnicalRecordDetailPage />);

    await screen.findByTestId('technical-record-title');

    expect(
      screen.queryByTestId('technical-record-approve')
    ).not.toBeInTheDocument();
  });
});
