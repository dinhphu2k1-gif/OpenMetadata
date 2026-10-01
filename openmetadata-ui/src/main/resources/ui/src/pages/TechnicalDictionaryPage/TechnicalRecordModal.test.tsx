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
  '../../components/Glossary/CDESelector/CDESelector.component',
  () => ({
    __esModule: true,
    default: ({
      parentBusinessVersion,
    }: {
      parentBusinessVersion?: string;
    }) => <div data-testid="cde-selector">{parentBusinessVersion}</div>,
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
    expect(screen.getByRole('button', { name: 'label.save' })).toBeDisabled();
  });

  it('scopes the CDE selector to the bound Data Dictionary version before any Column is picked', () => {
    renderCreate();

    expect(screen.getByTestId('cde-selector')).toHaveTextContent('2');
  });

  it('enables Save and shows the Column path once a Column is picked', () => {
    renderCreate(CANDIDATE);

    expect(screen.getByRole('button', { name: 'label.save' })).toBeEnabled();
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
    expect(screen.getByRole('button', { name: 'label.save' })).toHaveAttribute(
      'data-color',
      'primary'
    );
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
