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
import ClassificationSelect from './ClassificationSelect.component';
import { ClassificationOption } from './ClassificationSelect.interface';

jest.mock('../../../assets/svg/classification.svg', () => ({
  ReactComponent: () => <span data-testid="classification-icon" />,
}));

const makeOptions = (count: number): ClassificationOption[] =>
  Array.from({ length: count }, (_, index) => ({
    value: `Cls.Tag${index}`,
    label: `Tag ${index}`,
  }));

const renderSelect = (
  props: Partial<React.ComponentProps<typeof ClassificationSelect>> = {}
) =>
  render(
    <ClassificationSelect
      options={makeOptions(3)}
      placeholder="Pick one"
      searchPlaceholder="Search"
      {...props}
    />
  );

const openDropdown = () => fireEvent.click(screen.getByText(/Pick one|Tag \d/));

describe('ClassificationSelect', () => {
  it('shows the placeholder while nothing is chosen', () => {
    renderSelect();

    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('lists every option with an icon and a search box', async () => {
    renderSelect();
    openDropdown();

    expect(await screen.findAllByRole('option')).toHaveLength(3);
    expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
    expect(screen.getAllByTestId('classification-icon').length).toBeGreaterThan(
      2
    );
  });

  it('single mode stages one pick and commits it on Update', async () => {
    const onChange = jest.fn();
    renderSelect({ mode: 'single', onChange, value: ['Cls.Tag0'] });
    openDropdown();
    fireEvent.click(await screen.findByTitle('Tag 1'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTitle('Tag 0')).toHaveAttribute(
      'aria-selected',
      'false'
    );

    fireEvent.click(screen.getByText('label.update'));

    expect(onChange).toHaveBeenCalledWith(['Cls.Tag1']);
    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    );
  });

  it('multiple mode toggles staged values and commits them on Update', async () => {
    const onChange = jest.fn();
    renderSelect({ mode: 'multiple', onChange, value: ['Cls.Tag0'] });
    openDropdown();
    fireEvent.click(await screen.findByTitle('Tag 1'));
    fireEvent.click(screen.getByTitle('Tag 0'));
    fireEvent.click(screen.getByTitle('Tag 2'));

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('label.update'));

    expect(onChange).toHaveBeenCalledWith(['Cls.Tag1', 'Cls.Tag2']);
  });

  it('Cancel discards the staged pick', async () => {
    const onChange = jest.fn();
    renderSelect({ onChange });
    openDropdown();
    fireEvent.click(await screen.findByTitle('Tag 1'));
    fireEvent.click(screen.getByText('label.cancel'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('summarises extra selections as a +N pill', () => {
    renderSelect({
      mode: 'multiple',
      options: makeOptions(4),
      value: ['Cls.Tag0', 'Cls.Tag1', 'Cls.Tag2'],
    });

    expect(screen.getByText('Tag 0')).toBeInTheDocument();
    expect(screen.getByText('Tag 1')).toBeInTheDocument();
    expect(screen.queryByText('Tag 2')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('filters options by the typed text', async () => {
    renderSelect({ options: makeOptions(12) });
    openDropdown();
    fireEvent.change(await screen.findByPlaceholderText('Search'), {
      target: { value: 'tag 11' },
    });
    await waitFor(() =>
      expect(screen.queryByTitle('Tag 2')).not.toBeInTheDocument()
    );

    expect(screen.getByTitle('Tag 11')).toBeInTheDocument();
  });

  it('stages the highlighted option with the keyboard', async () => {
    const onChange = jest.fn();
    renderSelect({ onChange });
    openDropdown();
    const search = await screen.findByPlaceholderText('Search');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.click(screen.getByText('label.update'));

    expect(onChange).toHaveBeenCalledWith(['Cls.Tag1']);
  });

  it('Clear all empties the staged value until Update', async () => {
    const onChange = jest.fn();
    renderSelect({ mode: 'multiple', onChange, value: ['Cls.Tag2'] });
    openDropdown();
    fireEvent.click(await screen.findByText('label.clear-entity'));
    fireEvent.click(screen.getByText('label.update'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('does not open while disabled', () => {
    renderSelect({ disabled: true });
    openDropdown();

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
