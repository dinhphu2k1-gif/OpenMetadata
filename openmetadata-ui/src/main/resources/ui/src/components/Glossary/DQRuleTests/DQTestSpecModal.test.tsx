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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { DqTestSpecKind } from '../../../generated/type/dqTestSpecs';
import { previewDqRuleTests } from '../../../rest/dqRuleTestAPI';
import DQTestSpecModal, {
  DQTestSpecModalProps,
} from './DQTestSpecModal.component';

jest.mock('../../../rest/dqRuleTestAPI', () => ({
  listDqLibraryTestDefinitions: jest
    .fn()
    .mockResolvedValue([{ fqn: 'columnValuesToBeNotNull' }]),
  previewDqSchedule: jest.fn().mockResolvedValue({ nextRuns: [] }),
  previewDqRuleTests: jest.fn().mockResolvedValue({
    columns: [],
    totals: { specs: 1, columns: 2, testCases: 2, notApplicable: 0 },
  }),
}));

jest.mock('../../../rest/testAPI', () => ({
  getListTestDefinitions: jest.fn().mockResolvedValue({
    data: [
      {
        name: 'columnValuesToBeNotNull',
        fullyQualifiedName: 'columnValuesToBeNotNull',
        displayName: 'Not null',
        parameterDefinition: [],
      },
    ],
  }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../Database/SchemaEditor/CodeEditor', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (value: string) => void;
  }) => (
    <textarea
      data-testid="sql-editor"
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

describe('DQTestSpecModal', () => {
  // The form is seeded once the test definitions have loaded; typing earlier would be overwritten.
  const renderModal = async (props: Partial<DQTestSpecModalProps> = {}) => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <DQTestSpecModal
        open
        cdeTermId="cde-1"
        defaultKind={DqTestSpecKind.SQL}
        otherNames={['existing']}
        onCancel={jest.fn()}
        onSave={onSave}
        {...props}
      />
    );
    await act(async () => {});

    return onSave;
  };

  it('saves a new SQL declaration', async () => {
    const onSave = await renderModal();

    fireEvent.change(await screen.findByTestId('dq-test-name'), {
      target: { value: 'No blanks' },
    });
    fireEvent.change(screen.getByTestId('sql-editor'), {
      target: { value: 'SELECT 1' },
    });
    fireEvent.click(screen.getByTestId('dq-test-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'No blanks',
      kind: DqTestSpecKind.SQL,
      sqlExpression: 'SELECT 1',
    });
  });

  it('refuses a name already used by another declaration', async () => {
    const onSave = await renderModal();

    fireEvent.change(await screen.findByTestId('dq-test-name'), {
      target: { value: ' Existing ' },
    });
    fireEvent.change(screen.getByTestId('sql-editor'), {
      target: { value: 'SELECT 1' },
    });
    fireEvent.click(screen.getByTestId('dq-test-save'));

    expect(
      await screen.findByText('dq.test.name-duplicate')
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps the key of an edited declaration', async () => {
    const onSave = await renderModal({
      defaultKind: DqTestSpecKind.Library,
      spec: {
        key: 'k-1',
        name: 'Not blank',
        kind: DqTestSpecKind.Library,
        testDefinitionFqn: 'columnValuesToBeNotNull',
      },
    });

    await waitFor(() =>
      expect(screen.getByTestId('dq-test-name')).toHaveValue('Not blank')
    );
    fireEvent.click(screen.getByTestId('dq-test-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    expect(onSave.mock.calls[0][0]).toMatchObject({
      key: 'k-1',
      testDefinitionFqn: 'columnValuesToBeNotNull',
    });
  });

  it('keeps the schedule of an edited declaration and saves none by default', async () => {
    const onSave = await renderModal({
      defaultKind: DqTestSpecKind.Library,
      spec: {
        key: 'k-1',
        name: 'Not blank',
        kind: DqTestSpecKind.Library,
        testDefinitionFqn: 'columnValuesToBeNotNull',
        scheduleCron: '0 2 * * *',
        scheduleTimezone: 'Asia/Ho_Chi_Minh',
      },
    });

    await waitFor(() =>
      expect(screen.getByTestId('dq-test-name')).toHaveValue('Not blank')
    );
    fireEvent.click(screen.getByTestId('dq-test-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    expect(onSave.mock.calls[0][0]).toMatchObject({
      scheduleCron: '0 2 * * *',
      scheduleTimezone: 'Asia/Ho_Chi_Minh',
    });
  });

  it('saves a declaration without a schedule', async () => {
    const onSave = await renderModal();

    fireEvent.change(await screen.findByTestId('dq-test-name'), {
      target: { value: 'No blanks' },
    });
    fireEvent.change(screen.getByTestId('sql-editor'), {
      target: { value: 'SELECT 1' },
    });
    fireEvent.click(screen.getByTestId('dq-test-save'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    expect(onSave.mock.calls[0][0].scheduleCron).toBeUndefined();
    expect(onSave.mock.calls[0][0].scheduleTimezone).toBeUndefined();
  });

  it('previews the declaration against the CDE columns', async () => {
    await renderModal();

    fireEvent.change(await screen.findByTestId('dq-test-name'), {
      target: { value: 'No blanks' },
    });
    fireEvent.change(screen.getByTestId('sql-editor'), {
      target: { value: 'SELECT 1' },
    });
    fireEvent.click(screen.getByTestId('dq-test-preview-button'));

    expect(await screen.findByTestId('dq-test-preview')).toBeInTheDocument();
    expect(previewDqRuleTests).toHaveBeenCalledWith('cde-1', {
      schemaVersion: 1,
      items: [expect.objectContaining({ name: 'No blanks' })],
    });
  });
});
