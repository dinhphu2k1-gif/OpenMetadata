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
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Button, Space } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnBulkIcon } from '../../assets/svg/ic-column.svg';
import GovernedEntityHeaderBadges from '../../components/Glossary/GovernedEntityHeaderBadges/GovernedEntityHeaderBadges.component';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import { TechnicalStats } from '../../rest/technicalDictionaryAPI';
import {
  TechnicalCatalogState,
  TechnicalDictionaryCapabilities,
} from './technicalDictionary.interface';

export type TechnicalCatalogAction =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'reopen'
  | 'createDraft';

interface TechnicalDictionaryHeaderProps {
  catalog: TechnicalCatalogState;
  versions: string[];
  capabilities: TechnicalDictionaryCapabilities;
  stats?: TechnicalStats;
  isLatestActive: boolean;
  isBusy: boolean;
  onSelectVersion: (businessVersion: string) => void;
  onCatalogAction: (action: TechnicalCatalogAction) => void;
}

/** Catalog workflow actions available for the selected version. */
export const getCatalogActions = (
  catalog: TechnicalCatalogState,
  capabilities: TechnicalDictionaryCapabilities,
  isLatestActive: boolean
): TechnicalCatalogAction[] => {
  const actions: TechnicalCatalogAction[] = [];
  if (catalog.isWorking) {
    if (catalog.status === 'Draft' && capabilities.canSubmit) {
      actions.push('submit');
    }
    if (catalog.status === 'In Review' && capabilities.canApprove) {
      actions.push('approve');
    }
    if (catalog.status === 'In Review' && capabilities.canReject) {
      actions.push('reject');
    }
    if (catalog.status === 'Rejected' && capabilities.canEditWorking) {
      actions.push('reopen');
    }
  } else if (
    catalog.status === 'Approved' &&
    isLatestActive &&
    capabilities.canCreateVersion
  ) {
    actions.push('createDraft');
  }

  return actions;
};

export const STAT_ITEMS: Array<{
  key: keyof TechnicalStats;
  label: string;
  icon: React.ReactNode;
  tone: string;
}> = [
  {
    key: 'totalColumns',
    label: 'label.total-technical-columns',
    icon: <AppstoreOutlined />,
    tone: 'primary',
  },
  {
    key: 'totalTables',
    label: 'label.data-tables',
    icon: <TableOutlined />,
    tone: 'blue',
  },
  {
    key: 'totalSources',
    label: 'label.source-systems',
    icon: <DatabaseOutlined />,
    tone: 'purple',
  },
  {
    key: 'approved',
    label: 'label.approved',
    icon: <CheckCircleOutlined />,
    tone: 'green',
  },
];

const TechnicalDictionaryHeader = ({
  catalog,
  versions,
  capabilities,
  stats,
  isLatestActive,
  isBusy,
  onSelectVersion,
  onCatalogAction,
}: TechnicalDictionaryHeaderProps) => {
  const { t } = useTranslation();
  const actions = getCatalogActions(catalog, capabilities, isLatestActive);

  return (
    <div className="tech-dict-page-header">
      <div className="tech-dict-title-row">
        <div className="tech-dict-title-left">
          <div className="tech-dict-icon-wrapper">
            <ColumnBulkIcon height={22} width={22} />
          </div>
          <div className="tech-dict-title-copy">
            <div className="tech-dict-title-heading">
              <h1 className="tech-dict-title">
                {t('label.technical-dictionary')}
              </h1>
              <GovernedEntityHeaderBadges
                businessVersion={catalog.businessVersion}
                status={catalog.status as EntityStatus}
                statusTestId="technical-dictionary-header-status"
                versionButtonTestId="technical-dictionary-version-button"
                versionItems={versions.map((version) => ({
                  key: version,
                  label: `${t('label.version')}: ${version}`,
                }))}
                versionLabel={t('label.version')}
                onVersionSelect={onSelectVersion}
              />
            </div>
          </div>
        </div>
        <Space>
          {actions.map((action) => (
            <Button
              danger={action === 'reject'}
              data-testid={`technical-catalog-${action}`}
              key={action}
              loading={isBusy}
              type={action === 'reject' ? 'default' : 'primary'}
              onClick={() => onCatalogAction(action)}>
              {t(`label.catalog-action-${action}`)}
            </Button>
          ))}
        </Space>
      </div>
      <div className="tech-dict-stats-strip">
        {STAT_ITEMS.map((item) => (
          <div className="tech-dict-stat-item" key={item.key}>
            <span className={`stat-icon ${item.tone}`}>{item.icon}</span>
            <span className="stat-label">{t(item.label)}:</span>
            <span
              className="stat-value"
              data-testid={`technical-stat-${item.key}`}>
              {(stats?.[item.key] ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TechnicalDictionaryHeader;
