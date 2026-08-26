/*
 *  Copyright 2022 Collate.
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

import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { EntityTabs } from '../../../enums/entity.enum';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
  mockedGlossaries,
  MOCK_PERMISSIONS,
} from '../../../mocks/Glossary.mock';
import { getGlossaryTermDetailsPath } from '../../../utils/RouterUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { useGlossaryStore } from '../useGlossary.store';
import GlossaryDetails from './GlossaryDetails.component';

const mockNavigate = jest.fn();

jest.mock('../GlossaryTermTab/GlossaryTermTab.component', () => {
  return jest.fn().mockReturnValue(<p>GlossaryTermTab.component</p>);
});
jest.mock('../GlossaryHeader/GlossaryHeader.component', () => {
  return jest.fn().mockReturnValue(<p>GlossaryHeader.component</p>);
});
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p>{children}</p>
    )),
  useParams: jest.fn().mockImplementation(() => ({
    glossaryName: 'GlossaryName',
    tab: 'terms',
  })),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn(),
}));

jest.mock(
  '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest
      .fn()
      .mockImplementation(() => <p>testActivityFeedTab</p>),
  })
);

jest.mock('../../common/EntityDescription/DescriptionV1', () =>
  jest.fn().mockImplementation(() => <div>DescriptionV1</div>)
);

const mockProps = {
  glossary: mockedGlossaries[0],
  glossaryTerms: [],
  termsLoading: false,
  permissions: {
    Create: true,
    Delete: true,
    ViewAll: true,
    EditAll: true,
    EditDescription: true,
    EditDisplayName: true,
    EditCustomFields: true,
  } as OperationPermission,
  updateGlossary: jest.fn(),
  handleGlossaryDelete: jest.fn(),
  refreshGlossaryTerms: jest.fn(),
  onAddGlossaryTerm: jest.fn(),
  onEditGlossaryTerm: jest.fn(),
  updateVote: jest.fn(),
  onThreadLinkSelect: jest.fn(),
  toggleTabExpanded: jest.fn(),
  isTabExpanded: false,
};

jest.mock('../../Customization/GenericProvider/GenericProvider', () => {
  return {
    useGenericContext: jest.fn().mockImplementation(() => ({
      permissions: MOCK_PERMISSIONS,
    })),
  };
});

jest.mock('../../Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn().mockImplementation(() => <div>GenericTab</div>),
}));

jest.mock('../../../utils/CustomizePage/CustomizePageEntityTabUtils', () => ({
  ...jest.requireActual(
    '../../../utils/CustomizePage/CustomizePageEntityTabUtils'
  ),
  checkIfExpandViewSupported: jest.fn().mockReturnValue(true),
}));

describe('Test Glossary-details component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGlossaryStore.setState({ activeGlossary: mockedGlossaries[0] });
    (useRequiredParams as jest.Mock).mockReturnValue({
      tab: EntityTabs.TERMS,
    });
  });

  it('Should render Glossary-details component', async () => {
    await act(async () => {
      render(<GlossaryDetails {...mockProps} />);
    });

    const glossaryDetails = screen.getByTestId('glossary-details');
    const headerComponent = await screen.findByText('GlossaryHeader.component');

    expect(headerComponent).toBeInTheDocument();
    expect(glossaryDetails).toBeInTheDocument();
    expect(await screen.findByText('GenericTab')).toBeInTheDocument();
  });

  it('redirects the legacy Relations Graph URL to Terms', async () => {
    (useRequiredParams as jest.Mock).mockReturnValue({
      tab: EntityTabs.RELATIONS_GRAPH,
    });

    render(<GlossaryDetails {...mockProps} />);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        getGlossaryTermDetailsPath(
          mockedGlossaries[0].fullyQualifiedName ?? mockedGlossaries[0].name,
          EntityTabs.TERMS
        ),
        { replace: true }
      )
    );
  });

  it('should show the action opposite to the glossary information state', async () => {
    const { rerender } = render(<GlossaryDetails {...mockProps} />);
    const collapseButton = await screen.findByTestId('tab-expand-button');

    expect(collapseButton).toHaveAttribute('aria-label', 'label.collapse');
    expect(collapseButton).toHaveClass('rotate-180');

    rerender(<GlossaryDetails {...mockProps} isTabExpanded />);

    const expandButton = await screen.findByTestId('tab-expand-button');

    expect(expandButton).toHaveAttribute('aria-label', 'label.expand');
    expect(expandButton).not.toHaveClass('rotate-180');
  });
});
