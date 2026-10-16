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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as XLSX from 'xlsx';
import * as glossaryAPI from '../../rest/glossaryAPI';
import * as domainAPI from '../../rest/domainAPI';
import * as userAPI from '../../rest/userAPI';
import CDEImportPage from './CDEImportPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('xlsx', () => ({
  read: jest.fn(),
  write: jest.fn().mockReturnValue(new Uint8Array()),
  utils: {
    aoa_to_sheet: jest.fn(),
    book_append_sheet: jest.fn(),
    book_new: jest.fn(),
    sheet_to_json: jest.fn(),
  },
}));

jest.mock('react-data-grid', () => ({
  __esModule: true,
  default: jest.fn(({ rows, columns }) => (
    <div data-testid="data-grid">
      <div>Rows: {rows?.length ?? 0}</div>
      <div>Columns: {columns?.length ?? 0}</div>
      {rows?.map((row: any, rIdx: number) => (
        <div data-testid={`grid-row-${rIdx}`} key={row.id || rIdx}>
          {columns?.map((col: any) => (
            <div data-testid={`cell-${col.key}`} key={col.key}>
              {col.renderCell ? col.renderCell({ row }) : row[col.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  )),
  textEditor: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValOrOptions?: any, options?: any) => {
      let str =
        typeof defaultValOrOptions === 'string' ? defaultValOrOptions : key;
      const opts =
        typeof defaultValOrOptions === 'object' ? defaultValOrOptions : options;
      if (opts && typeof str === 'string') {
        Object.keys(opts).forEach((k) => {
          str = str.replace(new RegExp(`{{${k}}}`, 'g'), String(opts[k]));
        });
      }

      return str;
    },
  }),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: jest.fn(({ children }) => (
    <div data-testid="page-layout">{children}</div>
  )),
}));

jest.mock('../../hooks/useFqn', () => ({
  useFqn: () => ({
    fqn: 'Tu_Dien_Du_Lieu_Dung_Chung',
  }),
}));

jest.mock('../../rest/glossaryAPI', () => ({
  downloadCdeImportTemplate: jest.fn().mockResolvedValue(new Blob(['x'])),
  previewCdeImport: jest.fn().mockResolvedValue({
    importSessionId: 'session-1',
    expiresAt: '2099-01-01T00:00:00Z',
    fileHash: 'hash',
    existingCodePolicy: 'SKIP_EXISTING',
    summary: { CREATE: 1 },
    rows: [
      {
        rowNumber: 2,
        cdeCode: 'CDE001',
        action: 'CREATE',
        warnings: [],
        errors: [],
      },
    ],
    canCommit: true,
  }),
  commitCdeImport: jest.fn().mockResolvedValue({ committed: 1, skipped: 0 }),
  getGlossariesByName: jest.fn().mockResolvedValue({
    id: 'glossary-1',
    name: 'Tu_Dien_Du_Lieu_Dung_Chung',
    displayName: 'Từ điển dữ liệu dùng chung',
  }),
  getGlossaryTerms: jest.fn().mockResolvedValue({ data: [] }),
  addGlossaryTerm: jest.fn().mockResolvedValue({
    id: 'term-1',
    name: 'CDE001',
    entityStatus: 'Draft',
    version: 0.1,
  }),
  patchGlossaryTerm: jest.fn().mockResolvedValue({
    id: 'term-1',
    name: 'CDE001',
    entityStatus: 'Draft',
  }),
  transitionGlossaryTermWorkflow: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../rest/domainAPI', () => ({
  getDomainList: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../rest/tagAPI', () => ({
  getTags: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../rest/userAPI', () => ({
  getUsers: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../rest/teamsAPI', () => ({
  getTeams: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const EXCEL_COLUMNS: [string, string][] = [
  ['name', 'Mã CDE'],
  ['domain', 'Khối/Miền nghiệp vụ'],
  ['displayName', 'Tên thuật ngữ nghiệp vụ'],
  ['dataSource', 'Hệ thống nguồn'],
  ['description', 'Ý nghĩa nghiệp vụ'],
  ['entityRelationship', 'Mối quan hệ với thực thể'],
  ['owner', 'Chủ sở hữu dữ liệu'],
  ['releaseLevel', 'Cấp phát hành'],
  ['dataClassification', 'Phân loại dữ liệu'],
  ['personalData', 'Dữ liệu cá nhân'],
  ['relatedRegulatoryDocuments', 'Văn bản quy định liên quan'],
  ['dataQualityRules', 'Quy định chất lượng dữ liệu'],
  ['effectiveDate', 'Ngày hiệu lực'],
  ['expirationDate', 'Ngày hết hiệu lực'],
];

const mockExcelRows = ({ rows }: { rows: Record<string, unknown>[] }) => {
  (XLSX.read as jest.Mock).mockReturnValue({
    SheetNames: ['Sheet1'],
    Sheets: { Sheet1: {} },
  });
  (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue([
    EXCEL_COLUMNS.map(([, header]) => header),
    ...rows.map((row) => EXCEL_COLUMNS.map(([key]) => String(row[key] ?? ''))),
  ]);
};

describe('CDEImportPage', () => {
  beforeAll(() => {
    File.prototype.arrayBuffer = jest
      .fn()
      .mockResolvedValue(new ArrayBuffer(0));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render page layout, breadcrumbs, stepper, and upload dragger', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <CDEImportPage />
        </MemoryRouter>
      );
    });

    // Check breadcrumb
    expect(screen.getByText('Thuật ngữ')).toBeInTheDocument();
    expect(screen.getByText('Nhập')).toBeInTheDocument();

    // Check stepper
    expect(screen.getByText('Tải Lên Tệp Excel')).toBeInTheDocument();
    expect(screen.getByText('Xem Trước Sửa')).toBeInTheDocument();
    expect(screen.getByText('Cập Nhật')).toBeInTheDocument();

    // Check upload dragger text
    expect(
      screen.getByTestId('message.drag-and-drop-or-browse-excel-file-here')
    ).toBeInTheDocument();

    // Check template download button
    expect(
      screen.getByText('label.download-excel-template')
    ).toBeInTheDocument();

    // Check duplicate handling options & descriptions
    expect(screen.getByText('Bỏ qua bản ghi trùng')).toBeInTheDocument();
    expect(
      screen.getByText(/Giữ nguyên dữ liệu CDE đang có trên hệ thống/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Cập nhật ghi đè bản ghi')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Cập nhật thông tin mới từ tệp Excel vào các mã CDE đã tồn tại/i
      )
    ).toBeInTheDocument();

    // Verify NO warning alert / notice exists in Step 1
    expect(
      screen.queryByText(
        /Mọi bản ghi CDE nạp mới sẽ được khởi tạo ở trạng thái/i
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Quy định quản trị dữ liệu/i)
    ).not.toBeInTheDocument();
  });

  it('should transition to Step 2 (Xem Trước Sửa) with DataGrid, add row, and navigation buttons', async () => {
    mockExcelRows({
      totalRows: 1,
      validCount: 1,
      warningCount: 0,
      errorCount: 0,
      rows: [
        {
          rowNumber: 2,
          name: 'CDE001',
          displayName: 'Mã số CIF',
          domain: 'Khách hàng',
          dataSource: 'IPCAS',
          description: 'Mô tả',
          entityRelationship: 'Quan hệ',
          owner: 'admin',
          dataClassification: 'Nội bộ',
          personalData: 'Có',
          relatedRegulatoryDocuments: 'TT 23',
          dataQualityRules: 'Có',
          version: '1.0',
          reviewer: 'admin',
          status: 'Draft' as any,
          errors: [],
          warnings: [],
          isValid: true,
        },
      ],
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <CDEImportPage />
        </MemoryRouter>
      );
    });

    const file = new File(['fake content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const draggerInput = document.querySelector('input[type="file"]');

    expect(draggerInput).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(draggerInput!, { target: { files: [file] } });
    });

    // Step 2 should display: '+ Thêm hàng', 'Trước', and 'Tiếp theo'
    expect(screen.getByTestId('add-row-btn')).toBeInTheDocument();
    expect(screen.getByText('label.previous')).toBeInTheDocument();
    expect(screen.getByTestId('next-button')).toBeInTheDocument();

    // Click '+ Thêm hàng'
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-row-btn'));
    });

    // Click 'Tiếp theo' -> transitions to Step 3 (Cập Nhật)
    await act(async () => {
      fireEvent.click(screen.getByTestId('next-button'));
    });

    // Step 3 should display summary badge, status-filter-group, and 'Cập nhật'
    expect(screen.getByTestId('processed-row')).toBeInTheDocument();
    expect(screen.getByTestId('update-button')).toBeInTheDocument();
    expect(screen.getByTestId('status-filter-group')).toBeInTheDocument();
    expect(
      screen.getByText(/cde.validation-has-errors|cde.validation-all-valid/)
    ).toBeInTheDocument();

    // Initial state: 2 rows in Step 3 (1 valid + 1 added row with missing fields)
    expect(screen.getByText('Rows: 2')).toBeInTheDocument();

    const filterGroup = screen.getByTestId('status-filter-group');

    expect(
      within(filterGroup).getByText('label.errors-only')
    ).toBeInTheDocument();
    expect(within(filterGroup).getByText('label.valid')).toBeInTheDocument();

    // Switch filter to 'failure' (Bị lỗi) -> DataGrid receives only 1 row
    const failureFilterBtn = within(filterGroup).getByText('label.errors-only');
    await act(async () => {
      fireEvent.click(failureFilterBtn);
    });

    expect(screen.getByText('Rows: 1')).toBeInTheDocument();

    // Switch filter to 'success' (Hợp lệ) -> DataGrid receives only 1 row
    const successFilterBtn = within(filterGroup).getByText('label.valid');
    await act(async () => {
      fireEvent.click(successFilterBtn);
    });

    expect(screen.getByText('Rows: 1')).toBeInTheDocument();

    // Switch back to 'all' (Tất cả) -> DataGrid receives 2 rows
    const allFilterBtn = within(filterGroup).getByText('label.all');
    await act(async () => {
      fireEvent.click(allFilterBtn);
    });

    expect(screen.getByText('Rows: 2')).toBeInTheDocument();
  });

  it('should trigger download template when template link is clicked', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <CDEImportPage />
        </MemoryRouter>
      );
    });

    URL.createObjectURL = jest.fn().mockReturnValue('blob:template');
    URL.revokeObjectURL = jest.fn();

    await act(async () => {
      fireEvent.click(screen.getByText('label.download-excel-template'));
    });

    expect(glossaryAPI.downloadCdeImportTemplate).toHaveBeenCalled();
  });

  it('should navigate back to glossary when cancel button is clicked', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <CDEImportPage />
        </MemoryRouter>
      );
    });

    const cancelBtn = screen.getByText('label.cancel');
    fireEvent.click(cancelBtn);

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/glossary/')
    );
  });

  it('should validate and flag non-existing domain (e.g. Dịch vụ 2) as error in Step 3', async () => {
    const domainAPIMock = jest.requireMock('../../rest/domainAPI');
    domainAPIMock.getDomainList.mockResolvedValueOnce({
      data: [
        {
          id: 'domain-1',
          name: 'Dich_vu',
          displayName: 'Dịch vụ',
          fullyQualifiedName: 'Dich_vu',
        },
      ],
    });

    mockExcelRows({
      totalRows: 1,
      validCount: 1,
      warningCount: 0,
      errorCount: 0,
      rows: [
        {
          rowNumber: 2,
          name: 'alo4',
          displayName: 'alo4',
          domain: 'Dịch vụ 2', // Không tồn tại trên hệ thống!
          dataSource: 'Thẻ',
          description: 'alo4',
          entityRelationship: 'test 1 tỷ',
          owner: '',
          dataClassification: '',
          personalData: '',
          relatedRegulatoryDocuments: '',
          dataQualityRules: '',
          version: '1.0',
          reviewer: '',
          status: 'Draft' as any,
          errors: [],
          warnings: [],
          isValid: true,
        },
      ],
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <CDEImportPage />
        </MemoryRouter>
      );
    });

    const file = new File(['fake content'], 'test_domain.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const draggerInput = document.querySelector('input[type="file"]');

    expect(draggerInput).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(draggerInput!, { target: { files: [file] } });
    });

    // Step 2: Click 'Tiếp theo' để chuyển sang Step 3 và kích hoạt handleValidate
    await act(async () => {
      fireEvent.click(screen.getByTestId('next-button'));
    });

    // Step 3: Kiểm tra hàng bị đánh dấu lỗi vì 'Dịch vụ 2' không tồn tại
    expect(screen.getByTestId('failed-row')).toHaveTextContent('1');
    expect(screen.getByTestId('passed-row')).toHaveTextContent('0');

    // Cột Chi tiết phải hiển thị rõ ràng nguyên nhân
    expect(
      screen.getByText("Miền 'Dịch vụ 2' không tồn tại trên hệ thống")
    ).toBeInTheDocument();
  });

  it('should detect errors for import fields during validation', async () => {
    (domainAPI.getDomainList as jest.Mock).mockResolvedValue({
      data: [
        {
          id: '1',
          name: 'Dich_vu',
          displayName: 'Dịch vụ',
          fullyQualifiedName: 'Dich_vu',
        },
      ],
    });
    (userAPI.getUsers as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'u1',
          name: 'admin',
          displayName: 'Admin User',
          fullyQualifiedName: 'admin',
        },
      ],
    });

    mockExcelRows({
      totalRows: 1,
      validCount: 1,
      warningCount: 0,
      errorCount: 0,
      rows: [
        {
          rowNumber: 2,
          name: 'CDE888',
          displayName: 'CDE 888',
          domain: 'Dịch vụ',
          dataSource: 'Nguon_Khong_Ton_Tai_123',
          description: 'Mô tả',
          entityRelationship: 'Quan hệ',
          owner: 'Ghost_Owner',
          dataClassification: 'PhanLoaiSai',
          personalData: 'GiaTriSai',
          relatedRegulatoryDocuments: 'VB 1',
          dataQualityRules: 'SaiDinhDangBoolean',
          status: 'Draft' as any,
          errors: [],
          warnings: [],
          isValid: true,
        },
      ],
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <CDEImportPage />
        </MemoryRouter>
      );
    });

    const file = new File(['fake content'], 'test_fields.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const draggerInput = document.querySelector('input[type="file"]');

    expect(draggerInput).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(draggerInput!, { target: { files: [file] } });
    });

    // Step 2 -> Step 3: Trigger handleValidate
    await act(async () => {
      fireEvent.click(screen.getByTestId('next-button'));
    });

    // Step 3: Check failure count
    expect(screen.getByTestId('failed-row')).toHaveTextContent('1');
    expect(screen.getByTestId('passed-row')).toHaveTextContent('0');

    // Verify errors are captured in details
    expect(
      screen.getByText(
        /Nguồn dữ liệu 'Nguon_Khong_Ton_Tai_123' không tồn tại trên hệ thống/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Phân loại dữ liệu 'PhanLoaiSai' không hợp lệ/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Dữ liệu cá nhân 'GiaTriSai' không hợp lệ/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Chủ sở hữu 'Ghost_Owner' không tồn tại trên hệ thống/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Quy định chất lượng dữ liệu phải là 'Có' hoặc 'Không'/)
    ).toBeInTheDocument();
  });

  it('should commit the previewed import atomically when Cập nhật is clicked', async () => {
    (domainAPI.getDomainList as jest.Mock).mockResolvedValue({
      data: [
        {
          id: '1',
          name: 'Dich_vu',
          displayName: 'Dịch vụ',
          fullyQualifiedName: 'Dich_vu',
        },
      ],
    });

    mockExcelRows({
      totalRows: 1,
      validCount: 1,
      warningCount: 0,
      errorCount: 0,
      rows: [
        {
          rowNumber: 2,
          name: 'CDE_BATCH_01',
          displayName: 'CDE Batch 01',
          domain: 'Dịch vụ',
          dataSource: '',
          description: 'Ý nghĩa test',
          entityRelationship: '1-1',
          owner: '',
          dataClassification: '',
          personalData: '',
          relatedRegulatoryDocuments: '',
          dataQualityRules: '',
          version: '1.0',
          reviewer: '',
          status: 'Draft' as any,
          errors: [],
          warnings: [],
          isValid: true,
        },
      ],
    });

    await act(async () => {
      render(
        <MemoryRouter>
          <CDEImportPage />
        </MemoryRouter>
      );
    });

    const file = new File(['fake content'], 'test_batch.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const draggerInput = document.querySelector('input[type="file"]');

    await act(async () => {
      fireEvent.change(draggerInput!, { target: { files: [file] } });
    });

    // Step 2 -> Step 3
    await act(async () => {
      fireEvent.click(screen.getByTestId('next-button'));
    });

    // Step 3 -> Click Update / Start Import
    await act(async () => {
      fireEvent.click(screen.getByTestId('update-button'));
    });

    expect(glossaryAPI.previewCdeImport).toHaveBeenCalled();
    expect(glossaryAPI.commitCdeImport).toHaveBeenCalledWith('session-1');
    expect(screen.queryByTestId('update-button')).not.toBeInTheDocument();
  });
});
