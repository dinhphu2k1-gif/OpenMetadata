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
import * as dqUtils from '../../components/Glossary/DQImportExport/DQImportExport.utils';
import * as glossaryAPI from '../../rest/glossaryAPI';
import DQImportPage from './DQImportPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('react-data-grid', () => ({
  __esModule: true,
  default: jest.fn(({ rows, columns }) => (
    <div data-testid="data-grid">
      <div>Rows: {rows?.length ?? 0}</div>
      <div>Columns: {columns?.length ?? 0}</div>
      {rows?.map((row: any, rIdx: number) => (
        <div key={row.id || rIdx} data-testid={`grid-row-${rIdx}`}>
          {columns?.map((col: any) => (
            <div key={col.key} data-testid={`cell-${col.key}`}>
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
        typeof defaultValOrOptions === 'object'
          ? defaultValOrOptions
          : options;
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
    fqn: 'Data Quality',
  }),
}));

jest.mock('../../rest/glossaryAPI', () => ({
  getGlossariesByName: jest.fn().mockResolvedValue({
    id: 'glossary-dq-1',
    name: 'Data Quality',
    displayName: 'Chất lượng dữ liệu',
    fullyQualifiedName: 'Data Quality',
  }),
  getGlossaryTerms: jest.fn().mockResolvedValue({ data: [] }),
  addGlossaryTerm: jest.fn().mockResolvedValue({
    id: 'term-dq-1',
    name: 'DQ3.1',
    status: 'Draft',
  }),
  patchGlossaryTerm: jest.fn().mockResolvedValue({
    id: 'term-dq-1',
    name: 'DQ3.1',
    status: 'Draft',
  }),
}));

jest.mock('../../rest/tagAPI', () => ({
  getTags: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

describe('DQImportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render page layout, breadcrumbs, stepper, and upload dragger', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <DQImportPage />
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

    // Check duplicate handling options
    expect(screen.getByText('Bỏ qua')).toBeInTheDocument();
    expect(screen.getByText('Cập nhật')).toBeInTheDocument();

    // Check upload hint
    expect(
      screen.getByText(/Kéo thả tệp Excel/i)
    ).toBeInTheDocument();

    // Check template button
    expect(
      screen.getByText('Tải file mẫu Excel (.xlsx)')
    ).toBeInTheDocument();
  });

  it('should transition to Step 2 (Xem Trước Sửa) with DataGrid, add row, and navigation buttons', async () => {
    jest.spyOn(dqUtils, 'readAndValidateDQExcel').mockResolvedValue({
      totalRows: 1,
      validCount: 1,
      warningCount: 0,
      errorCount: 0,
      rows: [
        {
          rowNumber: 2,
          name: 'DQ3.1',
          cdeCode: 'CDE3',
          cdeName: 'Mã số khách hàng',
          dimension: 'Tính đầy đủ',
          description: 'Mã CIF không được NULL',
          ruleExplanation: 'Diễn giải quy tắc',
          otherConstraints: 'Không có',
          exceptions: 'Không',
          targetPopulation: 'Toàn nền khách hàng',
          method: 'SQL',
          frequency: 'Hàng Quý',
          qualityThreshold: '99%',
          dataSource: 'IPCAS',
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
          <DQImportPage />
        </MemoryRouter>
      );
    });

    const file = new File(['fake content'], 'DQ_test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const draggerInput = document.querySelector('input[type="file"]');
    expect(draggerInput).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(draggerInput!, { target: { files: [file] } });
    });

    // Step 2 should display: '+ Thêm hàng', 'Trước', and 'Tiếp theo'
    expect(screen.getByTestId('add-row-btn')).toBeInTheDocument();
    expect(screen.getByText('Trước')).toBeInTheDocument();
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
      screen.getByText(/Phát hiện.*bản ghi bị lỗi|Tất cả.*bản ghi đều hợp lệ/)
    ).toBeInTheDocument();

    // Rows in Step 3 (1 valid + 1 added row with missing fields)
    expect(screen.getByText('Rows: 2')).toBeInTheDocument();
    const filterGroup = screen.getByTestId('status-filter-group');
    expect(within(filterGroup).getByText('Bị lỗi')).toBeInTheDocument();
    expect(within(filterGroup).getByText('Hợp lệ')).toBeInTheDocument();

    // Switch filter to 'failure' (Bị lỗi) -> DataGrid receives 1 row
    const failureFilterBtn = within(filterGroup).getByText('Bị lỗi');
    await act(async () => {
      fireEvent.click(failureFilterBtn);
    });
    expect(screen.getByText('Rows: 1')).toBeInTheDocument();

    // Switch filter to 'success' (Hợp lệ) -> DataGrid receives 1 row
    const successFilterBtn = within(filterGroup).getByText('Hợp lệ');
    await act(async () => {
      fireEvent.click(successFilterBtn);
    });
    expect(screen.getByText('Rows: 1')).toBeInTheDocument();

    // Switch back to 'all' (Tất cả) -> DataGrid receives 2 rows
    const allFilterBtn = within(filterGroup).getByText('Tất cả');
    await act(async () => {
      fireEvent.click(allFilterBtn);
    });
    expect(screen.getByText('Rows: 2')).toBeInTheDocument();
  });

  it('should trigger download template when template link is clicked', async () => {
    const spyDownload = jest
      .spyOn(dqUtils, 'downloadDQExcelTemplate')
      .mockImplementation();

    await act(async () => {
      render(
        <MemoryRouter>
          <DQImportPage />
        </MemoryRouter>
      );
    });

    const downloadBtn = screen.getByText('Tải file mẫu Excel (.xlsx)');
    fireEvent.click(downloadBtn);

    expect(spyDownload).toHaveBeenCalled();
  });

  it('should import valid records into backend as Draft and show result screen', async () => {
    jest.spyOn(dqUtils, 'readAndValidateDQExcel').mockResolvedValue({
      totalRows: 1,
      validCount: 1,
      warningCount: 0,
      errorCount: 0,
      rows: [
        {
          rowNumber: 2,
          name: 'DQ3.1',
          cdeCode: 'CDE3',
          cdeName: 'Mã số khách hàng',
          dimension: 'Tính đầy đủ',
          description: 'Mã CIF không được NULL',
          ruleExplanation: 'Diễn giải quy tắc',
          otherConstraints: 'Không có',
          exceptions: 'Không',
          targetPopulation: 'Toàn nền khách hàng',
          method: 'SQL',
          frequency: 'Hàng Quý',
          qualityThreshold: '99%',
          dataSource: 'IPCAS',
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
          <DQImportPage />
        </MemoryRouter>
      );
    });

    const file = new File(['fake content'], 'DQ_test.xlsx', {
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

    // Step 3 -> Click 'Cập nhật'
    const updateButton = screen.getByTestId('update-button');
    await act(async () => {
      fireEvent.click(updateButton);
    });

    // Should call addGlossaryTerm
    expect(glossaryAPI.addGlossaryTerm).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'DQ3.1',
        status: 'Draft',
      })
    );

    // Completed result screen
    expect(
      screen.getByText('Hoàn tất nạp dữ liệu Quy tắc CLDL!')
    ).toBeInTheDocument();

    const submitAllBtn = screen.getByTestId('submit-all-imported-btn');
    expect(submitAllBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(submitAllBtn);
    });

    expect(glossaryAPI.patchGlossaryTerm).toHaveBeenCalledWith('term-dq-1', [
      {
        op: 'replace',
        path: '/entityStatus',
        value: 'In Review',
      },
    ]);
  });
});
