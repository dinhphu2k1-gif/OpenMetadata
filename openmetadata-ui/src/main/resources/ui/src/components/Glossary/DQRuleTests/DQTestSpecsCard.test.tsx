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
import { DqTestSpecKind } from '../../../generated/type/dqTestSpecs';
import DQTestSpecsCard from './DQTestSpecsCard.component';

jest.mock('./DQRuleTests.utils', () => ({
  getDqDefinitionName: (_: unknown, fqn: string) => fqn,
}));

const specs = {
  items: [
    {
      key: 't1',
      name: 'Daily check',
      kind: DqTestSpecKind.Library,
      testDefinitionFqn: 'columnValuesToBeNotNull',
      scheduleCron: '0 2 * * *',
    },
    {
      key: 't2',
      name: 'Manual check',
      kind: DqTestSpecKind.Library,
      testDefinitionFqn: 'columnValuesToBeNotNull',
    },
    {
      key: 't3',
      name: 'Custom check',
      kind: DqTestSpecKind.Library,
      testDefinitionFqn: 'columnValuesToBeNotNull',
      scheduleCron: '30 6 * * *',
    },
  ],
};

describe('DQTestSpecsCard', () => {
  it('shows the schedule of every declaration', () => {
    render(<DQTestSpecsCard specs={specs} />);

    const schedules = screen.getAllByTestId('dq-test-schedule');

    expect(schedules).toHaveLength(3);
    expect(schedules[0]).toHaveTextContent('dq.test.schedule-daily');
    expect(schedules[1]).toHaveTextContent('dq.test.schedule-none');
    expect(schedules[2]).toHaveTextContent('30 6 * * *');
  });
});
