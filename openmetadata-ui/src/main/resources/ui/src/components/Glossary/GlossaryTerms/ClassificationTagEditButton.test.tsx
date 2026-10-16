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
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { getTags } from '../../../rest/tagAPI';
import ClassificationTagEditButton from './ClassificationTagEditButton.component';

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn(),
}));

const existingTag = {
  tagFQN: 'DataQualityFrequency.Daily',
  name: 'Daily',
  displayName: 'Hàng Ngày',
  source: TagSource.Classification,
  labelType: LabelType.Automated,
  state: State.Confirmed,
};

describe('ClassificationTagEditButton', () => {
  beforeEach(() => {
    (getTags as jest.Mock).mockResolvedValue({
      data: [
        { fullyQualifiedName: 'DataQualityFrequency.Daily', name: 'Daily' },
        {
          fullyQualifiedName: 'DataQualityFrequency.Monthly',
          name: 'Monthly',
          displayName: 'Hàng Tháng',
        },
      ],
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('loads the options once and opens without fetching again', async () => {
    render(
      <ClassificationTagEditButton
        classification="DataQualityFrequency"
        label="Tần suất"
        value={[existingTag]}
        onUpdate={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false')
    );

    fireEvent.click(screen.getByRole('button'));

    expect(
      await screen.findByTestId(
        'classification-option-DataQualityFrequency.Monthly'
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('label.cancel'));
    fireEvent.click(screen.getByRole('button'));

    expect(getTags).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing tag label and builds a manual label for a new pick', async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    render(
      <ClassificationTagEditButton
        classification="DataQualityFrequency"
        label="Tần suất"
        value={[existingTag]}
        onUpdate={onUpdate}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'false')
    );

    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(
      await screen.findByTestId(
        'classification-option-DataQualityFrequency.Monthly'
      )
    );
    fireEvent.click(screen.getByText('label.update'));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith([
        existingTag,
        expect.objectContaining({
          tagFQN: 'DataQualityFrequency.Monthly',
          displayName: 'Hàng Tháng',
          labelType: LabelType.Manual,
          source: TagSource.Classification,
        }),
      ])
    );
  });
});
