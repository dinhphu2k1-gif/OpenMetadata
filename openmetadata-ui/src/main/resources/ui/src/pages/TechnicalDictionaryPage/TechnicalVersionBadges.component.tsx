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
import { AxiosError } from 'axios';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GovernedEntityHeaderBadges from '../../components/Glossary/GovernedEntityHeaderBadges/GovernedEntityHeaderBadges.component';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import {
  listTechnicalSnapshots,
  TechnicalSnapshotSummary,
} from '../../rest/technicalDictionaryAPI';
import { getEntityStatusLabel } from '../../utils/EntityStatusUtils';
import { showErrorToast } from '../../utils/ToastUtils';

interface TechnicalVersionBadgesProps {
  /** Data Dictionary version the dictionary follows now. */
  dataDictionaryVersion: string;
  /** Replaced version on screen; undefined for the current one. */
  snapshotVersion?: string;
  /** Status shown for the current version. */
  currentStatus?: EntityStatus;
  /** Replaced versions to offer; every replaced version is offered when left out. */
  versions?: string[];
  testId?: string;
  /** Called with no version for the current one. */
  onSelectVersion: (version?: string) => void;
}

/** Status and version dropdown of a Technical Dictionary page: the current version, then the replaced ones. */
const TechnicalVersionBadges = ({
  dataDictionaryVersion,
  snapshotVersion,
  currentStatus = EntityStatus.Approved,
  versions,
  testId = 'technical-dictionary-version-button',
  onSelectVersion,
}: TechnicalVersionBadgesProps) => {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<TechnicalSnapshotSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadVersions = useCallback(
    async (open: boolean) => {
      if (!open || versions) {
        return;
      }
      setIsLoading(true);
      try {
        setSnapshots(await listTechnicalSnapshots());
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [versions]
  );

  const label = (version: string, status: EntityStatus) =>
    `${t('label.version')}: ${version} — ${getEntityStatusLabel(status)}`;

  return (
    <GovernedEntityHeaderBadges
      businessVersion={snapshotVersion ?? dataDictionaryVersion}
      isLoadingVersions={isLoading}
      loadingLabel={t('label.loading')}
      status={snapshotVersion ? EntityStatus.Archived : currentStatus}
      versionButtonTestId={testId}
      versionItems={[
        {
          key: dataDictionaryVersion,
          label: label(dataDictionaryVersion, EntityStatus.Approved),
        },
        ...(
          versions ??
          snapshots.map((snapshot) => snapshot.dataDictionaryVersion)
        ).map((version) => ({
          key: version,
          label: label(version, EntityStatus.Archived),
        })),
      ]}
      versionLabel={t('label.version')}
      onVersionMenuOpen={loadVersions}
      onVersionSelect={(version) =>
        onSelectVersion(version === dataDictionaryVersion ? undefined : version)
      }
    />
  );
};

export default TechnicalVersionBadges;
