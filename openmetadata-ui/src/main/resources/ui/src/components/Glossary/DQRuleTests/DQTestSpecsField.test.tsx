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
  DqTestSpecKind,
  DqTestSpecs,
} from '../../../generated/type/dqTestSpecs';
import {
  listDqLibraryTestDefinitions,
  previewDqRuleTests,
} from '../../../rest/dqRuleTestAPI';
import DQTestSpecsField, {
  isDqTestSpecsValid,
} from './DQTestSpecsField.component';

jest.mock('../../../rest/dqRuleTestAPI', () => ({
  listDqLibraryTestDefinitions: jest.fn().mockResolvedValue([
    {
      fqn: 'columnValuesToBeNotNull',
      name: 'columnValuesToBeNotNull',
      displayName: 'Not null',
      supportsRowLevelPassedFailed: true,
      parameterDefinition: [],
    },
    {
      fqn: 'columnValuesToMatchRegex',
      name: 'columnValuesToMatchRegex',
      displayName: 'Regex',
      supportsRowLevelPassedFailed: false,
      parameterDefinition: [
        {
          name: 'regex',
          displayName: 'Regex',
          required: true,
          dataType: 'STRING',
        },
      ],
    },
  ]),
  previewDqRuleTests: jest.fn().mockResolvedValue({
    columns: [
      {
        columnKey: 'k1',
        columnFqn: 'core.default.s.kh.cccd',
        tests: [
          { index: 0, name: 'x', applicable: false, reason: 'DATA_TYPE' },
        ],
      },
    ],
    totals: { specs: 1, columns: 1, testCases: 0, notApplicable: 1 },
  }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('isDqTestSpecsValid', () => {
  it('accepts no declarations', () => {
    expect(isDqTestSpecsValid(undefined)).toBe(true);
    expect(isDqTestSpecsValid({ items: [] })).toBe(true);
  });

  it('needs a name and a definition or a query', () => {
    expect(
      isDqTestSpecsValid({
        items: [
          { name: 'a', kind: DqTestSpecKind.Library, testDefinitionFqn: 'x' },
        ],
      })
    ).toBe(true);
    expect(
      isDqTestSpecsValid({
        items: [{ name: 'a', kind: DqTestSpecKind.Library }],
      })
    ).toBe(false);
    expect(
      isDqTestSpecsValid({
        items: [
          { name: ' ', kind: DqTestSpecKind.SQL, sqlExpression: 'SELECT 1' },
        ],
      })
    ).toBe(false);
    expect(
      isDqTestSpecsValid({
        items: [{ name: 'a', kind: DqTestSpecKind.SQL, sqlExpression: ' ' }],
      })
    ).toBe(false);
  });
});

describe('DQTestSpecsField', () => {
  const renderField = (value?: DqTestSpecs, onChange = jest.fn()) => {
    render(
      <DQTestSpecsField
        cdeTermId="cde-1"
        defaultKind={DqTestSpecKind.Library}
        ruleThreshold=">= 99%"
        value={value}
        onChange={onChange}
      />
    );

    return onChange;
  };

  it('shows the empty state when nothing is declared', async () => {
    renderField();

    expect(
      await screen.findByTestId('dq-test-specs-empty')
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(listDqLibraryTestDefinitions).toHaveBeenCalled()
    );
  });

  it('adds a declaration of the default kind', async () => {
    const onChange = renderField();

    fireEvent.click(await screen.findByTestId('dq-test-add'));

    expect(onChange).toHaveBeenCalledWith({
      schemaVersion: 1,
      items: [
        {
          name: '',
          kind: DqTestSpecKind.Library,
          parameterValues: [],
          computePassedFailedRowCount: false,
        },
      ],
    });
  });

  it('removes a declaration', async () => {
    const onChange = renderField({
      items: [
        { key: 't1', name: 'a', kind: DqTestSpecKind.SQL, sqlExpression: 'x' },
        { key: 't2', name: 'b', kind: DqTestSpecKind.SQL, sqlExpression: 'y' },
      ],
    });

    fireEvent.click(await screen.findByTestId('dq-test-remove-0'));

    expect(onChange).toHaveBeenCalledWith({
      schemaVersion: 1,
      items: [
        { key: 't2', name: 'b', kind: DqTestSpecKind.SQL, sqlExpression: 'y' },
      ],
    });
  });

  it('edits the name and the SQL of a declaration', async () => {
    const onChange = renderField({
      items: [
        { key: 't1', name: 'a', kind: DqTestSpecKind.SQL, sqlExpression: 'x' },
      ],
    });

    fireEvent.change(await screen.findByTestId('dq-test-name-0'), {
      target: { value: 'Renamed' },
    });
    fireEvent.change(screen.getByTestId('dq-test-sql-0'), {
      target: { value: 'SELECT 1' },
    });

    expect(onChange).toHaveBeenNthCalledWith(1, {
      schemaVersion: 1,
      items: [
        {
          key: 't1',
          name: 'Renamed',
          kind: DqTestSpecKind.SQL,
          sqlExpression: 'x',
        },
      ],
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      schemaVersion: 1,
      items: [
        {
          key: 't1',
          name: 'a',
          kind: DqTestSpecKind.SQL,
          sqlExpression: 'SELECT 1',
        },
      ],
    });
  });

  it('previews the columns the declarations apply to', async () => {
    renderField({
      items: [
        { key: 't1', name: 'a', kind: DqTestSpecKind.SQL, sqlExpression: 'x' },
      ],
    });

    fireEvent.click(await screen.findByTestId('dq-test-preview-button'));

    expect(await screen.findByTestId('dq-test-preview')).toHaveTextContent(
      'core.default.s.kh.cccd'
    );
    expect(previewDqRuleTests).toHaveBeenCalledWith('cde-1', {
      schemaVersion: 1,
      items: [
        { key: 't1', name: 'a', kind: DqTestSpecKind.SQL, sqlExpression: 'x' },
      ],
    });
  });
});
