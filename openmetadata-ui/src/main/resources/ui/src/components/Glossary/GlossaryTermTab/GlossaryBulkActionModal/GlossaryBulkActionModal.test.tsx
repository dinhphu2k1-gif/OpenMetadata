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

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({ children, onPress, ...props }: any) => (
    <button {...props} onClick={onPress}>
      {children}
    </button>
  ),
}));

jest.mock('../../../../rest/glossaryAPI', () => ({
  transitionGlossaryTermWorkflow: jest.fn().mockResolvedValue({}),
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
      version: 1.1,
    } as ModifiedGlossaryTerm,
    {
      id: 'term-2',
      name: 'CDE002',
      displayName: 'Số tài khoản',
      fullyQualifiedName: 'Glossary.CDE002',
      entityStatus: EntityStatus.Draft,
      version: 1.2,
    } as ModifiedGlossaryTerm,
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render submit for review modal and patch terms with InReview status', async () => {
    render(
      <GlossaryBulkActionModal
        open
        actionType="submitForReview"
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
      expect(glossaryAPI.transitionGlossaryTermWorkflow).toHaveBeenCalledTimes(
        2
      );
      expect(
        glossaryAPI.transitionGlossaryTermWorkflow
      ).toHaveBeenCalledWith('term-1', 'submit', {
        expectedNativeVersion: 1.1,
      });
      expect(
        glossaryAPI.transitionGlossaryTermWorkflow
      ).toHaveBeenCalledWith('term-2', 'submit', {
        expectedNativeVersion: 1.2,
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should render approve modal and patch terms with Approved status', async () => {
    render(
      <GlossaryBulkActionModal
        open
        actionType="approve"
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
      expect(
        glossaryAPI.transitionGlossaryTermWorkflow
      ).toHaveBeenCalledWith('term-1', 'approve', {
        expectedNativeVersion: 1.1,
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should reject terms without requiring reason', async () => {
    render(
      <GlossaryBulkActionModal
        open
        actionType="reject"
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
      expect(
        glossaryAPI.transitionGlossaryTermWorkflow
      ).toHaveBeenCalledWith('term-1', 'reject', {
        expectedNativeVersion: 1.1,
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should patch terms with Draft status when revoking approval', async () => {
    render(
      <GlossaryBulkActionModal
        open
        actionType="revoke"
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
      expect(
        glossaryAPI.transitionGlossaryTermWorkflow
      ).toHaveBeenCalledWith('term-1', 'revoke', {
        expectedNativeVersion: 1.1,
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
