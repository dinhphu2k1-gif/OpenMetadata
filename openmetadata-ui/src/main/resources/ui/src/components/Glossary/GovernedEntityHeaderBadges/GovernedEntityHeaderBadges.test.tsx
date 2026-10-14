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
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import GovernedEntityHeaderBadges from './GovernedEntityHeaderBadges.component';

const renderBadges = (isDeleted = false, status = EntityStatus.Approved) =>
  render(
    <GovernedEntityHeaderBadges
      businessVersion="1.1"
      isDeleted={isDeleted}
      status={status}
      versionButtonTestId="version-button"
      versionLabel="label.version"
    />
  );

describe('GovernedEntityHeaderBadges', () => {
  it('colors the version badge like the status of a live record', () => {
    renderBadges(false, EntityStatus.Approved);

    expect(screen.getByTestId('version-button')).toHaveClass('success');
    expect(screen.getByTestId('version-button')).not.toHaveClass(
      'cde-header-version-badge-deleted'
    );
  });

  it('keeps the version badge neutral when the record is deleted', () => {
    renderBadges(true, EntityStatus.Archived);

    expect(screen.getByTestId('governed-entity-status')).toHaveClass('failure');

    const versionBadge = screen.getByTestId('version-button');

    expect(versionBadge).toHaveClass(
      'archived',
      'cde-header-version-badge-deleted'
    );
    expect(versionBadge).not.toHaveClass('failure');
  });
});
