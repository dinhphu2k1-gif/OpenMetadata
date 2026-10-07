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
import ReviewActionConfirmModal, {
  ReviewActionConfirmModalProps,
} from './ReviewActionConfirmModal.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    color,
    isDisabled,
    isLoading,
    onPress,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    color?: string;
    isDisabled?: boolean;
    isLoading?: boolean;
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button
      data-color={color}
      data-loading={isLoading ? 'true' : undefined}
      data-testid={testId}
      disabled={isDisabled}
      onClick={onPress}>
      {children}
    </button>
  ),
}));

const renderModal = (props: Partial<ReviewActionConfirmModalProps> = {}) =>
  render(
    <ReviewActionConfirmModal
      open
      action="submit"
      count={2}
      onCancel={jest.fn()}
      onConfirm={jest.fn()}
      {...props}
    />
  );

describe('ReviewActionConfirmModal', () => {
  it.each([
    ['submit', 'label.review-confirm-submit', 'message.review-confirm-submit'],
    [
      'approve',
      'label.review-confirm-approve',
      'message.review-confirm-approve',
    ],
    ['reject', 'label.review-confirm-reject', 'message.review-confirm-reject'],
    [
      'withdraw',
      'label.review-confirm-withdraw',
      'message.review-confirm-withdraw',
    ],
  ] as const)('titles and asks for %s', (action, title, question) => {
    renderModal({ action });

    expect(screen.getByTestId('modal-header')).toHaveTextContent(title);
    expect(screen.getByTestId('body-text')).toHaveTextContent(question);
  });

  it('always offers Cancel and Confirm, whatever the action', () => {
    renderModal({ action: 'approve' });

    expect(screen.getByTestId('cancel')).toHaveTextContent('label.cancel');
    expect(screen.getByTestId('save-button')).toHaveTextContent(
      'label.confirm'
    );
  });

  it('puts both buttons in the footer, which spaces them apart', () => {
    renderModal();

    const footer = document.querySelector('.review-action-confirm-footer');

    expect(footer).toContainElement(screen.getByTestId('cancel'));
    expect(footer).toContainElement(screen.getByTestId('save-button'));
  });

  it('makes Confirm destructive only for a rejection', () => {
    const { unmount } = renderModal({ action: 'reject' });

    expect(screen.getByTestId('save-button')).toHaveAttribute(
      'data-color',
      'primary-destructive'
    );

    unmount();
    renderModal({ action: 'submit' });

    expect(screen.getByTestId('save-button')).toHaveAttribute(
      'data-color',
      'primary'
    );
  });

  it('shows the given message instead of the default question', () => {
    renderModal({ message: 'Approve this glossary term?' });

    expect(screen.getByTestId('body-text')).toHaveTextContent(
      'Approve this glossary term?'
    );
  });

  it('shows no list of records', () => {
    renderModal();

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('calls Cancel and Confirm', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    renderModal({ onCancel, onConfirm });

    fireEvent.click(screen.getByTestId('cancel'));
    fireEvent.click(screen.getByTestId('save-button'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('cannot be cancelled while it is working', () => {
    renderModal({ isLoading: true });

    expect(screen.getByTestId('cancel')).toBeDisabled();
    expect(screen.getByTestId('save-button')).toHaveAttribute(
      'data-loading',
      'true'
    );
  });

  it('hides the buttons and the question while an action runs, keeping its content', () => {
    renderModal({
      hideActions: true,
      children: <div data-testid="progress">working</div>,
    });

    expect(screen.queryByTestId('save-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('body-text')).not.toBeInTheDocument();
    expect(screen.getByTestId('progress')).toBeInTheDocument();
  });
});
