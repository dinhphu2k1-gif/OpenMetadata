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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ColumnBulkIcon } from '../../assets/svg/ic-column.svg';
import { ReactComponent as ExportIcon } from '../../assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from '../../assets/svg/ic-import.svg';
import { ReactComponent as RefreshIcon } from '../../assets/svg/ic-refresh.svg';
import { CopyToClipboardButton } from '../../components/common/CopyToClipboardButton/CopyToClipboardButton';
import WorkflowActionBar from '../../components/common/WorkflowActionBar/WorkflowActionBar.component';
import type {
  WorkflowAction,
  WorkflowMenuItem,
} from '../../components/common/WorkflowActionBar/WorkflowActionBar.interface';
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
  onRebuildIndex,
}: TechnicalDictionaryHeaderProps) => {
  const { t } = useTranslation();

  const isSnapshot = Boolean(snapshotVersion);

  const primary = useMemo<WorkflowAction | undefined>(
    () =>
      capabilities.canEdit && dataDictionaryVersion && !isSnapshot
        ? {
            key: 'add-column',
            label: t('label.add-column'),
            onClick: onAddColumn,
            testId: 'technical-dictionary-add-column',
          }
        : undefined,
    [capabilities.canEdit, dataDictionaryVersion, isSnapshot, onAddColumn, t]
  );

  const menu = useMemo<WorkflowMenuItem[]>(() => {
    const items: WorkflowMenuItem[] = [];

    if (capabilities.canExport && dataDictionaryVersion) {
      items.push({
        key: 'export',
        name: t('cde.export-excel'),
        description: t('message.technical-export-help'),
        icon: ExportIcon,
        onClick: onExport,
        testId: 'export',
      });
    }
    if (capabilities.canImport && dataDictionaryVersion) {
      items.push({
        key: 'import',
        name: t('cde.import-excel'),
        description: t('message.technical-import-help'),
        icon: ImportIcon,
        onClick: onImport,
        testId: 'import',
      });
    }
    if (isAdmin) {
      items.push({
        key: 'rebuild-index',
        name: t('label.technical-rebuild-index'),
        description: t('message.technical-rebuild-index-help'),
        icon: RefreshIcon,
        onClick: onRebuildIndex,
        testId: 'rebuild-index',
      });
    }

    return items;
  }, [
    capabilities.canExport,
    capabilities.canImport,
    dataDictionaryVersion,
    isAdmin,
    onExport,
    onImport,
    onRebuildIndex,
    t,
  ]);

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
        <WorkflowActionBar
          menu={menu}
          menuTestId="technical-dictionary-more-actions"
          primary={primary}
        />
      </div>
    </div>
  );
};

export default TechnicalDictionaryHeader;
