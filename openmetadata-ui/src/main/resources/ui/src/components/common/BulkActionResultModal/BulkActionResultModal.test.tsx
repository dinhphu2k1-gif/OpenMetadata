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
import { fireEvent, render, screen } from '@testing-library/react';
import BulkActionResultModal from './BulkActionResultModal.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    onPress,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} onClick={onPress}>
      {children}
    </button>
  ),
}));

describe('BulkActionResultModal', () => {
  it('lists each record with its outcome, the failed ones with their reason', () => {
    const onClose = jest.fn();
    render(
      <BulkActionResultModal
        open
        items={[
          { key: '1', name: 'CDE001', detail: 'Mã KH', succeeded: true },
          {
            key: '2',
            name: 'CDE002',
            succeeded: false,
            message: 'Stale revision',
          },
        ]}
        succeededLabel="Approved"
        testId="result"
        title="1/2"
        onClose={onClose}
      />
    );

    expect(screen.getByTestId('result-title')).toHaveTextContent('1/2');
    expect(screen.getByTestId('result-CDE001')).toHaveTextContent(
      'CDE001 (Mã KH)Approved'
    );
    expect(screen.getByTestId('result-CDE002')).toHaveClass(
      'bulk-action-result-item--failed'
    );
    expect(screen.getByTestId('result-CDE002')).toHaveTextContent(
      'Stale revision'
    );

    fireEvent.click(screen.getByTestId('result-close'));

    expect(onClose).toHaveBeenCalled();
  });
});
