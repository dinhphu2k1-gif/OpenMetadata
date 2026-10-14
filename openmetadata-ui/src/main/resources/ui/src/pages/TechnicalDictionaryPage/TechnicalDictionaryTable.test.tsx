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
import { render, screen } from '@testing-library/react';
import { ColumnsType } from 'antd/lib/table';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import TechnicalDictionaryTable from './TechnicalDictionaryTable.component';

jest.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => jest.fn(),
}));
jest.mock(
  '../../components/common/GovernanceList/GovernanceListTable.component',
  () =>
    ({
      columns,
      dataSource,
      rowClassName,
    }: {
      columns: ColumnsType<TechnicalDictionaryRow>;
      dataSource: TechnicalDictionaryRow[];
      rowClassName: (row: TechnicalDictionaryRow) => string;
    }) =>
      (
        <table>
          <tbody>
            {dataSource.map((row, index) => (
              <tr
                className={rowClassName(row)}
                data-testid={`row-${row.key}`}
                key={row.key}>
                {columns.map((column) => (
                  <td
                    className={column.className}
                    data-testid={`${row.key}-${column.key}`}
                    key={column.key}>
                    {column.render?.(undefined, row, index) as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
);
jest.mock(
  '../../components/Glossary/GlossaryTerms/tabs/SurvivorshipRules/SurvivorshipBadge.component',
  () => () => null
);

const ROW = {
  key: 'term-1',
  termId: 'term-1',
  revision: 1,
  status: 'Approved',
  columnName: 'idno',
  columnFqn: 'svc.MISDB.ms1.TBCM_CUSTID.idno',
  databaseName: 'MISDB',
  schemaName: 'ms1',
  tableName: 'TBCM_CUSTID',
  serviceName: 'MIS',
  dataType: 'varchar2(20)',
  description: '',
  cdeCode: 'CDE4',
  cdeName: 'Thông tin ID khách hàng',
  dataOwners: [],
  systemOwners: [],
  sourceStatus: 'Available',
} as unknown as TechnicalDictionaryRow;

const renderTable = (rows: TechnicalDictionaryRow[]) =>
  render(
    <TechnicalDictionaryTable
      isLoading={false}
      page={1}
      pageSize={25}
      rows={rows}
      selectedRowKeys={[]}
      total={rows.length}
      onPageChange={jest.fn()}
      onPageSizeChange={jest.fn()}
      onSelectionChange={jest.fn()}
      onView={jest.fn()}
    />
  );

describe('TechnicalDictionaryTable', () => {
  it('pins the status column as the last column on the right', () => {
    renderTable([ROW]);

    const cells = screen.getByTestId('row-term-1').querySelectorAll('td');
    const statusCell = cells[cells.length - 1];

    expect(statusCell).toHaveAttribute('data-testid', 'term-1-status');
    expect(statusCell).toHaveClass('governance-status-cell');
  });

  it('shows a deleted record as a red "Deleted" status badge on a dimmed row', () => {
    renderTable([{ ...ROW, deleted: true, deletedBy: 'admin' }]);

    expect(screen.getByTestId('row-term-1')).toHaveClass(
      'tech-dict-row--deleted'
    );

    const badge = screen.getByTestId('deleted-idno');

    expect(badge).toHaveClass('status-badge', 'failure');
    expect(badge).toHaveTextContent('cde.deleted-record');
    expect(screen.queryByTestId('status-idno')).not.toBeInTheDocument();
  });

  it('leaves a pending deletion request to the pending requests tab, like the Data Dictionary', () => {
    renderTable([
      {
        ...ROW,
        hasPendingChange: true,
        changeOperation: 'DELETE',
        changeRequestStatus: 'InReview',
      },
    ]);

    expect(screen.getByTestId('status-idno')).toBeInTheDocument();
    expect(
      screen.getByTestId('term-1-status').querySelector('.ant-tag')
    ).not.toBeInTheDocument();
  });

  it('marks no pending update in the status column; the proposal is a row of its own', () => {
    renderTable([
      {
        ...ROW,
        hasPendingChange: true,
        changeOperation: 'UPDATE',
        changeRequestStatus: 'InReview',
      },
    ]);

    expect(
      screen.getByTestId('term-1-status').querySelector('.ant-tag')
    ).not.toBeInTheDocument();
  });
});
