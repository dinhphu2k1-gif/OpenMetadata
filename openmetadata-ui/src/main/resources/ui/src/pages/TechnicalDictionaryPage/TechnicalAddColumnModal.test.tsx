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
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  const Select = ({
    children,
    onChange,
    value,
  }: {
    children: React.ReactNode;
    onChange: (value: string) => void;
    value?: string;
  }) => (
    <select
      data-testid="technical-add-column-select"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}>
      <option value="" />
      {children}
    </select>
  );
  Select.Option = ({
    disabled,
    value,
  }: {
    disabled?: boolean;
    value: string;
  }) => (
    <option disabled={disabled} value={value}>
      {value}
    </option>
  );

  return { ...actual, Select };
});
jest.mock('./TechnicalRecordModal.component', () => ({
  __esModule: true,
  default: ({
    mode,
    row,
    onSave,
  }: {
    mode: string;
    row: { columnFqn: string; termId: string };
    onSave: (values: unknown) => void;
  }) => (
    <div data-testid={`record-modal-${mode}`}>
      <span>{row.columnFqn}</span>
      <button
        onClick={() =>
          onSave({ cde: { id: 'cde-1' }, rank: 1, timeliness: 'DataTimeliness.T0' })
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
      businessVersion="2"
      glossaryId="glossary-1"
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

  it('lists Columns of the version and disables the ones already declared', async () => {
    renderModal();

    const declared = await screen.findByRole('option', { name: DECLARED.columnKey });

    expect(declared).toBeDisabled();
    expect(screen.getByRole('option', { name: FREE.columnKey })).toBeEnabled();
    expect(searchTechnicalColumns).toHaveBeenCalledWith(
      'glossary-1',
      '2',
      '',
      20
    );
  });

  it('declares the selected Column once with the values of the form', async () => {
    const onDone = jest.fn();
    const onClose = jest.fn();
    renderModal(onDone, onClose);

    await screen.findByRole('option', { name: FREE.columnKey });
    fireEvent.change(screen.getByTestId('technical-add-column-select'), {
      target: { value: FREE.columnKey },
    });
    fireEvent.click(screen.getByTestId('technical-add-column-next'));
    fireEvent.click(await screen.findByText('save'));

    await waitFor(() =>
      expect(declareTechnicalColumn).toHaveBeenCalledTimes(1)
    );
    expect(declareTechnicalColumn).toHaveBeenCalledWith('glossary-1', '2', {
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

  it('explains a 409 TD_COLUMN_ALREADY_DECLARED and returns to the picker', async () => {
    (declareTechnicalColumn as jest.Mock).mockRejectedValue({
      response: { status: 409, data: { code: 'TD_COLUMN_ALREADY_DECLARED' } },
    });
    const onDone = jest.fn();
    renderModal(onDone);

    await screen.findByRole('option', { name: FREE.columnKey });
    fireEvent.change(screen.getByTestId('technical-add-column-select'), {
      target: { value: FREE.columnKey },
    });
    fireEvent.click(screen.getByTestId('technical-add-column-next'));
    fireEvent.click(await screen.findByText('save'));

    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith(
        'message.technical-column-already-declared'
      )
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(await screen.findByTestId('technical-add-column-select')).toBeInTheDocument();
  });
});
