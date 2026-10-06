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
import BulkSelectionBar from './BulkSelectionBar.component';
import {
  BulkSelectionAction,
  BulkSelectionBarProps,
} from './BulkSelectionBar.interface';

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    color,
    onPress,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    color?: string;
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-color={color} data-testid={testId} onClick={onPress}>
      {children}
    </button>
  ),
}));

const action = (
  type: BulkSelectionAction['type'],
  count = 1
): BulkSelectionAction => ({
  type,
  count,
  testId: `action-${type}`,
  onPress: jest.fn(),
});

const renderBar = (props: Partial<BulkSelectionBarProps> = {}) =>
  render(
    <BulkSelectionBar
      actions={[]}
      chips={[]}
      clearTestId="clear"
      countTestId="count"
      selectedCount={3}
      testId="bar"
      onClear={jest.fn()}
      {...props}
    />
  );

describe('BulkSelectionBar', () => {
  it('shows how many records are selected and clears the selection', () => {
    const onClear = jest.fn();
    renderBar({ onClear });

    expect(screen.getByTestId('count')).toHaveTextContent(
      'label.bulk-selected-count'
    );

    fireEvent.click(screen.getByTestId('clear'));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('shows a chip for each status it is given, in the given order', () => {
    renderBar({
      chips: [
        { tone: 'draft', count: 1, testId: 'chip-draft' },
        { tone: 'rejected', count: 1, testId: 'chip-rejected' },
        { tone: 'approved', count: 2, testId: 'chip-approved' },
      ],
    });

    const chips = screen
      .getByTestId('bar')
      .querySelectorAll('.bulk-selection-chip');

    expect(chips).toHaveLength(3);
    expect(chips[0]).toHaveClass('bulk-selection-chip--draft');
    expect(chips[1]).toHaveClass('bulk-selection-chip--rejected');
    expect(chips[2]).toHaveClass('bulk-selection-chip--approved');
    expect(screen.getByTestId('chip-draft')).toBeInTheDocument();
  });

  it('shows only the given actions, submit then reject then approve', () => {
    renderBar({
      actions: [action('approve'), action('submit'), action('reject')],
    });

    const buttons = screen.getAllByRole('button').slice(1);

    expect(buttons.map((button) => button.getAttribute('data-testid'))).toEqual(
      ['action-submit', 'action-reject', 'action-approve']
    );
  });

  it('makes approve the main action and submit a secondary one beside it', () => {
    renderBar({ actions: [action('submit'), action('approve')] });

    expect(screen.getByTestId('action-approve')).toHaveAttribute(
      'data-color',
      'primary'
    );
    expect(screen.getByTestId('action-submit')).toHaveAttribute(
      'data-color',
      'secondary'
    );
  });

  it('makes submit the main action when nothing can be approved', () => {
    renderBar({ actions: [action('submit')] });

    expect(screen.getByTestId('action-submit')).toHaveAttribute(
      'data-color',
      'primary'
    );
  });

  it('draws reject as a destructive outline', () => {
    renderBar({ actions: [action('reject'), action('approve')] });

    expect(screen.getByTestId('action-reject')).toHaveAttribute(
      'data-color',
      'secondary-destructive'
    );
  });

  it('calls the handler of the action that was pressed', () => {
    const approve = action('approve');
    renderBar({ actions: [approve] });

    fireEvent.click(screen.getByTestId('action-approve'));

    expect(approve.onPress).toHaveBeenCalledTimes(1);
  });

  it('says so, instead of showing disabled buttons, when no action applies', () => {
    renderBar({ actions: [] });

    expect(screen.getByText('message.bulk-no-actions')).toBeInTheDocument();
  });

  it('does not say so when there are actions', () => {
    renderBar({ actions: [action('approve')] });

    expect(
      screen.queryByText('message.bulk-no-actions')
    ).not.toBeInTheDocument();
  });
});
