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
  ArrowRightOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons';
import {
  Button,
  Divider,
  Drawer,
  Empty,
  Skeleton,
  Tooltip,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import {
  formatApprovedRecordValue,
  getApprovedRecordFieldLabelKey,
  isLongTextApprovedRecordField,
} from '../../../utils/ApprovedRecordHistoryUtils';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getTextDiff } from '../../../utils/EntityDiffUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import CloseIcon from '../../Modals/CloseIcon.component';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import StatusBadge from '../StatusBadge/StatusBadge.component';
import { StatusType } from '../StatusBadge/StatusBadge.interface';
import {
  ApprovedRecordHistoryEntry,
  ApprovedRecordHistoryModalProps,
} from './ApprovedRecordHistory.interface';
import './approved-record-history.less';

const LONG_TEXT_PREVIEW_LENGTH = 120;

const ApprovedRecordHistoryModal: FC<ApprovedRecordHistoryModalProps> = ({
  open,
  scope,
  subtitle,
  load,
  onClose,
}) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ApprovedRecordHistoryEntry[]>([]);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(
    new Set()
  );
  const [expandedLongTexts, setExpandedLongTexts] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let isCurrent = true;
    setIsLoading(true);
    load()
      .then((history) => {
        if (isCurrent) {
          setEntries(history);
          setExpandedEntries(history[0] ? new Set([history[0].id]) : new Set());
          setExpandedLongTexts(new Set());
        }
      })
      .catch((error: AxiosError) => {
        if (isCurrent) {
          setEntries([]);
          showErrorToast(error);
        }
      })
      .finally(() => isCurrent && setIsLoading(false));

    return () => {
      isCurrent = false;
    };
  }, [open, load]);

  const renderValue = (field: string, value?: string | null, added = false) => {
    const formattedValue = formatApprovedRecordValue(field, value);

    return formattedValue ? (
      <span className={added ? 'diff-added' : 'diff-removed'}>
        {formattedValue}
      </span>
    ) : (
      <span className="approved-record-empty-value">{t('label.not-set')}</span>
    );
  };

  const toggleEntry = (entryId: string) => {
    setExpandedEntries((currentEntries) => {
      const nextEntries = new Set(currentEntries);
      if (nextEntries.has(entryId)) {
        nextEntries.delete(entryId);
      } else {
        nextEntries.add(entryId);
      }

      return nextEntries;
    });
  };

  const toggleLongText = (changeId: string) => {
    setExpandedLongTexts((currentChanges) => {
      const nextChanges = new Set(currentChanges);
      if (nextChanges.has(changeId)) {
        nextChanges.delete(changeId);
      } else {
        nextChanges.add(changeId);
      }

      return nextChanges;
    });
  };

  const getCollapsedSummary = (entry: ApprovedRecordHistoryEntry) => {
    if (entry.changes.length === 0) {
      return t('message.no-field-changes');
    }

    const fieldLabels = entry.changes
      .slice(0, 3)
      .map((change) => t(getApprovedRecordFieldLabelKey(scope, change.field)));
    const remainingCount = entry.changes.length - fieldLabels.length;

    return `${fieldLabels.join(', ')}${
      remainingCount > 0 ? ` +${remainingCount}` : ''
    }`;
  };

  return (
    <Drawer
      destroyOnClose
      className="approved-record-history-drawer"
      closable={false}
      data-testid="approved-record-history-modal"
      open={open}
      placement="right"
      title={
        <>
          <div className="d-flex items-center justify-between">
            <Typography.Text className="font-medium">
              {t('label.correction-history')}
            </Typography.Text>
            <CloseIcon handleCancel={onClose} />
          </div>
          <div className="text-grey-muted text-xs font-normal">
            {[subtitle, t('label.correction-count', { count: entries.length })]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <Divider className="m-0" />
        </>
      }
      width="min(640px, 100vw)"
      onClose={onClose}>
      {isLoading ? (
        <Skeleton active />
      ) : entries.length === 0 ? (
        <Empty
          data-testid="approved-record-history-empty"
          description={t('message.no-correction-history')}
        />
      ) : (
        entries.map((entry, entryIndex) => {
          const isExpanded = expandedEntries.has(entry.id);

          return (
            <div
              className="approved-record-history-entry"
              data-testid={`approved-record-history-${entry.id}`}
              key={entry.id}>
              <div className="timeline-wrapper">
                <span
                  className={classNames('timeline-rounder', {
                    selected: entryIndex === 0,
                  })}
                />
                {entryIndex < entries.length - 1 && (
                  <span className="timeline-line" />
                )}
              </div>
              <div className="approved-record-history-content">
                <button
                  aria-expanded={isExpanded}
                  className="approved-record-history-toggle d-flex items-center justify-between gap-2 text-sm"
                  type="button"
                  onClick={() => toggleEntry(entry.id)}>
                  <div className="approved-record-history-summary d-flex items-center gap-1 truncate flex-auto">
                    <span className="font-medium">
                      {t('label.correction-number', {
                        number: entries.length - entryIndex,
                      })}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">
                      {isExpanded
                        ? t('message.changed-field-count', {
                            count: entry.changes.length,
                          })
                        : getCollapsedSummary(entry)}
                    </span>
                  </div>
                  <div className="d-flex items-center gap-2 flex-shrink">
                    <StatusBadge
                      label={EntityStatus.Approved}
                      status={StatusType.Success}
                    />
                    {isExpanded ? <DownOutlined /> : <RightOutlined />}
                  </div>
                </button>
                <Tooltip
                  title={
                    <div>
                      {entry.proposedBy && entry.proposedAt != null && (
                        <div>
                          {t('label.proposed-by-on', {
                            date: formatDateTime(entry.proposedAt),
                            user: entry.proposedBy,
                          })}
                        </div>
                      )}
                      <div>
                        {t('label.approved-by-on', {
                          date: formatDateTime(entry.approvedAt),
                          user: entry.approvedBy,
                        })}
                      </div>
                    </div>
                  }>
                  <div className="approved-record-history-meta d-flex items-center gap-1 text-xs text-grey-muted m-t-xss">
                    {entry.proposedBy && (
                      <>
                        <UserPopOverCard
                          showUserName
                          className="font-medium"
                          profileWidth={16}
                          userName={entry.proposedBy}
                        />
                        <span aria-hidden="true">→</span>
                      </>
                    )}
                    <UserPopOverCard
                      showUserName
                      className="font-medium"
                      profileWidth={16}
                      userName={entry.approvedBy}
                    />
                    <span className="version-timestamp">
                      {formatDateTime(entry.approvedAt)}
                    </span>
                  </div>
                </Tooltip>
                {isExpanded && (
                  <div className="approved-record-changes m-t-xs">
                    {entry.changes.length === 0 ? (
                      <Typography.Text type="secondary">
                        {t('message.no-field-changes')}
                      </Typography.Text>
                    ) : (
                      entry.changes.map((change, changeIndex) => {
                        const fieldLabel = t(
                          getApprovedRecordFieldLabelKey(scope, change.field)
                        );
                        const changeId = `${entry.id}-${change.field}-${changeIndex}`;
                        const isLongText = isLongTextApprovedRecordField(
                          change.field
                        );
                        const isLongTextExpanded =
                          expandedLongTexts.has(changeId);
                        const hasMoreText =
                          `${change.oldValue ?? ''}${change.newValue ?? ''}`
                            .length > LONG_TEXT_PREVIEW_LENGTH;

                        return (
                          <div
                            className="approved-record-change"
                            data-testid={`approved-record-change-${change.field}`}
                            key={changeId}>
                            <Tooltip title={fieldLabel}>
                              <div className="approved-record-field-label text-xs text-grey-muted truncate">
                                {fieldLabel}
                              </div>
                            </Tooltip>
                            <div className="approved-record-change-values">
                              {isLongText ? (
                                <>
                                  <RichTextEditorPreviewerV1
                                    enableSeeMoreVariant={false}
                                    markdown={getTextDiff(
                                      change.oldValue ?? '',
                                      change.newValue ?? ''
                                    )}
                                    reducePreviewLineClass={
                                      isLongTextExpanded
                                        ? undefined
                                        : 'max-two-lines'
                                    }
                                    showReadMoreBtn={false}
                                  />
                                  {hasMoreText && (
                                    <Button
                                      className="approved-record-long-text-toggle text-xs p-0"
                                      type="link"
                                      onClick={() => toggleLongText(changeId)}>
                                      {t(
                                        isLongTextExpanded
                                          ? 'label.collapse'
                                          : 'label.view-more'
                                      )}
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <div className="d-flex items-start gap-2 flex-wrap">
                                  {renderValue(change.field, change.oldValue)}
                                  <ArrowRightOutlined className="approved-record-change-arrow" />
                                  {renderValue(
                                    change.field,
                                    change.newValue,
                                    true
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </Drawer>
  );
};

export default ApprovedRecordHistoryModal;
