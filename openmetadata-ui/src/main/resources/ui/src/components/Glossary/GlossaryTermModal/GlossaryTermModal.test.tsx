/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { getGlossaryTermByFQN } from '../../../rest/glossaryAPI';
import GlossaryTermModal from './GlossaryTermModal.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { entity?: string }) =>
      options?.entity ? `${key}:${options.entity}` : key,
  }),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  getGlossaryTermByFQN: jest.fn().mockResolvedValue({}),
}));

jest.mock(
  '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider',
  () => ({
    EntityAttachmentProvider: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  })
);

jest.mock('../AddGlossaryTermForm/AddGlossaryTermForm.component', () =>
  jest.fn().mockReturnValue(<div data-testid="standard-term-form" />)
);

jest.mock('../AddGlossaryTermForm/CDEGlossaryTermForm.component', () =>
  jest.fn().mockReturnValue(<div data-testid="cde-term-form" />)
);

const defaultProps = {
  editMode: false,
  isCDEGlossary: true,
  onCancel: jest.fn(),
  onSave: jest.fn(),
  visible: true,
};

describe('GlossaryTermModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the redesigned copy and dimensions for CDE add mode', async () => {
    render(<GlossaryTermModal {...defaultProps} />);

    expect(
      screen.getByText('label.add-entity:label.term')
    ).toBeInTheDocument();
    expect(screen.getByText('cde.data-dictionary')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'label.create-entity:label.term',
      })
    ).toBeInTheDocument();
    expect(await screen.findByTestId('cde-term-form')).toBeInTheDocument();

    const modal = document.querySelector('.ant-modal');

    expect(modal).toHaveClass('cde-glossary-term-modal--add');
    expect(modal).toHaveStyle({ width: '1240px' });
  });

  it('keeps the existing CDE edit mode presentation', async () => {
    render(
      <GlossaryTermModal
        {...defaultProps}
        editMode
        glossaryTermFQN="DataDictionary.CDE1"
      />
    );

    expect(await screen.findByTestId('cde-term-form')).toBeInTheDocument();
    expect(getGlossaryTermByFQN).toHaveBeenCalled();
    expect(screen.getByText('label.edit-entity:CDE')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.save' })
    ).toBeInTheDocument();

    const modal = document.querySelector('.ant-modal');

    expect(modal).not.toHaveClass('cde-glossary-term-modal--add');
    expect(modal).toHaveStyle({ width: '1000px' });
  });

  it('keeps the standard glossary term modal unchanged', async () => {
    render(<GlossaryTermModal {...defaultProps} isCDEGlossary={false} />);

    expect(await screen.findByTestId('standard-term-form')).toBeInTheDocument();
    expect(
      screen.getByText('label.add-entity:label.glossary-term')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'label.save' })
    ).toBeInTheDocument();

    const modal = document.querySelector('.ant-modal');

    expect(modal).not.toHaveClass('cde-glossary-term-modal--add');
    expect(modal).toHaveStyle({ width: '800px' });
  });
});
