/*
 *  Copyright 2023 Collate.
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
import { BrowserRouter } from 'react-router-dom';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import LeftSidebar from './LeftSidebar.component';

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({ selectedPersona: undefined }),
}));

jest.mock(
  '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({ applications: [], plugins: [] }),
  })
);

describe('LeftSidebar', () => {
  it('renders sidebar links correctly for default / admin user without restricted persona', () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      selectedPersona: undefined,
    });
    render(
      <BrowserRouter>
        <LeftSidebar />
      </BrowserRouter>
    );

    expect(screen.getByTestId('image')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-explore')).toBeInTheDocument();
    expect(screen.getByTestId('observability')).toBeInTheDocument();
    expect(screen.getByTestId('data-marketplace-section')).toBeInTheDocument();
    expect(screen.getByTestId('governance')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-settings')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-logout')).toBeInTheDocument();
  });

  it('hides settings link for non-admin persona', () => {
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      selectedPersona: { name: 'DataConsumerPersona' },
    });
    render(
      <BrowserRouter>
        <LeftSidebar />
      </BrowserRouter>
    );

    expect(screen.getByTestId('image')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-explore')).toBeInTheDocument();
    expect(screen.getByTestId('observability')).toBeInTheDocument();
    expect(screen.getByTestId('data-marketplace-section')).toBeInTheDocument();
    expect(screen.getByTestId('governance')).toBeInTheDocument();
    expect(screen.queryByTestId('app-bar-item-settings')).not.toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-logout')).toBeInTheDocument();
  });
});
