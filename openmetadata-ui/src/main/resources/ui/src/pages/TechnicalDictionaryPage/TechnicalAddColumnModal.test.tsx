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
import {
  declareTechnicalColumn,
  searchTechnicalColumns,
} from '../../rest/technicalDictionaryAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import TechnicalAddColumnModal from './TechnicalAddColumnModal.component';

const DECLARED = {
  columnKey: 'key-declared',
  columnFqn: 'MIS.MISDB.aml.TBMS_CTR.declared',
  declared: true,
};
const FREE = {
  columnKey: 'key-free',
  columnFqn: 'MIS.MISDB.aml.TBMS_CTR.brcd',
  declared: false,
  sourceColumn: 'brcd',
};

jest.mock('../../rest/technicalDictionaryAPI', () => ({
  declareTechnicalColumn: jest.fn().mockResolvedValue({}),
  searchTechnicalColumns: jest.fn(),
}));
jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));
jest.mock('./TechnicalRecordModal.component', () => ({
  __esModule: true,
  default: ({
    mode,
    row,
    columnPicker,
    onSave,
  }: {
    mode: string;
    row?: { columnFqn: string };
    columnPicker?: {
      candidates: Array<{ columnKey: string; declared: boolean }>;
      onSelect: (candidate?: unknown) => void;
    };
    onSave: (values: unknown) => void;
  }) => (
    <div data-testid={`record-modal-${mode}`}>
      <span data-testid="picked-column">{row?.columnFqn ?? ''}</span>
      {columnPicker?.candidates.map((candidate) => (
        <button
          disabled={candidate.declared}
          key={candidate.columnKey}
          onClick={() => columnPicker.onSelect(candidate)}>
          {candidate.columnKey}
        </button>
      ))}
      <button
        onClick={() =>
          onSave({
            cde: { id: 'cde-1' },
            rank: 1,
            timeliness: 'DataTimeliness.T0',
          })
        }>
        save
      </button>
    </div>
  ),
}));

const renderModal = (onDone = jest.fn(), onClose = jest.fn()) =>
  render(
    <TechnicalAddColumnModal
      open
      dataDictionaryVersion="2"
      options={{} as never}
      onClose={onClose}
      onDone={onDone}
    />
  );

describe('TechnicalAddColumnModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (searchTechnicalColumns as jest.Mock).mockResolvedValue([DECLARED, FREE]);
  });

  it('offers the physical Columns and disables the ones already declared', async () => {
    renderModal();

    const declared = await screen.findByRole('button', {
      name: DECLARED.columnKey,
    });

    expect(declared).toBeDisabled();
    expect(screen.getByRole('button', { name: FREE.columnKey })).toBeEnabled();
    expect(searchTechnicalColumns).toHaveBeenCalledWith('', 20);
  });

  it('fills the form from the picked Column and declares it once with the form values', async () => {
    const onDone = jest.fn();
    const onClose = jest.fn();
    renderModal(onDone, onClose);

    expect(screen.getByTestId('picked-column')).toHaveTextContent('');

    fireEvent.click(
      await screen.findByRole('button', { name: FREE.columnKey })
    );

    expect(screen.getByTestId('picked-column')).toHaveTextContent(
      FREE.columnFqn
    );

    fireEvent.click(screen.getByText('save'));

    await waitFor(() =>
      expect(declareTechnicalColumn).toHaveBeenCalledTimes(1)
    );

    expect(declareTechnicalColumn).toHaveBeenCalledWith({
      columnFqn: FREE.columnFqn,
      cde: 'cde-1',
      rank: 1,
      elementType: undefined,
      generationType: undefined,
      creationMethod: undefined,
      timeliness: 'DataTimeliness.T0',
      systemOwnerId: undefined,
    });

    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(onClose).toHaveBeenCalled();
  });

  it('explains a 409 TD_COLUMN_ALREADY_DECLARED and clears the picked Column', async () => {
    (declareTechnicalColumn as jest.Mock).mockRejectedValue({
      response: { status: 409, data: { code: 'TD_COLUMN_ALREADY_DECLARED' } },
    });
    const onDone = jest.fn();
    renderModal(onDone);

    fireEvent.click(
      await screen.findByRole('button', { name: FREE.columnKey })
    );
    fireEvent.click(screen.getByText('save'));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(
        'message.technical-column-already-declared'
      )
    );

    expect(onDone).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(screen.getByTestId('picked-column')).toHaveTextContent('')
    );

    expect(searchTechnicalColumns).toHaveBeenCalledTimes(2);
  });

  it('does not declare anything before a Column is picked', async () => {
    renderModal();

    await screen.findByRole('button', { name: FREE.columnKey });
    fireEvent.click(screen.getByText('save'));

    expect(declareTechnicalColumn).not.toHaveBeenCalled();
  });
});
