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
import { TechnicalColumnCandidate } from '../../rest/technicalDictionaryAPI';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import { candidateToRow } from './TechnicalDictionaryRows';
import TechnicalRecordModal from './TechnicalRecordModal.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    color,
    isDisabled,
    onPress,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    color?: string;
    isDisabled?: boolean;
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button
      data-color={color}
      data-testid={testId}
      disabled={isDisabled}
      onClick={onPress}>
      {children}
    </button>
  ),
}));
jest.mock(
  '../../components/Glossary/CDESelectableList/CDESelectableField.component',
  () => ({
    __esModule: true,
    default: ({
      dataDictionaryVersion,
    }: {
      dataDictionaryVersion?: string;
    }) => <div data-testid="cde-selector">{dataDictionaryVersion}</div>,
  })
);
const CANDIDATE: TechnicalColumnCandidate = {
  columnKey: 'key-free',
  columnFqn: 'MIS.MISDB.aml.TBMS_CTR.brcd',
  declared: false,
  sourceTable: 'TBMS_CTR',
  sourceColumn: 'brcd',
  sourceDataType: 'VARCHAR',
};

const OPTIONS = {
  elementTypes: [],
  generationTypes: [],
  creationMethods: [],
  timeliness: [],
  teams: [],
  services: [],
} as never;

const renderCreate = (selected?: TechnicalColumnCandidate) =>
  render(
    <TechnicalRecordModal
      open
      columnPicker={{
        candidates: [CANDIDATE],
        isSearching: false,
        selectedKey: selected?.columnKey,
        onSearch: jest.fn(),
        onSelect: jest.fn(),
      }}
      dataDictionaryVersion="2"
      isSaving={false}
      mode="create"
      options={OPTIONS}
      row={selected ? candidateToRow(selected) : undefined}
      onCancel={jest.fn()}
      onSave={jest.fn()}
    />
  );

describe('TechnicalRecordModal create mode', () => {
  it('shows the Column picker and blocks Save until a Column is picked', () => {
    renderCreate();

    expect(
      screen.getByTestId('technical-add-column-select')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.technical-save-draft' })
    ).toBeDisabled();
  });

  it('scopes the CDE selector to the bound Data Dictionary version before any Column is picked', () => {
    renderCreate();

    expect(screen.getByTestId('cde-selector')).toHaveTextContent('2');
  });

  it('enables Save and shows the Column path once a Column is picked', () => {
    renderCreate(CANDIDATE);

    expect(
      screen.getByRole('button', { name: 'label.technical-save-draft' })
    ).toBeEnabled();
    expect(screen.getByTitle(CANDIDATE.columnFqn)).toBeInTheDocument();
  });

  it('does not show owner fields in create mode', () => {
    renderCreate(CANDIDATE);

    expect(screen.queryByText('label.data-owner')).not.toBeInTheDocument();
    expect(screen.queryByText('label.system-owner')).not.toBeInTheDocument();
  });

  it('uses the same modal shell as the Data Dictionary term form', () => {
    renderCreate(CANDIDATE);

    const modal = screen
      .getByTestId('technical-record-modal')
      .querySelector('.cde-glossary-term-modal');

    expect(modal).toHaveClass(
      'cde-glossary-term-modal',
      'cde-glossary-term-modal--cde',
      'cde-glossary-term-modal--add'
    );
    expect(screen.getByText('label.add-column')).toBeInTheDocument();
    expect(screen.getByTitle(CANDIDATE.columnFqn)).toHaveClass(
      'cde-glossary-modal-subtitle'
    );
    expect(
      screen.getByRole('button', { name: 'label.cancel' })
    ).toHaveAttribute('data-color', 'secondary');
    expect(
      screen.getByRole('button', { name: 'label.technical-save-draft' })
    ).toHaveAttribute('data-color', 'primary');
  });

  it('titles the shell with the Technical Dictionary before a Column is picked', () => {
    renderCreate();

    expect(screen.getByText('label.technical-dictionary')).toHaveClass(
      'cde-glossary-modal-subtitle'
    );
  });

  it('offers only Close, and no Save, in view mode', () => {
    render(
      <TechnicalRecordModal
        open
        isSaving={false}
        mode="view"
        options={OPTIONS}
        row={candidateToRow(CANDIDATE)}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'label.close' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.save' })
    ).not.toBeInTheDocument();
  });

  it('offers an edit action next to Close in view mode when the caller may edit', () => {
    const onEdit = jest.fn();
    render(
      <TechnicalRecordModal
        open
        isSaving={false}
        mode="view"
        options={OPTIONS}
        row={candidateToRow(CANDIDATE)}
        onCancel={jest.fn()}
        onEdit={onEdit}
        onSave={jest.fn()}
      />
    );

    screen.getByTestId('technical-record-edit').click();

    expect(onEdit).toHaveBeenCalled();
  });

  it('has no edit action once the form is already editable', () => {
    render(
      <TechnicalRecordModal
        open
        isSaving={false}
        mode="edit"
        options={OPTIONS}
        row={candidateToRow(CANDIDATE)}
        onCancel={jest.fn()}
        onEdit={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('technical-record-edit')
    ).not.toBeInTheDocument();
  });

  it('does not show the picker in edit mode', () => {
    render(
      <TechnicalRecordModal
        open
        isSaving={false}
        mode="edit"
        options={OPTIONS}
        row={candidateToRow(CANDIDATE)}
        onCancel={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(
      screen.queryByTestId('technical-add-column-select')
    ).not.toBeInTheDocument();
  });

  it('shows the change history and a delete action in edit mode', () => {
    const onDelete = jest.fn();
    render(
      <TechnicalRecordModal
        open
        dataDictionaryVersion="2"
        isSaving={false}
        mode="edit"
        options={OPTIONS}
        row={{ ...candidateToRow(CANDIDATE), termId: 'term-1', revision: 4 }}
        onCancel={jest.fn()}
        onDelete={onDelete}
        onSave={jest.fn()}
      />
    );

    screen.getByTestId('technical-record-delete').click();

    expect(onDelete).toHaveBeenCalled();
  });

  it('has no delete action while declaring a Column', () => {
    renderCreate(CANDIDATE);

    expect(
      screen.queryByTestId('technical-record-delete')
    ).not.toBeInTheDocument();
  });
});

const recordRow = (status: TechnicalDictionaryRow['status']) =>
  ({
    ...candidateToRow(CANDIDATE),
    termId: 'term-1',
    revision: 4,
    status,
    submittedBy: 'maker-user',
    submittedAt: 1_700_000_000_000,
    reviewedBy: 'checker-user',
    reviewedAt: 1_700_000_100_000,
    reviewComment: 'left by an older reviewer',
  } as TechnicalDictionaryRow);

const footerOf = () =>
  document.querySelector('.tech-record-footer') as HTMLElement;

describe('TechnicalRecordModal review', () => {
  const renderMode = (
    mode: 'review' | 'edit' | 'view',
    status: TechnicalDictionaryRow['status'],
    handlers: Record<string, () => void> = {}
  ) =>
    render(
      <TechnicalRecordModal
        open
        dataDictionaryVersion="2"
        isSaving={false}
        mode={mode}
        options={OPTIONS}
        row={recordRow(status)}
        onCancel={jest.fn()}
        onSave={jest.fn()}
        {...handlers}
      />
    );

  it('puts Close on the left and Reject and Approve on the right', () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    renderMode('review', 'In Review', { onApprove, onReject });

    const left = footerOf().children[0];
    const right = footerOf().querySelector('.tech-record-footer-actions');

    expect(left).toHaveTextContent('label.close');
    expect(right?.children).toHaveLength(2);

    const reject = screen.getByTestId('technical-record-reject');
    const approve = screen.getByTestId('technical-record-approve');

    expect(right?.children[0]).toBe(reject);
    expect(right?.children[1]).toBe(approve);
    expect(reject).toHaveAttribute('data-color', 'secondary-destructive');
    expect(approve).toHaveAttribute('data-color', 'primary');

    reject.click();
    approve.click();

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('keeps the edit action next to Close for a user who may edit', () => {
    renderMode('review', 'In Review', { onEdit: jest.fn() });

    expect(footerOf().children[0]).toContainElement(
      screen.getByTestId('technical-record-edit')
    );
  });

  it('shows the status next to the title and no submission or review details', () => {
    renderMode('review', 'In Review');

    expect(screen.getByTestId('technical-record-status')).toBeInTheDocument();
    expect(screen.queryByText('label.submitted-by')).not.toBeInTheDocument();
    expect(screen.queryByText('label.submitted-on')).not.toBeInTheDocument();
    expect(
      screen.queryByText('label.technical-reviewed-by')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('label.technical-reviewed-on')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('label.technical-rejection-reason')
    ).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('maker-user')).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue('left by an older reviewer')
    ).not.toBeInTheDocument();
  });

  it('shows no status while a Column is being declared', () => {
    renderCreate(CANDIDATE);

    expect(
      screen.queryByTestId('technical-record-status')
    ).not.toBeInTheDocument();
  });

  it('keeps Delete apart on the left and resubmits a rejected record', () => {
    const onDelete = jest.fn();
    renderMode('edit', 'Rejected', { onDelete });

    const left = footerOf().children[0];
    const resubmit = screen.getByRole('button', {
      name: 'label.technical-resubmit',
    });

    expect(left).toContainElement(
      screen.getByTestId('technical-record-delete')
    );
    expect(screen.getByTestId('technical-record-delete')).toHaveAttribute(
      'data-color',
      'tertiary-destructive'
    );
    expect(
      footerOf().querySelector('.tech-record-footer-actions')
    ).toContainElement(resubmit);
    expect(resubmit).toHaveAttribute('data-color', 'primary');
  });
});

describe('TechnicalRecordModal draft', () => {
  const renderDraft = (
    mode: 'view' | 'edit',
    handlers: Record<string, () => void> = {}
  ) =>
    render(
      <TechnicalRecordModal
        open
        dataDictionaryVersion="2"
        isSaving={false}
        mode={mode}
        options={OPTIONS}
        row={recordRow('Draft')}
        onCancel={jest.fn()}
        onSave={jest.fn()}
        {...handlers}
      />
    );

  it('offers Submit for approval next to Edit when a draft is viewed', () => {
    const onSubmit = jest.fn();
    renderDraft('view', { onEdit: jest.fn(), onSubmit });

    const actions = footerOf().querySelector('.tech-record-footer-actions');
    const submit = screen.getByTestId('technical-record-submit');

    expect(actions).toContainElement(submit);
    expect(submit).toHaveAttribute('data-color', 'primary');
    expect(submit).toHaveTextContent('label.technical-send-for-approval');

    submit.click();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows the draft status next to the title', () => {
    renderDraft('view');

    expect(screen.getByTestId('technical-record-status')).toHaveTextContent(
      'label.technical-draft'
    );
  });

  it('offers no submit action unless the caller may submit', () => {
    renderDraft('view');

    expect(
      screen.queryByTestId('technical-record-submit')
    ).not.toBeInTheDocument();
  });

  it('only saves while the draft is being edited', () => {
    renderDraft('edit', { onSubmit: jest.fn() });

    expect(
      screen.queryByTestId('technical-record-submit')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('technical-record-save')).toHaveTextContent(
      'label.save'
    );
  });

  it('saves a new Column as a draft instead of sending it for approval', () => {
    renderCreate(CANDIDATE);

    expect(
      screen.getByRole('button', { name: 'label.technical-save-draft' })
    ).toBeEnabled();
    expect(
      screen.queryByRole('button', {
        name: 'label.technical-send-for-approval',
      })
    ).not.toBeInTheDocument();
  });
});
