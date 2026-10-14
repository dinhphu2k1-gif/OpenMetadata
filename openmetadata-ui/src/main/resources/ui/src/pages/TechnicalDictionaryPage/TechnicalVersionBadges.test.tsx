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
import { GovernedVersionKind } from '../../components/Glossary/GovernedEntityHeaderBadges/GovernedEntityHeaderBadges.utils';
import TechnicalVersionBadges from './TechnicalVersionBadges.component';

const mockBadges = jest.fn();

jest.mock(
  '../../components/Glossary/GovernedEntityHeaderBadges/GovernedEntityHeaderBadges.component',
  () => (props: unknown) => {
    mockBadges(props);

    return <span data-testid="badges" />;
  }
);
jest.mock('../../rest/technicalDictionaryAPI', () => ({
  listTechnicalSnapshots: jest.fn(),
}));

type BadgeProps = {
  versionItems: { key: string; label: string }[];
  onVersionSelect: (key: string) => void;
};

const lastProps = () =>
  mockBadges.mock.calls[mockBadges.mock.calls.length - 1][0] as BadgeProps;

describe('TechnicalVersionBadges', () => {
  it('offers the pending change next to the approved version and opens it', () => {
    const onSelectVersion = jest.fn();
    const onSelectWorking = jest.fn();
    render(
      <TechnicalVersionBadges
        dataDictionaryVersion="1"
        versions={[]}
        workingKind={GovernedVersionKind.DeletionRequest}
        onSelectVersion={onSelectVersion}
        onSelectWorking={onSelectWorking}
      />
    );

    expect(screen.getByTestId('badges')).toBeInTheDocument();

    const { versionItems, onVersionSelect } = lastProps();

    expect(versionItems.map((item) => item.label)).toEqual([
      'label.version: 1 — cde.deletion-request-tag',
      'label.version: 1 — label.approved',
    ]);

    onVersionSelect(versionItems[0].key);

    expect(onSelectWorking).toHaveBeenCalled();

    onVersionSelect('1');

    expect(onSelectVersion).toHaveBeenCalledWith(undefined);
  });

  it('offers only the versions when there is no pending change', () => {
    render(
      <TechnicalVersionBadges
        dataDictionaryVersion="1"
        versions={[]}
        onSelectVersion={jest.fn()}
      />
    );

    expect(lastProps().versionItems).toHaveLength(1);
  });
});
