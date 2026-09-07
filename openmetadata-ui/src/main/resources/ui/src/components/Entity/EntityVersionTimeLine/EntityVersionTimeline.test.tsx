/*
 *  Copyright 2024 Collate.
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
import { fireEvent, render, screen } from '@testing-library/react';
import { ChangeDescription } from '../../../generated/entity/type';
import EntityVersionTimeLine, { VersionButton } from './EntityVersionTimeLine';

jest.mock('../../common/PopOverCard/UserPopOverCard', () => ({
  __esModule: true,
  default: ({ userName }: { userName: string }) => <p>{userName}</p>,
}));

const user = {
  name: 'John Doe displayName',
  displayName: 'John Doe displayName',
};

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest.fn().mockImplementation(() => [false, false, user]),
}));

jest.mock('../../../utils/EntityVersionUtils', () => {
  const actual = jest.requireActual('../../../utils/EntityVersionUtils');
  return {
    ...actual,
    getSummary: jest.fn().mockReturnValue('Some change description'),
    isMajorVersion: jest.fn().mockReturnValue(false),
  };
});

describe('VersionButton', () => {
  const version = {
    updatedBy: 'John Doe',
    version: '1.0',
    changeDescription: {} as ChangeDescription,
    updatedAt: 123,
    glossary: '',
  };

  const onVersionSelect = jest.fn();
  const selected = false;
  const isMajorVersion = false;

  it('renders version number', () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );
    const versionNumber = screen.getByText('v1.0');

    expect(versionNumber).toBeInTheDocument();
  });

  it('renders change description', () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );
    const changeDescription = screen.getByText('Some change description');

    expect(changeDescription).toBeInTheDocument();
  });

  it('should render updatedBy with UserPopoverCard', async () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );

    const ownerDisplayName = await screen.findByText('John Doe');

    expect(ownerDisplayName).toBeInTheDocument();
  });

  it('calls onVersionSelect when clicked', () => {
    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={version}
        onVersionSelect={onVersionSelect}
      />
    );
    const versionButton = screen.getByTestId('version-selector-v1.0');
    fireEvent.click(versionButton);

    expect(onVersionSelect).toHaveBeenCalledWith('1.0');
  });

  it('renders CDE version number when extension.cdeVersion is present', () => {
    const cdeVersionData = {
      updatedBy: 'John Doe',
      version: '1.5',
      changeDescription: {} as ChangeDescription,
      updatedAt: 123,
      glossary: { name: 'Data Dictionary', displayName: 'Từ điển dữ liệu dùng chung' },
      extension: { cdeVersion: '1.2' },
    };

    render(
      <VersionButton
        isMajorVersion={isMajorVersion}
        selected={selected}
        version={cdeVersionData}
        onVersionSelect={onVersionSelect}
      />
    );
    const versionNumber = screen.getByText('v1.2');

    expect(versionNumber).toBeInTheDocument();
    expect(screen.queryByText('v1.5')).not.toBeInTheDocument();
  });
});

describe('EntityVersionTimeLine for CDE', () => {
  it('renders unique CDE versions and selects the active CDE version', () => {
    const mockVersionList = {
      entityType: 'glossaryTerm',
      versions: [
        JSON.stringify({
          version: '1.5',
          extension: { cdeVersion: '1.2' },
          glossary: { name: 'Data Dictionary' },
          entityStatus: 'Approved',
          updatedBy: 'user3',
          updatedAt: 1000,
        }),
        JSON.stringify({
          version: '1.4',
          extension: { cdeVersion: '1.0' },
          glossary: { name: 'Data Dictionary' },
          entityStatus: 'Approved',
          updatedBy: 'user4',
          updatedAt: 900,
        }),
        JSON.stringify({
          version: '1.3',
          extension: { cdeVersion: '1.0' },
          glossary: { name: 'Data Dictionary' },
          entityStatus: 'Approved',
          updatedBy: 'user3',
          updatedAt: 800,
        }),
        JSON.stringify({
          version: '1.2',
          extension: { cdeVersion: '1.0' },
          glossary: { name: 'Data Dictionary' },
          entityStatus: 'Approved',
          updatedBy: 'admin',
          updatedAt: 700,
        }),
      ],
    };

    render(
      <EntityVersionTimeLine
        currentVersion="1.5"
        onBack={jest.fn()}
        versionHandler={jest.fn()}
        versionList={mockVersionList as any}
      />
    );

    // v1.2 should be present
    expect(screen.getByText('v1.2')).toBeInTheDocument();
    // v1.0 should be present
    expect(screen.getByText('v1.0')).toBeInTheDocument();
    // System versions should not be displayed
    expect(screen.queryByText('v1.5')).not.toBeInTheDocument();
    expect(screen.queryByText('v1.4')).not.toBeInTheDocument();
    expect(screen.queryByText('v1.3')).not.toBeInTheDocument();

    // Verify v1.2 is selected
    const selector12 = screen.getByTestId('version-selector-v1.2');
    expect(selector12).toHaveClass('selected');
  });

  it('only includes approved snapshots and filters out Draft or In Review snapshots', () => {
    const mockVersionList = {
      entityType: 'glossaryTerm',
      versions: [
        // v1.2 is only In Review (never approved) -> should be excluded
        JSON.stringify({
          version: '1.5',
          extension: { cdeVersion: '1.2' },
          glossary: { name: 'Data Dictionary' },
          entityStatus: 'In Review',
          updatedBy: 'user3',
          updatedAt: 1000,
        }),
        // v1.1 has Draft snapshot (1.4) and Approved snapshot (1.3) -> should use approved snapshot
        JSON.stringify({
          version: '1.4',
          extension: { cdeVersion: '1.1' },
          glossary: { name: 'Data Dictionary' },
          entityStatus: 'Draft',
          updatedBy: 'user3',
          updatedAt: 950,
        }),
        JSON.stringify({
          version: '1.3',
          extension: { cdeVersion: '1.1' },
          glossary: { name: 'Data Dictionary' },
          entityStatus: 'Approved',
          updatedBy: 'admin',
          updatedAt: 900,
        }),
        // v1.0 is Approved
        JSON.stringify({
          version: '1.1',
          extension: { cdeVersion: '1.0' },
          glossary: { name: 'Data Dictionary' },
          entityStatus: 'Approved',
          updatedBy: 'admin',
          updatedAt: 800,
        }),
      ],
    };

    render(
      <EntityVersionTimeLine
        currentVersion="1.5"
        onBack={jest.fn()}
        versionHandler={jest.fn()}
        versionList={mockVersionList as any}
      />
    );

    // v1.2 should NOT be in the timeline because it is In Review (unapproved)
    expect(screen.queryByText('v1.2')).not.toBeInTheDocument();
    // v1.1 and v1.0 should be present because they are Approved
    expect(screen.getByText('v1.1')).toBeInTheDocument();
    expect(screen.getByText('v1.0')).toBeInTheDocument();

    // Since currentVersion was 1.5 (unapproved), activeCde should default to the latest approved version v1.1
    const selector11 = screen.getByTestId('version-selector-v1.1');
    expect(selector11).toHaveClass('selected');
  });

  it('renders empty state when no versions are approved', () => {
    const mockVersionList = {
      entityType: 'glossaryTerm',
      versions: [
        JSON.stringify({
          version: '0.1',
          extension: { cdeVersion: '1.0' },
          glossary: { name: 'Data Dictionary' },
          entityStatus: 'Draft',
          updatedBy: 'user3',
          updatedAt: 1000,
        }),
      ],
    };

    render(
      <EntityVersionTimeLine
        currentVersion="0.1"
        onBack={jest.fn()}
        versionHandler={jest.fn()}
        versionList={mockVersionList as any}
      />
    );

    expect(screen.queryByText('v1.0')).not.toBeInTheDocument();
    expect(screen.getByTestId('no-approved-versions')).toBeInTheDocument();
  });
});
