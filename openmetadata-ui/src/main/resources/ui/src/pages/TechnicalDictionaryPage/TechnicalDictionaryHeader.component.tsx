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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space, Tooltip } from 'antd';
import { MenuProps } from 'antd/lib/menu';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnBulkIcon } from '../../assets/svg/ic-column.svg';
import { ReactComponent as ExportIcon } from '../../assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from '../../assets/svg/ic-import.svg';
import { ReactComponent as RefreshIcon } from '../../assets/svg/ic-refresh.svg';
import { ReactComponent as VersionIcon } from '../../assets/svg/ic-version.svg';
import { ReactComponent as IconDropdown } from '../../assets/svg/menu.svg';
import { CopyToClipboardButton } from '../../components/common/CopyToClipboardButton/CopyToClipboardButton';
import { ManageButtonItemLabel } from '../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { TECHNICAL_DICTIONARY_GLOSSARY_NAME } from '../../constants/Glossary.contant';
import { TechnicalDictionaryCapabilities } from './technicalDictionary.interface';
import TechnicalVersionBadges from './TechnicalVersionBadges.component';

interface TechnicalDictionaryHeaderProps {
  /** Data Dictionary version the dictionary follows; undefined while none is approved. */
  dataDictionaryVersion?: string;
  capabilities: TechnicalDictionaryCapabilities;
  isAdmin: boolean;
  /** Version of the replaced Data Dictionary on screen; undefined for the live list. */
  snapshotVersion?: string;
  /** Picks a version to view; called with no version for the live list. */
  onSelectVersion: (version?: string) => void;
  onAddColumn: () => void;
  onExport: () => void;
  onImport: () => void;
  onOpenSnapshots: () => void;
  onRebuildIndex: () => void;
}

const TechnicalDictionaryHeader = ({
  dataDictionaryVersion,
  capabilities,
  isAdmin,
  snapshotVersion,
  onSelectVersion,
  onAddColumn,
  onExport,
  onImport,
  onOpenSnapshots,
  onRebuildIndex,
}: TechnicalDictionaryHeaderProps) => {
  const { t } = useTranslation();

  const [showActions, setShowActions] = useState(false);
  const isSnapshot = Boolean(snapshotVersion);

  const menuItem = (
    key: string,
    name: string,
    description: string,
    icon: typeof ExportIcon,
    onClick: () => void
  ) => ({
    key,
    label: (
      <ManageButtonItemLabel
        description={description}
        icon={icon}
        id={key}
        name={name}
      />
    ),
    onClick: (event: { domEvent: { stopPropagation: () => void } }) => {
      event.domEvent.stopPropagation();
      setShowActions(false);
      onClick();
    },
  });

  const moreMenuItems: MenuProps['items'] = [
    ...(capabilities.canExport && dataDictionaryVersion
      ? [
          menuItem(
            'export',
            t('label.export'),
            t('message.technical-export-help'),
            ExportIcon,
            onExport
          ),
        ]
      : []),
    ...(capabilities.canImport && dataDictionaryVersion
      ? [
          menuItem(
            'import',
            t('label.import-cde-mapping'),
            t('message.technical-import-help'),
            ImportIcon,
            onImport
          ),
        ]
      : []),
    menuItem(
      'snapshots',
      t('label.technical-previous-snapshots'),
      t('message.technical-snapshots-help'),
      VersionIcon,
      onOpenSnapshots
    ),
    ...(isAdmin
      ? [
          menuItem(
            'rebuild-index',
            t('label.technical-rebuild-index'),
            t('message.technical-rebuild-index-help'),
            RefreshIcon,
            onRebuildIndex
          ),
        ]
      : []),
  ];

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
              {dataDictionaryVersion && (
                <span data-testid="technical-dictionary-version-badge">
                  <TechnicalVersionBadges
                    dataDictionaryVersion={dataDictionaryVersion}
                    snapshotVersion={snapshotVersion}
                    onSelectVersion={onSelectVersion}
                  />
                </span>
              )}
            </div>
            <div className="tech-dict-subtitle">
              <span data-testid="technical-dictionary-name">
                {TECHNICAL_DICTIONARY_GLOSSARY_NAME}
              </span>
              <CopyToClipboardButton
                copyText={TECHNICAL_DICTIONARY_GLOSSARY_NAME}
              />
            </div>
          </div>
        </div>
        <Space>
          {capabilities.canEdit && dataDictionaryVersion && !isSnapshot && (
            <Button
              data-testid="technical-dictionary-add-column"
              icon={<PlusOutlined />}
              type="primary"
              onClick={onAddColumn}>
              {t('label.add-column')}
            </Button>
          )}
          <Dropdown
            align={{ targetOffset: [-12, 0] }}
            menu={{ items: moreMenuItems }}
            open={showActions}
            overlayClassName="glossary-manage-dropdown-list-container"
            overlayStyle={{ width: '350px' }}
            placement="bottomRight"
            trigger={['click']}
            onOpenChange={setShowActions}>
            <Tooltip placement="topRight" title={t('label.more-actions')}>
              <Button
                aria-label={t('label.more-actions')}
                className="glossary-manage-dropdown-button"
                data-testid="technical-dictionary-more-actions"
                icon={
                  <IconDropdown
                    className="vertical-align-inherit manage-dropdown-icon"
                    height={16}
                    width={16}
                  />
                }
              />
            </Tooltip>
          </Dropdown>
        </Space>
      </div>
    </div>
  );
};

export default TechnicalDictionaryHeader;
