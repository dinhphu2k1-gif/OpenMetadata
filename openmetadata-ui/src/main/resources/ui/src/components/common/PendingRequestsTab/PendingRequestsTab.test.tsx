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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PendingRequestsTab from './PendingRequestsTab.component';
import {
  PendingRequest,
  PendingRequestsAdapter,
} from './PendingRequestsTab.interface';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('react-router-dom', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('../../../constants/Teams.constants', () => ({
  TABLE_CONSTANTS: undefined,
}));
jest.mock('../BulkSelectionBar/BulkSelectionBar.component', () => ({
  __esModule: true,
  default: ({
    actions,
    chips,
  }: {
    actions: Array<{ type: string; testId?: string; onPress: () => void }>;
    chips: Array<{ tone: string; label?: string; testId?: string }>;
  }) => (
    <div>
      {chips.map((chip) => (
        <span data-testid={chip.testId} key={chip.tone}>
          {chip.label}
        </span>
      ))}
      {actions.map((action) => (
        <button
          data-testid={action.testId}
          key={action.type}
          onClick={action.onPress}>
          {action.type}
        </button>
      ))}
    </div>
  ),
}));
jest.mock(
  '../ReviewActionConfirmModal/ReviewActionConfirmModal.component',
  () => ({
    __esModule: true,
    default: ({
      children,
      onConfirm,
    }: {
      children?: React.ReactNode;
      onConfirm: () => void;
    }) => (
      <div data-testid="confirmation-modal">
        {children}
        <button data-testid="confirm" onClick={onConfirm}>
          confirm
        </button>
      </div>
    ),
  })
);

const requests: PendingRequest[] = [
  { id: '1', code: 'CDE1', name: 'Name 1', version: '1.1', type: 'create' },
  { id: '2', code: 'CDE2', name: 'Name 2', version: '1.0', type: 'delete' },
];

const buildAdapter = (): PendingRequestsAdapter => ({
  fetchRequests: jest
    .fn()
    .mockResolvedValue({ items: requests, total: requests.length }),
  fetchTypeCounts: jest.fn().mockResolvedValue({
    create: 1,
    update: 0,
    delete: 1,
  }),
  fetchChangeDetail: jest.fn().mockResolvedValue({ fields: [] }),
  applyAction: jest.fn().mockResolvedValue({ succeeded: 2, failures: [] }),
});

describe('PendingRequestsTab', () => {
  it('lists the requests the adapter returns', async () => {
    render(<PendingRequestsTab canDecide adapter={buildAdapter()} />);

    expect(await screen.findByText('CDE1')).toBeInTheDocument();
    expect(screen.getByText('CDE2')).toBeInTheDocument();
    expect(screen.getByText('cde.term-code')).toBeInTheDocument();
    expect(screen.getByText('1.1')).toBeInTheDocument();
    expect(screen.getByText('1.0')).toBeInTheDocument();
  });

  it('reloads the requests when the host changes the refresh key', async () => {
    const adapter = buildAdapter();
    const { rerender } = render(
      <PendingRequestsTab canDecide adapter={adapter} refreshKey={0} />
    );

    await waitFor(() => expect(adapter.fetchRequests).toHaveBeenCalledTimes(1));

    rerender(
      <PendingRequestsTab canDecide adapter={adapter} refreshKey={1} />
    );

    await waitFor(() => expect(adapter.fetchRequests).toHaveBeenCalledTimes(2));
  });

  it('approves every selected request in one action', async () => {
    const adapter = buildAdapter();
    const onDecided = jest.fn();
    render(
      <PendingRequestsTab canDecide adapter={adapter} onDecided={onDecided} />
    );
    await screen.findByText('CDE1');

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(await screen.findByTestId('pending-requests-approve-btn'));
    fireEvent.click(screen.getByTestId('confirm'));

    await waitFor(() =>
      expect(adapter.applyAction).toHaveBeenCalledWith('approve', requests)
    );

    expect(onDecided).toHaveBeenCalledWith(
      { succeeded: 2, failures: [] },
      'approve'
    );
  });

  it('filters the adapter query with the selected request type', async () => {
    const adapter = buildAdapter();
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    await screen.findByText('CDE1');

    fireEvent.click(screen.getByTestId('pending-requests-type-delete'));

    await waitFor(() =>
      expect(adapter.fetchRequests).toHaveBeenLastCalledWith(
        expect.objectContaining({ types: ['delete'] })
      )
    );
  });

  it('loads change details only when a row is expanded', async () => {
    const adapter = buildAdapter();
    const updateRequest: PendingRequest = {
      id: '3',
      code: 'CDE3',
      name: 'Name 3',
      version: '1.2',
      type: 'update',
    };
    (adapter.fetchRequests as jest.Mock).mockResolvedValue({
      items: [...requests, updateRequest],
      total: 3,
    });
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    await screen.findByText('CDE3');

    expect(adapter.fetchChangeDetail).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('CDE3'));

    await waitFor(() =>
      expect(adapter.fetchChangeDetail).toHaveBeenCalledWith(updateRequest)
    );
  });

  it('puts the expand icon in the code cell, after the checkbox', async () => {
    render(<PendingRequestsTab canDecide adapter={buildAdapter()} />);
    const code = await screen.findByText('CDE1');
    const cell = code.closest('td');
    const row = code.closest('tr');

    expect(cell).toContainElement(screen.getAllByTestId('expand-icon')[0]);
    expect(row?.querySelector('td:first-child input[type="checkbox"]')).not.toBe(
      null
    );
  });

  it('expands add and delete requests too, each with an expand icon', async () => {
    const adapter = buildAdapter();
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    await screen.findByText('CDE1');

    expect(screen.getAllByTestId('expand-icon')).toHaveLength(2);

    fireEvent.click(screen.getByText('CDE1'));
    fireEvent.click(screen.getByText('CDE2'));

    await waitFor(() =>
      expect(adapter.fetchChangeDetail).toHaveBeenCalledTimes(2)
    );
  });

  it('toggles a row with its expand icon without ticking it', async () => {
    const adapter = buildAdapter();
    (adapter.fetchChangeDetail as jest.Mock).mockResolvedValue({
      fields: [{ label: 'Owner', value: 'User' }],
    });
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    await screen.findByText('CDE1');

    fireEvent.click(screen.getAllByTestId('expand-icon')[0]);

    expect(await screen.findByText('Owner')).toBeInTheDocument();
    expect(adapter.fetchChangeDetail).toHaveBeenCalledTimes(1);
    screen
      .getAllByRole('checkbox')
      .forEach((checkbox) => expect(checkbox).not.toBeChecked());

    fireEvent.click(screen.getAllByTestId('expand-icon')[0]);

    await waitFor(() =>
      expect(screen.getByText('Owner').closest('tr')).toHaveStyle({
        display: 'none',
      })
    );
  });

  it('collapses expanded rows when the request type filter changes', async () => {
    const adapter = buildAdapter();
    (adapter.fetchChangeDetail as jest.Mock).mockResolvedValue({
      fields: [{ label: 'Owner', value: 'User' }],
    });
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    await screen.findByText('CDE1');
    fireEvent.click(screen.getAllByTestId('expand-icon')[0]);
    await screen.findByText('Owner');

    fireEvent.click(screen.getByTestId('pending-requests-type-delete'));

    await waitFor(() =>
      expect(screen.queryByText('Owner')).not.toBeInTheDocument()
    );
  });

  it('shows "not yet set" without strike-through for a field that had no value', async () => {
    const adapter = buildAdapter();
    const updateRequest: PendingRequest = {
      id: '3',
      code: 'CDE3',
      name: 'Name 3',
      version: '1.2',
      type: 'update',
    };
    (adapter.fetchRequests as jest.Mock).mockResolvedValue({
      items: [updateRequest],
      total: 1,
    });
    (adapter.fetchChangeDetail as jest.Mock).mockResolvedValue({
      diffs: [
        {
          field: 'Group',
          oldValue: '--',
          newValue: 'Service',
          oldEmpty: true,
        },
      ],
    });
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    fireEvent.click(await screen.findByText('CDE3'));

    const oldValue = await screen.findByText('label.no-value-yet');

    expect(oldValue).toHaveClass(
      'pending-requests-old-value',
      'pending-requests-detail__empty'
    );
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(
      screen.getByText('message.changed-field-count')
    ).toBeInTheDocument();
  });

  it('lists only the fields with a value and sums up the empty ones', async () => {
    const adapter = buildAdapter();
    (adapter.fetchChangeDetail as jest.Mock).mockResolvedValue({
      fields: [
        { label: 'Owner', value: 'User' },
        { label: 'Source', value: '--', empty: true },
      ],
    });
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    fireEvent.click(await screen.findByText('CDE1'));

    expect(await screen.findByText('Owner')).toBeInTheDocument();
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
    expect(
      screen.getByText('message.empty-field-summary')
    ).toBeInTheDocument();
  });

  it('shows a placeholder for an empty business term name', async () => {
    const adapter = buildAdapter();
    (adapter.fetchRequests as jest.Mock).mockResolvedValue({
      items: [{ ...requests[0], name: '' }],
      total: 1,
    });
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    const row = (await screen.findByText('CDE1')).closest('tr');

    expect(row).toHaveTextContent('--');
  });

  it('warns only for a delete request, with no icon for the others', async () => {
    const adapter = buildAdapter();
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    await screen.findByText('CDE1');

    fireEvent.click(screen.getByText('CDE1'));
    await screen.findByText('label.proposed-information');

    expect(
      document.querySelector('.pending-requests-detail__warning-icon')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('CDE2'));
    await screen.findByText('message.pending-delete-approval-warning');

    expect(
      document.querySelector('.pending-requests-detail__warning-icon')
    ).toBeInTheDocument();
  });

  it('does not repeat the code and name inside the detail', async () => {
    const adapter = buildAdapter();
    (adapter.fetchChangeDetail as jest.Mock).mockResolvedValue({
      fields: [{ label: 'Owner', value: 'User' }],
    });
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    fireEvent.click(await screen.findByText('CDE1'));

    await screen.findByText('Owner');

    expect(screen.queryByText('CDE1 · Name 1')).not.toBeInTheDocument();
    expect(screen.queryByText('label.details')).not.toBeInTheDocument();
  });

  it('shows one selection chip for each selected request type', async () => {
    render(<PendingRequestsTab canDecide adapter={buildAdapter()} />);
    await screen.findByText('CDE1');

    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    expect(
      screen.getByTestId('pending-requests-create-count')
    ).toHaveTextContent('1 label.request-type-create');
    expect(
      screen.getByTestId('pending-requests-delete-count')
    ).toHaveTextContent('1 label.request-type-delete');
  });

  it('does not render a reason input in the confirmation modal', async () => {
    render(<PendingRequestsTab canDecide adapter={buildAdapter()} />);
    await screen.findByText('CDE1');
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByTestId('pending-requests-reject-btn'));

    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows disabled selection and no decision when the user cannot decide', async () => {
    render(<PendingRequestsTab adapter={buildAdapter()} canDecide={false} />);
    await screen.findByText('CDE1');

    screen
      .getAllByRole('checkbox')
      .forEach((checkbox) => expect(checkbox).toBeDisabled());

    expect(
      screen.queryByTestId('pending-requests-approve-btn')
    ).not.toBeInTheDocument();
  });

  it('lets a proposer tick and withdraw only their own requests', async () => {
    const adapter = buildAdapter();
    const own: PendingRequest = { ...requests[0], canWithdraw: true };
    (adapter.fetchRequests as jest.Mock).mockResolvedValue({
      items: [own, requests[1]],
      total: 2,
    });
    render(<PendingRequestsTab adapter={adapter} canDecide={false} />);
    await screen.findByText('CDE1');

    const checkboxes = screen.getAllByRole('checkbox');
    const rowCheckboxes = checkboxes.slice(1);

    expect(rowCheckboxes[0]).toBeEnabled();
    expect(rowCheckboxes[1]).toBeDisabled();

    fireEvent.click(rowCheckboxes[0]);

    expect(
      screen.queryByTestId('pending-requests-approve-btn')
    ).not.toBeInTheDocument();

    fireEvent.click(await screen.findByTestId('pending-requests-withdraw-btn'));
    fireEvent.click(screen.getByTestId('confirm'));

    await waitFor(() =>
      expect(adapter.applyAction).toHaveBeenCalledWith('withdraw', [own])
    );
  });

  it('withdraws only the own requests when an approver selects others too', async () => {
    const adapter = buildAdapter();
    const own: PendingRequest = { ...requests[0], canWithdraw: true };
    (adapter.fetchRequests as jest.Mock).mockResolvedValue({
      items: [own, requests[1]],
      total: 2,
    });
    render(<PendingRequestsTab canDecide adapter={adapter} />);
    await screen.findByText('CDE1');

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(await screen.findByTestId('pending-requests-withdraw-btn'));
    fireEvent.click(screen.getByTestId('confirm'));

    await waitFor(() =>
      expect(adapter.applyAction).toHaveBeenCalledWith('withdraw', [own])
    );
  });
});
