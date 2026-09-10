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

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityStatus } from '../../../../generated/entity/data/glossaryTerm';
import * as glossaryAPI from '../../../../rest/glossaryAPI';
import { ModifiedGlossaryTerm } from '../GlossaryTermTab.interface';
import GlossaryBulkActionModal from './GlossaryBulkActionModal.component';

jest.mock('../../../../rest/glossaryAPI', () => ({
  patchGlossaryTerm: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
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

describe('GlossaryBulkActionModal', () => {
  const mockOnCancel = jest.fn();
  const mockOnSuccess = jest.fn();

  const mockTerms: ModifiedGlossaryTerm[] = [
    {
      id: 'term-1',
      name: 'CDE001',
      displayName: 'Mã khách hàng',
      fullyQualifiedName: 'Glossary.CDE001',
      entityStatus: EntityStatus.Draft,
    } as ModifiedGlossaryTerm,
    {
      id: 'term-2',
      name: 'CDE002',
      displayName: 'Số tài khoản',
      fullyQualifiedName: 'Glossary.CDE002',
      entityStatus: EntityStatus.Draft,
    } as ModifiedGlossaryTerm,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render submit for review modal and patch terms with InReview status', async () => {
    render(
      <GlossaryBulkActionModal
        actionType="submitForReview"
        open={true}
        terms={mockTerms}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByText('Xác nhận gửi phê duyệt hàng loạt')
    ).toBeInTheDocument();
    expect(screen.getByText('CDE001')).toBeInTheDocument();
    expect(screen.getByText('CDE002')).toBeInTheDocument();

    const confirmBtn = screen.getByText('Xác nhận');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(glossaryAPI.patchGlossaryTerm).toHaveBeenCalledTimes(2);
      expect(glossaryAPI.patchGlossaryTerm).toHaveBeenCalledWith('term-1', [
        { op: 'replace', path: '/entityStatus', value: EntityStatus.InReview },
      ]);
      expect(glossaryAPI.patchGlossaryTerm).toHaveBeenCalledWith('term-2', [
        { op: 'replace', path: '/entityStatus', value: EntityStatus.InReview },
      ]);
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should render approve modal and patch terms with Approved status', async () => {
    render(
      <GlossaryBulkActionModal
        actionType="approve"
        open={true}
        terms={mockTerms}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByText('Xác nhận phê duyệt hàng loạt')
    ).toBeInTheDocument();

    const confirmBtn = screen.getByText('Xác nhận');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(glossaryAPI.patchGlossaryTerm).toHaveBeenCalledWith('term-1', [
        { op: 'replace', path: '/entityStatus', value: EntityStatus.Approved },
      ]);
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should patch terms with Draft status when rejecting without requiring reason', async () => {
    render(
      <GlossaryBulkActionModal
        actionType="reject"
        open={true}
        terms={mockTerms}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByText('Xác nhận từ chối hàng loạt')
    ).toBeInTheDocument();

    const confirmBtn = screen.getByText('Xác nhận');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(glossaryAPI.patchGlossaryTerm).toHaveBeenCalledWith('term-1', [
        { op: 'replace', path: '/entityStatus', value: EntityStatus.Draft },
      ]);
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should patch terms with Draft status when revoking approval', async () => {
    render(
      <GlossaryBulkActionModal
        actionType="revoke"
        open={true}
        terms={mockTerms}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByText('Xác nhận hủy duyệt hàng loạt')
    ).toBeInTheDocument();

    const confirmBtn = screen.getByText('Hủy duyệt');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(glossaryAPI.patchGlossaryTerm).toHaveBeenCalledWith('term-1', [
        { op: 'replace', path: '/entityStatus', value: EntityStatus.Draft },
      ]);
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
