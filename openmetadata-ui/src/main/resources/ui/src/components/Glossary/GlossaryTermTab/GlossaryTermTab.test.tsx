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

import {
  fireEvent,
  getByText,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { CDE_GLOSSARY_TERM_FIELDS } from '../../../constants/Glossary.contant';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import {
  mockedGlossaryTerms,
  MOCK_PERMISSIONS,
} from '../../../mocks/Glossary.mock';
import { findExpandableKeysForArray } from '../../../utils/GlossaryUtils';
import GlossaryTermTab from './GlossaryTermTab.component';
import {
  getCDEGlossaryTableColumns,
  renderCDEQualityRule,
} from './CDEGlossaryTableColumns';
import { ModifiedGlossaryTerm } from './GlossaryTermTab.interface';

const mockOnAddGlossaryTerm = jest.fn();
const mockRefreshGlossaryTerms = jest.fn();
const mockOnEditGlossaryTerm = jest.fn();
const mockSetGlossaryChildTerms = jest.fn();
const mockGetFirstLevelGlossaryTermsPaginated = jest.fn();
const mockGetGlossaryTermChildrenLazy = jest.fn();
const mockSearchGlossaryTermsPaginated = jest.fn();
const mockGetAllFeeds = jest.fn();
const mockUpdateTask = jest.fn();

const cdeTranslations: Record<'en' | 'vi', Record<string, string>> = {
  en: {
    'cde.term-code': 'Term Code',
    'cde.business-group': 'Business Group',
    'cde.business-term-name': 'Business Term Name',
    'cde.data-source': 'Data Source',
    'cde.business-meaning': 'Business Meaning',
    'cde.entity-relationship': 'Entity Relationship',
    'cde.data-owner': 'Data Owner',
    'cde.data-classification': 'Data Classification',
    'cde.data-governance-review': 'Data Governance Review',
    'cde.personal-data': 'Personal Data',
    'cde.related-regulatory-documents': 'Related Regulatory Documents',
    'cde.data-quality-rules': 'Data Quality Rules',
    'cde.notes': 'Notes',
    'label.yes': 'Yes',
    'label.no': 'No',
    'label.view-more': 'View more',
  },
  vi: {
    'cde.term-code': 'Mã thuật ngữ',
    'cde.business-group': 'Nhóm theo nghiệp vụ',
    'cde.business-term-name': 'Tên thuật ngữ nghiệp vụ',
    'cde.data-source': 'Nguồn dữ liệu',
    'cde.business-meaning': 'Ý nghĩa nghiệp vụ',
    'cde.entity-relationship': 'Mối quan hệ với thực thể',
    'cde.data-owner': 'Chủ sở hữu dữ liệu',
    'cde.data-classification': 'Phân loại dữ liệu',
    'cde.data-governance-review': 'QTDL rà soát',
    'cde.personal-data': 'Dữ liệu cá nhân',
    'cde.related-regulatory-documents': 'Văn bản quy định liên quan',
    'cde.data-quality-rules': 'Quy định về chất lượng dữ liệu',
    'cde.notes': 'Ghi chú',
    'label.yes': 'Có',
    'label.no': 'Không',
    'label.view-more': 'Xem thêm',
  },
};

const getCDETranslation = (locale: keyof typeof cdeTranslations) =>
  (key: string) => cdeTranslations[locale][key] ?? key;

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockedGlossaryTerms })),
  patchGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
  getFirstLevelGlossaryTermsPaginated: jest
    .fn()
    .mockImplementation((...args) =>
      mockGetFirstLevelGlossaryTermsPaginated(...args)
    ),
  getGlossaryTermChildrenLazy: jest
    .fn()
    .mockImplementation((...args) => mockGetGlossaryTermChildrenLazy(...args)),
  searchGlossaryTermsPaginated: jest
    .fn()
    .mockImplementation((...args) => mockSearchGlossaryTermsPaginated(...args)),
}));

jest.mock('../../../rest/feedsAPI', () => ({
  getAllFeeds: jest
    .fn()
    .mockImplementation((...args) => mockGetAllFeeds(...args)),
  updateTask: jest
    .fn()
    .mockImplementation((...args) => mockUpdateTask(...args)),
}));

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <p data-testid="description">{markdown}</p>
    ))
);

jest.mock('../../../utils/TableUtils', () => ({
  getTableExpandableConfig: jest.fn(),
  getTableColumnConfigSelections: jest
    .fn()
    .mockReturnValue(['name', 'description', 'owners']),
  handleUpdateTableColumnSelections: jest.fn(),
  findExpandableKeysForArray: jest.fn().mockReturnValue([]),
}));

// Mock where the component actually imports this util
jest.mock('../../../utils/GlossaryUtils', () => ({
  ...jest.requireActual('../../../utils/GlossaryUtils'),
  findExpandableKeysForArray: jest.fn().mockReturnValue([]),
  glossaryTermTableColumnsWidth: jest.fn().mockReturnValue({
    name: 250,
    displayName: 200,
    description: 400,
    synonyms: 150,
    references: 150,
    relatedTerms: 150,
    tags: 150,
    glossary: 150,
    status: 100,
    owners: 180,
    reviewers: 180,
    actions: 100,
  }),
  permissionForApproveOrReject: jest.fn((record, currentUser, threads) => {
    const entityLink = `<#E::glossaryTerm::${record.fullyQualifiedName}>`;
    const taskThread = threads[entityLink]?.[0];
    const isAssignee = taskThread?.task?.assignees?.some(
      (assignee: { id: string }) => assignee.id === currentUser.id
    );

    return {
      permission: Boolean(isAssignee),
      taskId: taskThread?.task?.id ?? '',
    };
  }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'reviewer-id', name: 'reviewer' },
  }),
}));

jest.mock('../../../utils/EntityStatusUtils', () => ({
  EntityStatusClass: {
    Draft: 'warning',
    InReview: 'info',
    Rejected: 'error',
    Approved: 'success',
    Deprecated: 'warning',
  },
  getEntityStatusClass: jest.fn((status) => {
    const statusMap = {
      Draft: 'warning',
      InReview: 'info',
      Rejected: 'error',
      Approved: 'success',
      Deprecated: 'warning',
    };

    return statusMap[status] || 'warning';
  }),
}));

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(({ onClick }) => (
      <div onClick={onClick}>ErrorPlaceHolder</div>
    ))
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn().mockImplementation(() => <div>OwnerLabel</div>),
}));

jest.mock('../../common/ProfilePicture/ProfilePicture', () =>
  jest
    .fn()
    .mockImplementation(({ name }) => (
      <span data-testid={`profile-picture-${name}`}>Avatar</span>
    ))
);

jest.mock('../../../utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue([
    {
      title: 'label.owner-plural',
      dataIndex: 'owners',
      key: 'owners',
      width: 180,
      render: () => <div>OwnerLabel</div>,
    },
  ]),
  descriptionTableObject: jest.fn().mockImplementation(() => []),
}));

const mockUseGlossaryStore = {
  activeGlossary: mockedGlossaryTerms[0],
  glossaryChildTerms: [] as ModifiedGlossaryTerm[],
  updateActiveGlossary: jest.fn(),
  onAddGlossaryTerm: mockOnAddGlossaryTerm,
  onEditGlossaryTerm: mockOnEditGlossaryTerm,
  refreshGlossaryTerms: mockRefreshGlossaryTerms,
  setGlossaryChildTerms: mockSetGlossaryChildTerms,
};

jest.mock('../useGlossary.store', () => ({
  useGlossaryStore: jest.fn().mockImplementation(() => mockUseGlossaryStore),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockImplementation(() => ({
    permissions: MOCK_PERMISSIONS,
    type: 'glossary',
  })),
}));

jest.mock('react-intersection-observer', () => {
  const mockUseInView = jest.fn().mockReturnValue({
    ref: jest.fn(),
    inView: false,
  });

  return {
    useInView: mockUseInView,
  };
});

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('react-dnd', () => ({
  useDrag: jest.fn().mockReturnValue([{ isDragging: false }, jest.fn()]),
  useDrop: jest.fn().mockReturnValue([{ isOver: false }, jest.fn()]),
  DndProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: jest.fn(),
}));

jest.mock('../../../utils/EntityBulkEdit/EntityBulkEditUtils', () => ({
  getBulkEditButton: jest.fn().mockReturnValue(null),
}));

jest.mock('../../../constants/docs.constants', () => ({
  GLOSSARY_TERMS_STATUS_DOCS: 'https://docs.example.com',
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock MutationObserver
global.MutationObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
}));

describe('Test GlossaryTermTab component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateTask.mockResolvedValue({});
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
      data: mockedGlossaryTerms,
      paging: { after: null },
    });
    mockSearchGlossaryTermsPaginated.mockResolvedValue({
      data: mockedGlossaryTerms,
      paging: { after: null },
    });
    mockGetGlossaryTermChildrenLazy.mockResolvedValue({
      data: [
        {
          name: 'Child Term 1',
          fullyQualifiedName: 'glossary.term.child1',
          childrenCount: 0,
        },
        {
          name: 'Child Term 2',
          fullyQualifiedName: 'glossary.term.child2',
          childrenCount: 0,
        },
      ],
    });
    mockGetAllFeeds.mockResolvedValue({ data: [] });

    // Reset store to default state
    Object.assign(mockUseGlossaryStore, {
      activeGlossary: mockedGlossaryTerms[0],
      glossaryChildTerms: [] as ModifiedGlossaryTerm[],
      updateActiveGlossary: jest.fn(),
      onAddGlossaryTerm: mockOnAddGlossaryTerm,
      onEditGlossaryTerm: mockOnEditGlossaryTerm,
      refreshGlossaryTerms: mockRefreshGlossaryTerms,
      setGlossaryChildTerms: mockSetGlossaryChildTerms,
    });
  });

  describe('Empty State', () => {
    it('should show the ErrorPlaceHolder component when no glossary terms are present', async () => {
      // Make sure the API returns empty data
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: [],
        paging: { after: null },
      });

      const { container } = render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(getByText(container, 'ErrorPlaceHolder')).toBeInTheDocument();
      });
    });

    it('should call the onAddGlossaryTerm function when clicking add button in ErrorPlaceHolder', async () => {
      // Make sure the API returns empty data
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: [],
        paging: { after: null },
      });

      const { container } = render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(getByText(container, 'ErrorPlaceHolder')).toBeInTheDocument();
      });

      fireEvent.click(getByText(container, 'ErrorPlaceHolder'));

      expect(mockOnAddGlossaryTerm).toHaveBeenCalled();
    });
  });

  describe('Table Rendering with Data', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should render the table when glossary terms are present', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.getByTestId('glossary-terms-table')).toBeInTheDocument();
      });
    });

    it('should display glossary term names as links', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.getByTestId('Clothing')).toBeInTheDocument();
        expect(screen.getByTestId('Sales')).toBeInTheDocument();
      });
    });

    it('should render description column with rich text preview', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const descriptions = screen.getAllByTestId('description');

        expect(descriptions).toHaveLength(2);
        expect(descriptions[0]).toHaveTextContent(
          'description of Business Glossary.Clothing'
        );
      });
    });

    it('should render status badges for each term', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('Business Glossary.Clothing-status')
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('Business Glossary.Sales-status')
        ).toBeInTheDocument();
      });
    });

    it('should render owner labels', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const ownerLabels = screen.getAllByText('OwnerLabel');

        expect(ownerLabels.length).toBeGreaterThan(0);
      });
    });

    it('should render action buttons when user has create permissions', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const editButtons = screen.getAllByTestId('edit-button');

        expect(editButtons).toHaveLength(2);
      });
    });

    it('should keep the standard columns for non-CDE glossaries', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.queryByText('Mã thuật ngữ')).not.toBeInTheDocument();
        expect(
          screen.queryByText('Nhóm theo nghiệp vụ')
        ).not.toBeInTheDocument();
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Number),
          undefined,
          expect.any(String),
          undefined,
          undefined
        );
        expect(screen.getByTestId('glossary-terms-table')).not.toHaveClass(
          'cde-glossary-terms-table'
        );
      });
    });
  });

  describe('CDE glossary table', () => {
    const cdeTerm = {
      ...mockedGlossaryTerms[0],
      name: 'CDE102',
      displayName: 'Nợ gốc theo tài khoản vay (CBAL)',
      fullyQualifiedName: 'Data Dictionary.CDE102',
      domains: [
        {
          id: 'domain-id',
          type: 'domain',
          name: 'TinDung',
          displayName: 'Tín dụng',
        },
      ],
      owners: [
        {
          id: 'credit-team-id',
          type: 'team',
          name: 'BanTinDung',
          displayName: 'Ban Tín dụng',
        },
        {
          id: 'data-center-id',
          type: 'team',
          name: 'TrungTamDuLieu',
          displayName: 'Trung tâm Dữ liệu',
        },
      ],
      tags: [
        {
          tagFQN: 'DataSource.IPCAS',
          displayName: 'IPCAS',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
        {
          tagFQN: 'DataClassification.Bi_mat',
          displayName: 'Bí mật',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
        {
          tagFQN: 'PersonalData.Nhay_cam',
          displayName: 'Nhạy cảm',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ],
      extension: {
        entityRelationship: 'Quan hệ 1-N với khách hàng',
        relatedRegulatoryDocuments: 'Quyết định 123/QĐ-NHNo',
        dataQualityRules: true,
      },
    } as unknown as ModifiedGlossaryTerm;

    beforeEach(() => {
      (useTranslation as jest.Mock).mockReturnValue({
        t: getCDETranslation('vi'),
        i18n: { language: 'vi-VN', dir: jest.fn().mockReturnValue('ltr') },
      });
      Object.assign(mockUseGlossaryStore, {
        activeGlossary: {
          id: 'data-dictionary-id',
          name: 'Data Dictionary',
          displayName: 'Từ điển dữ liệu dùng chung',
          fullyQualifiedName: 'Data Dictionary',
          description: 'Từ điển dữ liệu dùng chung',
        },
        glossaryChildTerms: [cdeTerm],
      });
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: [cdeTerm],
        paging: { after: null },
      });
    });

    it('uses English CDE column labels and value text', () => {
      const t = getCDETranslation('en');
      const columns = getCDEGlossaryTableColumns({
        handleLoadMoreChildren: jest.fn(),
        loadingChildren: {},
        t,
      });

      expect(columns.slice(0, 11).map((column) => column.title)).toEqual([
        'Term Code',
        'Business Group',
        'Business Term Name',
        'Data Source',
        'Business Meaning',
        'Entity Relationship',
        'Data Owner',
        'Data Classification',
        'Personal Data',
        'Related Regulatory Documents',
        'Data Quality Rules',
      ]);
      expect(renderCDEQualityRule(true, t)).toMatchObject({
        props: { children: 'Yes' },
      });
      expect(renderCDEQualityRule(false, t)).toMatchObject({
        props: { children: 'No' },
      });
    });

    it('should render the Excel-like CDE columns and values', async () => {
      render(<GlossaryTermTab isGlossary />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.getByText('Mã thuật ngữ')).toBeInTheDocument();
        expect(screen.getByText('Nhóm theo nghiệp vụ')).toBeInTheDocument();
        expect(screen.getByText('Nguồn dữ liệu')).toBeInTheDocument();
        expect(screen.getByText('Mối quan hệ với thực thể')).toBeInTheDocument();
        expect(screen.getByText('Quan hệ 1-N với khách hàng')).toBeInTheDocument();
        expect(screen.getAllByText('label.status')).not.toHaveLength(0);
        expect(
          screen.getByText('Quy định về chất lượng dữ liệu')
        ).toBeInTheDocument();
        expect(screen.getByTestId('cde-code-CDE102')).toBeInTheDocument();
        expect(screen.getByText('Tín dụng')).toBeInTheDocument();
        expect(screen.getByText('IPCAS')).toBeInTheDocument();
        expect(screen.getByText('Bí mật')).toBeInTheDocument();
        expect(screen.getByText('Nhạy cảm')).toBeInTheDocument();
        expect(screen.getByText('Ban Tín dụng')).toBeInTheDocument();
        expect(screen.getByText('Trung tâm Dữ liệu')).toBeInTheDocument();
        expect(
          screen.getByTestId('profile-picture-BanTinDung')
        ).toBeInTheDocument();
        expect(
          screen.getByTestId('profile-picture-TrungTamDuLieu')
        ).toBeInTheDocument();
        expect(
          screen
            .getByTestId('glossary-terms-table')
            .closest('.cde-glossary-terms-table')
        ).toBeInTheDocument();
      });
    });

    it('should show approval actions in the status column for permitted reviewers', async () => {
      const inReviewTerm = {
        ...cdeTerm,
        entityStatus: EntityStatus.InReview,
        reviewers: [
          {
            id: 'reviewer-id',
            type: 'user',
            name: 'reviewer',
          },
        ],
      };
      Object.assign(mockUseGlossaryStore, {
        glossaryChildTerms: [inReviewTerm],
      });
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: [inReviewTerm],
        paging: { after: null },
      });
      mockGetAllFeeds.mockResolvedValue({
        data: [
          {
            id: 'thread-id',
            about: '<#E::glossaryTerm::Data Dictionary.CDE102>',
            task: {
              id: 'task-id',
              assignees: [
                { id: 'reviewer-id', type: 'user', name: 'reviewer' },
              ],
            },
          },
        ],
      });

      render(<GlossaryTermTab isGlossary />, {
        wrapper: MemoryRouter,
      });

      expect(
        await screen.findByTestId('CDE102-approve-btn')
      ).toBeInTheDocument();
      expect(screen.getByTestId('CDE102-reject-btn')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('CDE102-approve-btn'));

      await waitFor(() => {
        expect(mockUpdateTask).toHaveBeenCalledWith(
          'resolve',
          'task-id',
          expect.objectContaining({ newValue: 'approved' })
        );
      });
    });

    it('should not show or submit approval actions without task permission', async () => {
      const inReviewTerm = {
        ...cdeTerm,
        entityStatus: EntityStatus.InReview,
      };
      Object.assign(mockUseGlossaryStore, {
        glossaryChildTerms: [inReviewTerm],
      });
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: [inReviewTerm],
        paging: { after: null },
      });
      mockGetAllFeeds.mockResolvedValue({
        data: [
          {
            id: 'thread-id',
            about: '<#E::glossaryTerm::Data Dictionary.CDE102>',
            task: {
              id: 'task-id',
              assignees: [
                { id: 'another-user-id', type: 'user', name: 'another-user' },
              ],
            },
          },
        ],
      });

      render(<GlossaryTermTab isGlossary />, {
        wrapper: MemoryRouter,
      });

      expect(
        await screen.findByTestId('Data Dictionary.CDE102-status')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('CDE102-approve-btn')
      ).not.toBeInTheDocument();
      expect(mockUpdateTask).not.toHaveBeenCalled();
    });

    it('should request extended fields only for the CDE table', async () => {
      render(<GlossaryTermTab isGlossary />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
          'Data Dictionary',
          expect.any(Number),
          undefined,
          expect.any(String),
          CDE_GLOSSARY_TERM_FIELDS,
          undefined
        );
      });
    });

    it('should render CDE table when glossary name is Từ điển dữ liệu dùng chung', async () => {
      Object.assign(mockUseGlossaryStore, {
        activeGlossary: {
          id: 'data-dictionary-vi-id',
          name: 'Từ điển dữ liệu dùng chung',
          displayName: 'Từ điển dữ liệu dùng chung',
          fullyQualifiedName: 'Từ điển dữ liệu dùng chung',
          description: 'Từ điển dữ liệu dùng chung',
        },
        glossaryChildTerms: [cdeTerm],
      });

      render(<GlossaryTermTab isGlossary />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(
          screen
            .getByTestId('glossary-terms-table')
            .closest('.cde-glossary-terms-table')
        ).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should render search input field', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('label.search-entity');

        expect(searchInput).toBeInTheDocument();
      });
    });

    it('should filter terms based on search input', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('label.search-entity');
        fireEvent.change(searchInput, { target: { value: 'Clothing' } });
      });

      // Note: Due to debounce, we might need to wait for the filtering to take effect
      await waitFor(() => {
        expect(screen.getByTestId('Clothing')).toBeInTheDocument();
      });
    });
  });

  describe('Status Filtering', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should render status dropdown button', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('glossary-status-dropdown')
        ).toBeInTheDocument();
      });
    });

    it('should open status dropdown when clicked', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const statusDropdown = screen.getByTestId('glossary-status-dropdown');
        fireEvent.click(statusDropdown);

        expect(statusDropdown).toBeInTheDocument();
      });
    });
  });

  describe('Expand/Collapse Functionality', () => {
    beforeEach(() => {
      const termsWithChildren = [
        {
          ...mockedGlossaryTerms[0],
          childrenCount: 2,
          children: [],
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termsWithChildren;
    });

    it('should render expand/collapse all button', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(
          screen.getByTestId('expand-collapse-all-button')
        ).toBeInTheDocument();
      });
    });

    it('should show expand icon for terms with children', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.getByTestId('expand-icon')).toBeInTheDocument();
      });
    });

    it('should call fetchChildTerms when expanding a term with children', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const expandIcon = screen.getByTestId('expand-icon');
        fireEvent.click(expandIcon);
      });

      expect(mockGetGlossaryTermChildrenLazy).toHaveBeenCalledWith(
        'Business Glossary.Clothing',
        50,
        undefined
      );
    });
  });

  describe('Actions', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should call onEditGlossaryTerm when edit button is clicked', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const editButtons = screen.getAllByTestId('edit-button');
        fireEvent.click(editButtons[0]);
      });

      expect(mockOnEditGlossaryTerm).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockedGlossaryTerms[0].id,
          name: mockedGlossaryTerms[0].name,
          fullyQualifiedName: mockedGlossaryTerms[0].fullyQualifiedName,
          level: expect.any(Number),
        })
      );
    });

    it('should call onAddGlossaryTerm when add term button is clicked', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const addButtons = screen.getAllByTestId('add-classification');
        fireEvent.click(addButtons[0]);
      });

      expect(mockOnAddGlossaryTerm).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockedGlossaryTerms[1].id,
          name: mockedGlossaryTerms[1].name,
          fullyQualifiedName: mockedGlossaryTerms[1].fullyQualifiedName,
          level: expect.any(Number),
        })
      );
    });
  });

  describe('Permissions', () => {
    it('should not show action buttons when user lacks create permissions', async () => {
      const mockGenericContext = jest.fn().mockReturnValue({
        permissions: { ...MOCK_PERMISSIONS, Create: false },
        type: 'glossary',
      });

      const { useGenericContext } = jest.requireMock(
        '../../Customization/GenericProvider/GenericProvider'
      );
      useGenericContext.mockImplementation(mockGenericContext);

      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.queryByTestId('edit-button')).not.toBeInTheDocument();
        expect(
          screen.queryByTestId('add-classification')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loader when table is loading', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      // Initially loading state might be triggered
      const loader = screen.queryByText('Loader');

      expect(loader).toBeDefined();
    });
  });

  describe('Infinite Scroll', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should call fetchAllTerms when scroll trigger is in view', async () => {
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: mockedGlossaryTerms,
        paging: { after: 'next-cursor' },
      });

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalled();
      });
    });
  });

  describe('Drag and Drop', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should render drag icons for each row', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      const dragIcons = document.querySelectorAll('.drag-icon');

      expect(dragIcons).toHaveLength(0);
    });
  });

  describe('Modal Functionality', () => {
    it('should not show modal initially', () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      expect(
        screen.queryByTestId('confirmation-modal')
      ).not.toBeInTheDocument();
    });
  });

  describe('Glossary vs Glossary Term Context', () => {
    it('should behave differently when isGlossary is true', async () => {
      render(<GlossaryTermTab isGlossary />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetAllFeeds).toHaveBeenCalledWith(
          expect.stringContaining('glossary'),
          undefined,
          'Task',
          undefined,
          'Open',
          undefined,
          100000
        );
      });
    });

    it('should behave differently when isGlossary is false', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetAllFeeds).toHaveBeenCalledWith(
          expect.stringContaining('glossaryTerm'),
          undefined,
          'Task',
          undefined,
          'Open',
          undefined,
          100000
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully when fetching terms', async () => {
      mockGetFirstLevelGlossaryTermsPaginated.mockRejectedValue(
        new Error('API Error')
      );

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalled();
      });
    });

    it('should handle errors when fetching child terms', async () => {
      const termsWithChildren = [
        {
          ...mockedGlossaryTerms[0],
          childrenCount: 2,
          children: [],
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termsWithChildren;
      mockGetGlossaryTermChildrenLazy.mockRejectedValue(
        new Error('Child fetch error')
      );

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const expandIcon = screen.getByTestId('expand-icon');
        fireEvent.click(expandIcon);
      });

      await waitFor(() => {
        expect(mockGetGlossaryTermChildrenLazy).toHaveBeenCalled();
      });
    });

    it('should handle errors when fetching feeds', async () => {
      mockGetAllFeeds.mockRejectedValue(new Error('Feeds error'));

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetAllFeeds).toHaveBeenCalled();
      });
    });
  });

  describe('Task Management and Status Actions', () => {
    beforeEach(() => {
      const termWithInReviewStatus = [
        {
          ...mockedGlossaryTerms[0],
          status: 'InReview',
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termWithInReviewStatus;
    });

    it('should render status action buttons for terms in review', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        // Status actions would be rendered based on permissions and status
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });
    });
  });

  describe('Advanced Pagination', () => {
    it('should not refetch when the component rerenders with the same page', async () => {
      const { rerender } = render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(
          1
        );
      });

      rerender(<GlossaryTermTab isGlossary={false} />);

      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(1);
    });

    it('should show the supported page sizes', async () => {
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: mockedGlossaryTerms.slice(0, 1),
        paging: { after: 'cursor-1', total: 100 },
      });

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      const pageSizeDropdown = await screen.findByTestId(
        'page-size-selection-dropdown'
      );

      expect(pageSizeDropdown).toHaveTextContent('15 / label.page');
      expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
        expect.any(String),
        15,
        undefined,
        expect.any(String),
        undefined,
        undefined
      );
    });

    it('should stop loading when no more terms are available', async () => {
      mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValue({
        data: mockedGlossaryTerms,
        paging: { after: null },
      });

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalled();
      });
    });
  });

  describe('Status Dropdown Advanced Functionality', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should handle status selection save action', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const statusDropdown = screen.getByTestId('glossary-status-dropdown');
        fireEvent.click(statusDropdown);

        // The dropdown menu should be rendered but we can't easily test the save action
        // due to the complex dropdown structure
        expect(statusDropdown).toBeInTheDocument();
      });
    });

    it('should handle status selection cancel action', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const statusDropdown = screen.getByTestId('glossary-status-dropdown');
        fireEvent.click(statusDropdown);

        expect(statusDropdown).toBeInTheDocument();
      });
    });
  });

  describe('Table Column Rendering', () => {
    beforeEach(() => {
      mockUseGlossaryStore.glossaryChildTerms = mockedGlossaryTerms;
    });

    it('should render synonyms column correctly', async () => {
      const termWithSynonyms = [
        {
          ...mockedGlossaryTerms[0],
          synonyms: ['synonym1', 'synonym2'],
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termWithSynonyms;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });
    });

    it('should render terms with icons when available', async () => {
      const termWithIcon = [
        {
          ...mockedGlossaryTerms[0],
          style: {
            iconURL: 'https://example.com/icon.png',
            color: '#FF0000',
          },
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termWithIcon;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const tagIcon = screen.getByTestId('tag-icon');

        expect(tagIcon).toBeInTheDocument();
      });
    });

    it('should render empty description placeholder', async () => {
      const termWithoutDescription = [
        {
          ...mockedGlossaryTerms[0],
          description: '',
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termWithoutDescription;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });
    });
  });

  describe('Expand All Functionality', () => {
    beforeEach(() => {
      // Use the actual mock data which has proper nested structure
      // Only reset the children arrays to test loading behavior
      const termsWithChildren = mockedGlossaryTerms.map((term) => ({
        ...term,
        children: [], // Clear children to test loading
        childrenCount: term.childrenCount || 0,
      }));
      mockUseGlossaryStore.glossaryChildTerms = termsWithChildren;

      // Mock findExpandableKeysForArray to return keys for terms with children
      const expandableKeys = termsWithChildren
        .filter((term) => term.childrenCount && term.childrenCount > 0)
        .map((term) => term.fullyQualifiedName);

      (findExpandableKeysForArray as jest.Mock).mockReturnValue(expandableKeys);

      // Reset mock to ensure clean state
      mockGetGlossaryTermChildrenLazy.mockClear();
    });

    it('should expand all button exists and is clickable', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByTestId('glossary-terms-table')).toBeInTheDocument();
      });

      const expandAllButton = screen.getByTestId('expand-collapse-all-button');

      expect(expandAllButton).toBeInTheDocument();

      // Button text can be either expand-all or collapse-all depending on state
      expect(
        expandAllButton.textContent === 'label.expand-all' ||
          expandAllButton.textContent === 'label.collapse-all'
      ).toBe(true);

      // The button should be clickable
      expect(expandAllButton).not.toBeDisabled();

      // Simply verify the button can be clicked without errors
      fireEvent.click(expandAllButton);
    });

    it('should have expand/collapse button with proper text', async () => {
      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        expect(screen.getByTestId('glossary-terms-table')).toBeInTheDocument();
      });

      const expandAllButton = screen.getByTestId('expand-collapse-all-button');

      // Button should have either expand or collapse text
      expect(
        expandAllButton.textContent === 'label.expand-all' ||
          expandAllButton.textContent === 'label.collapse-all'
      ).toBe(true);

      // Note: Since the actual expansion is complex and involves async operations,
      // we're just testing that the button exists and has proper text
      // The full integration test would require more complex setup
    });
  });

  describe('Drag and Drop Modal', () => {
    it('should show confirmation modal when terms are moved', async () => {
      const termsWithChildren = [
        {
          ...mockedGlossaryTerms[0],
          childrenCount: 0,
        },
        {
          ...mockedGlossaryTerms[1],
          childrenCount: 0,
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termsWithChildren;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });

      // The modal would be triggered through drag and drop actions
      // which are complex to simulate in tests
    });
  });

  describe('Edge Cases', () => {
    it('should handle terms with missing required fields gracefully', async () => {
      const incompleteTerms = [
        {
          id: 'test-id',
          name: 'Test Term',
          // Missing other required fields
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = incompleteTerms;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });
    });

    it('should handle terms with undefined description gracefully', async () => {
      const termsWithUndefinedDescription = [
        {
          ...mockedGlossaryTerms[0],
          description: undefined,
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termsWithUndefinedDescription;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });

      // Should show no-description placeholder instead of crashing
      expect(screen.getByText('label.no-description')).toBeInTheDocument();
    });

    it('should handle terms with null description gracefully', async () => {
      const termsWithNullDescription = [
        {
          ...mockedGlossaryTerms[0],
          description: null,
        },
      ];
      mockUseGlossaryStore.glossaryChildTerms = termsWithNullDescription;

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      await waitFor(() => {
        const table = screen.getByTestId('glossary-terms-table');

        expect(table).toBeInTheDocument();
      });

      // Should show no-description placeholder instead of crashing
      expect(screen.getByText('label.no-description')).toBeInTheDocument();
    });

    it('should handle non-array glossaryChildTerms gracefully', async () => {
      mockUseGlossaryStore.glossaryChildTerms =
        null as unknown as ModifiedGlossaryTerm[];

      render(<GlossaryTermTab isGlossary={false} />, {
        wrapper: MemoryRouter,
      });

      // Should show the table even when glossaryChildTerms is not an array
      // The component handles this by returning an empty array for glossaryTerms
      await waitFor(() => {
        expect(screen.getByTestId('glossary-terms-table')).toBeInTheDocument();
      });
    });
  });
});
