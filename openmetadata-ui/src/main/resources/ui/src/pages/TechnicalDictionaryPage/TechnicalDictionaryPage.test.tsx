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

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getGlossariesByName, getGlossaryTerms } from '../../rest/glossaryAPI';
import { getTableList } from '../../rest/tableAPI';
import { TechnicalDictionaryPage } from './TechnicalDictionaryPage.component';

jest.mock('../../rest/glossaryAPI', () => ({
  getGlossariesByName: jest.fn(),
  getGlossaryTerms: jest.fn(),
}));

jest.mock('../../rest/tableAPI', () => ({
  getTableList: jest.fn(),
  getTableDetailsByFQN: jest.fn(),
  patchTableDetails: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../components/common/Table/Table', () => {
  return jest.fn().mockImplementation(({ columns, dataSource, loading }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Table: AntTable } = jest.requireActual('antd');

    return (
      <AntTable
        columns={columns}
        dataSource={dataSource}
        loading={loading}
        pagination={false}
        rowKey="id"
      />
    );
  });
});

const mockGlossaryRes = {
  id: 'g-123',
  name: 'Data Dictionary',
  displayName: 'Từ điển dữ liệu dùng chung',
};

const mockTermsRes = {
  data: [
    {
      id: 't-1',
      name: 'CDE12',
      displayName: 'Địa chỉ khách hàng',
      fullyQualifiedName: 'Data Dictionary.CDE12',
    },
    {
      id: 't-2',
      name: 'CDE17',
      displayName: 'Ngày sinh',
      fullyQualifiedName: 'Data Dictionary.CDE17',
    },
  ],
};

const mockTablesRes = {
  data: [
    {
      id: 'tbl-1',
      name: 'AGR_USER',
      displayName: 'AGR_USER',
      fullyQualifiedName: 'MIS.MISDB.ms1.AGR_USER',
      database: { name: 'MISDB', fullyQualifiedName: 'MIS.MISDB' },
      databaseSchema: { name: 'ms1', fullyQualifiedName: 'MIS.MISDB.ms1' },
      service: { name: 'MIS' },
      columns: [
        {
          name: 'address',
          dataType: 'VARCHAR',
          dataTypeDisplay: 'VARCHAR(255)',
          dataLength: 255,
          tags: [
            {
              tagFQN: 'Data Dictionary.CDE12',
              source: 'Glossary',
            },
          ],
        },
        {
          name: 'birthday',
          dataType: 'DATE',
          dataTypeDisplay: 'DATE',
          tags: [
            {
              tagFQN: 'Data Dictionary.CDE17',
              source: 'Glossary',
            },
          ],
        },
      ],
    },
  ],
};

describe('TechnicalDictionary', () => {
  const mockData = [
    {
      id: 'MIS.MISDB.ms1.AGR_USER.address',
      databaseName: 'MISDB',
      databaseDisplayName: 'MISDB',
      databaseFqn: 'MIS.MISDB',
      schemaName: 'ms1',
      schemaDisplayName: 'ms1',
      schemaFqn: 'MIS.MISDB.ms1',
      tableId: 'tbl-1',
      tableName: 'AGR_USER',
      tableDisplayName: 'AGR_USER',
      tableFqn: 'MIS.MISDB.ms1.AGR_USER',
      columnName: 'address',
      columnDisplayName: 'address',
      columnFqn: 'MIS.MISDB.ms1.AGR_USER.address',
      serviceName: 'MIS',
      cdeCode: 'CDE12',
      cdeName: 'Địa chỉ khách hàng',
      cdeFqn: 'Data Dictionary.CDE12',
      dataType: 'VARCHAR',
      dataTypeDisplay: 'VARCHAR(255)',
      dataLength: 255,
      elementType: 'AtomicDataElement',
      elementTypeName: 'Dữ liệu nguyên tố',
      generationType: 'ManualInput',
      generationTypeName: 'Nhập thủ công',
      creationMethod: 'NotApplicable',
      creationMethodName: 'N/A',
      timeliness: 'T',
      systemOwner: 'Trung tâm Quản lý dữ liệu',
    },
    {
      id: 'MIS.MISDB.ms1.AGR_USER.birthday',
      databaseName: 'MISDB',
      databaseDisplayName: 'MISDB',
      databaseFqn: 'MIS.MISDB',
      schemaName: 'ms1',
      schemaDisplayName: 'ms1',
      schemaFqn: 'MIS.MISDB.ms1',
      tableId: 'tbl-1',
      tableName: 'AGR_USER',
      tableDisplayName: 'AGR_USER',
      tableFqn: 'MIS.MISDB.ms1.AGR_USER',
      columnName: 'birthday',
      columnDisplayName: 'birthday',
      columnFqn: 'MIS.MISDB.ms1.AGR_USER.birthday',
      serviceName: 'MIS',
      cdeCode: 'CDE17',
      cdeName: 'Ngày sinh',
      cdeFqn: 'Data Dictionary.CDE17',
      dataType: 'DATE',
      dataTypeDisplay: 'DATE',
      elementType: 'AtomicDataElement',
      elementTypeName: 'Dữ liệu nguyên tố',
      generationType: 'ManualInput',
      generationTypeName: 'Nhập thủ công',
      creationMethod: 'NotApplicable',
      creationMethodName: 'N/A',
      timeliness: 'T',
      systemOwner: 'Trung tâm Quản lý dữ liệu',
    },
  ];

  it('renders TechnicalDictionaryTable columns and data correctly', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TechnicalDictionaryTable = require('./TechnicalDictionaryTable.component').default;

    render(
      <MemoryRouter>
        <TechnicalDictionaryTable data={mockData} isLoading={false} />
      </MemoryRouter>
    );

    // Verify Database and Schema columns
    expect(screen.getAllByText('MISDB').length).toBeGreaterThan(0);
    expect(screen.getAllByText('ms1').length).toBeGreaterThan(0);

    // Verify Table and Column names
    expect(screen.getAllByText('AGR_USER').length).toBeGreaterThan(0);
    expect(screen.getByText('address')).toBeInTheDocument();
    expect(screen.getByText('birthday')).toBeInTheDocument();

    // Verify CDE codes and mapped attributes
    expect(screen.getByText(/CDE12/)).toBeInTheDocument();
    expect(screen.getByText(/CDE17/)).toBeInTheDocument();
    expect(screen.getAllByText('Dữ liệu nguyên tố').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nhập thủ công').length).toBeGreaterThan(0);
  });

  it('renders status column and handles edit action', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TechnicalDictionaryTable = require('./TechnicalDictionaryTable.component').default;
    const mockOnEdit = jest.fn();
    const mockOnApprove = jest.fn();
    const mockOnReject = jest.fn();

    const dataWithStatus = [
      {
        ...mockData[0],
        status: 'In Review',
      },
      {
        ...mockData[1],
        status: 'Approved',
      },
    ];

    render(
      <MemoryRouter>
        <TechnicalDictionaryTable
          data={dataWithStatus}
          isLoading={false}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onReject={mockOnReject}
        />
      </MemoryRouter>
    );

    // Verify status badges
    expect(screen.getByText('In Review')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();

    // Verify edit button is present and clickable
    const editBtn = screen.getByTestId('edit-btn-address');
    expect(editBtn).toBeInTheDocument();
    editBtn.click();
    expect(mockOnEdit).toHaveBeenCalledWith(dataWithStatus[0]);

    // Verify approve and reject buttons are rendered for 'In Review' item
    expect(screen.getByTestId('approve-btn-address')).toBeInTheDocument();
    expect(screen.getByTestId('reject-btn-address')).toBeInTheDocument();
  });

  it('enforces RBAC: Data Steward can approve/reject in-review items and revoke approved items, but cannot edit', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TechnicalDictionaryTable = require('./TechnicalDictionaryTable.component').default;
    const mockOnEdit = jest.fn();
    const mockOnApprove = jest.fn();
    const mockOnReject = jest.fn();
    const mockOnRevoke = jest.fn();

    const dataItems = [
      {
        ...mockData[0],
        columnName: 'address',
        status: 'In Review',
      },
      {
        ...mockData[1],
        columnName: 'user_id',
        status: 'Approved',
      },
    ];

    render(
      <MemoryRouter>
        <TechnicalDictionaryTable
          canApprove
          canEdit={false}
          canReject
          canRevoke
          data={dataItems}
          isLoading={false}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onReject={mockOnReject}
          onRevoke={mockOnRevoke}
        />
      </MemoryRouter>
    );

    // Data Steward: Edit button must NOT be rendered
    expect(screen.queryByTestId('edit-btn-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-btn-user_id')).not.toBeInTheDocument();

    // Data Steward: Approve & Reject buttons MUST be rendered for in-review item
    expect(screen.getByTestId('approve-btn-address')).toBeInTheDocument();
    expect(screen.getByTestId('reject-btn-address')).toBeInTheDocument();

    // Data Steward: Revoke button MUST be rendered for approved item
    expect(screen.getByTestId('revoke-btn-user_id')).toBeInTheDocument();
  });

  it('enforces RBAC: Data Proposer can edit but cannot approve/reject or revoke', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TechnicalDictionaryTable = require('./TechnicalDictionaryTable.component').default;
    const mockOnEdit = jest.fn();
    const mockOnApprove = jest.fn();
    const mockOnReject = jest.fn();
    const mockOnRevoke = jest.fn();

    const dataItems = [
      {
        ...mockData[0],
        columnName: 'address',
        status: 'In Review',
      },
      {
        ...mockData[1],
        columnName: 'user_id',
        status: 'Approved',
      },
    ];

    render(
      <MemoryRouter>
        <TechnicalDictionaryTable
          canApprove={false}
          canEdit
          canReject={false}
          canRevoke={false}
          data={dataItems}
          isLoading={false}
          onApprove={mockOnApprove}
          onEdit={mockOnEdit}
          onReject={mockOnReject}
          onRevoke={mockOnRevoke}
        />
      </MemoryRouter>
    );

    // Data Proposer: Edit button MUST be rendered
    expect(screen.getByTestId('edit-btn-address')).toBeInTheDocument();
    expect(screen.getByTestId('edit-btn-user_id')).toBeInTheDocument();

    // Data Proposer: Approve, Reject, and Revoke buttons must NOT be rendered
    expect(screen.queryByTestId('approve-btn-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-btn-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('revoke-btn-user_id')).not.toBeInTheDocument();
  });

  it('enforces RBAC: Data Consumer cannot edit, approve/reject, or revoke', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TechnicalDictionaryTable = require('./TechnicalDictionaryTable.component').default;

    const dataApproved = [
      {
        ...mockData[0],
        columnName: 'address',
        status: 'Approved',
      },
    ];

    render(
      <MemoryRouter>
        <TechnicalDictionaryTable
          canApprove={false}
          canEdit={false}
          canReject={false}
          canRevoke={false}
          data={dataApproved}
          isLoading={false}
        />
      </MemoryRouter>
    );

    // Data Consumer: No edit, approve/reject, or revoke buttons
    expect(screen.queryByTestId('edit-btn-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('approve-btn-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-btn-address')).not.toBeInTheDocument();
    expect(screen.queryByTestId('revoke-btn-address')).not.toBeInTheDocument();

    // Table view link remains accessible
    expect(screen.getByTestId('view-table-AGR_USER')).toBeInTheDocument();
  });

  describe('Backend metadata synchronization on approve and revoke', () => {
    it('removes CDE glossary and classification tags from table columns when revoked', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { removeColumnMetadataFromBackend } = require('./TechnicalDictionaryPage.component');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getTableDetailsByFQN, patchTableDetails } = require('../../rest/tableAPI');

      getTableDetailsByFQN.mockResolvedValueOnce({
        id: 'tbl-123',
        name: 'AGR_USER',
        columns: [
          {
            name: 'address',
            tags: [
              { tagFQN: 'Data Dictionary.CDE12', source: 'Glossary' },
              { tagFQN: 'DataElementType.AtomicDataElement', source: 'Classification' },
              { tagFQN: 'FieldGenerationType.ManualInput', source: 'Classification' },
              { tagFQN: 'DataCreationMethod.Parameterised', source: 'Classification' },
              { tagFQN: 'PII.Sensitive', source: 'Classification' },
            ],
          },
        ],
      });

      await removeColumnMetadataFromBackend({
        tableFqn: 'MIS.MISDB.ms1.AGR_USER',
        columnName: 'address',
      });

      expect(getTableDetailsByFQN).toHaveBeenCalledWith('MIS.MISDB.ms1.AGR_USER', {
        fields: 'columns,tags,extension',
      });

      expect(patchTableDetails).toHaveBeenCalledWith(
        'tbl-123',
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringMatching(/^\/columns\/0\/(tags|extension)/),
          }),
        ])
      );
    });

    it('attaches CDE glossary and classification tags to table columns when approved', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { syncColumnMetadataToBackend } = require('./TechnicalDictionaryPage.component');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getTableDetailsByFQN, patchTableDetails } = require('../../rest/tableAPI');

      getTableDetailsByFQN.mockResolvedValueOnce({
        id: 'tbl-123',
        name: 'AGR_USER',
        columns: [
          {
            name: 'address',
            tags: [{ tagFQN: 'PII.Sensitive', source: 'Classification' }],
          },
        ],
      });

      await syncColumnMetadataToBackend({
        tableFqn: 'MIS.MISDB.ms1.AGR_USER',
        columnName: 'address',
        cdeCode: 'CDE12',
        cdeFqn: 'Data Dictionary.CDE12',
        elementType: 'AtomicDataElement',
        generationType: 'ManualInput',
        creationMethod: 'Parameterised',
      });

      expect(patchTableDetails).toHaveBeenCalledWith(
        'tbl-123',
        expect.arrayContaining([
          expect.objectContaining({
            path: expect.stringMatching(/^\/columns\/0\/(tags|extension)/),
          }),
        ])
      );
    });

    it('persists proposed metadata with In Review status to backend table when submitted by proposer', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { syncColumnProposalToBackend } = require('./TechnicalDictionaryPage.component');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getTableDetailsByFQN, patchTableDetails } = require('../../rest/tableAPI');

      getTableDetailsByFQN.mockResolvedValueOnce({
        id: 'tbl-123',
        name: 'Account',
        columns: [
          {
            name: 'id',
            tags: [],
          },
        ],
      });

      await syncColumnProposalToBackend({
        tableFqn: 'MIS.MISDB.ms1.Account',
        columnName: 'id',
        cdeCode: 'CDE1',
        cdeName: 'Mã định danh tài khoản',
        cdeFqn: 'Data Dictionary.CDE1',
        elementType: 'AtomicDataElement',
        elementTypeName: 'Dữ liệu nguyên tố',
        generationType: 'SystemGenerated',
        generationTypeName: 'Tự sinh hệ thống',
        creationMethod: 'Parameterised',
        creationMethodName: 'Tham số hoá',
        timeliness: 'T',
        systemOwner: 'Trung tâm CNTT',
      });

      expect(getTableDetailsByFQN).toHaveBeenCalledWith('MIS.MISDB.ms1.Account', {
        fields: 'columns,tags,extension',
      });

      expect(patchTableDetails).toHaveBeenCalledWith(
        'tbl-123',
        expect.arrayContaining([
          expect.objectContaining({
            path: '/columns/0/extension',
            value: expect.objectContaining({
              cdeCode: 'CDE1',
              cdeName: 'Mã định danh tài khoản',
              status: 'In Review',
            }),
          }),
        ])
      );
    });

    it('persists rejected status to backend table when rejected by steward', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { rejectColumnMetadataOnBackend } = require('./TechnicalDictionaryPage.component');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getTableDetailsByFQN, patchTableDetails } = require('../../rest/tableAPI');

      getTableDetailsByFQN.mockResolvedValueOnce({
        id: 'tbl-123',
        name: 'Account',
        columns: [
          {
            name: 'id',
            tags: [],
            extension: {
              cdeCode: 'CDE1',
              status: 'In Review',
            },
          },
        ],
      });

      await rejectColumnMetadataOnBackend({
        tableFqn: 'MIS.MISDB.ms1.Account',
        columnName: 'id',
      });

      expect(patchTableDetails).toHaveBeenCalledWith(
        'tbl-123',
        expect.arrayContaining([
          expect.objectContaining({
            path: '/columns/0/extension/status',
            value: 'Rejected',
          }),
        ])
      );
    });
  });
});
