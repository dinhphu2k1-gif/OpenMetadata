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

import Icon, { CloseOutlined, UndoOutlined } from '@ant-design/icons';
import { Typography } from '@openmetadata/ui-core-components';
import { Button, Space } from 'antd';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CheckIcon } from '../../../../assets/svg/ic-check-circle.svg';
import { ReactComponent as PaperPlaneIcon } from '../../../../assets/svg/paper-plane.svg';
import StatusBadge from '../../../common/StatusBadge/StatusBadge.component';
import { EntityStatus } from '../../../../generated/entity/data/glossaryTerm';
import { EntityStatusClass } from '../../../../utils/EntityStatusUtils';
import { ModifiedGlossaryTerm } from '../GlossaryTermTab.interface';
import './glossary-bulk-action-bar.less';

export interface GlossaryBulkActionBarProps {
  selectedTerms: ModifiedGlossaryTerm[];
  onClearSelection: () => void;
  onSubmitForReview: (draftTerms: ModifiedGlossaryTerm[]) => void;
  onApprove: (inReviewTerms: ModifiedGlossaryTerm[]) => void;
  onReject: (inReviewTerms: ModifiedGlossaryTerm[]) => void;
  onRevokeApproval?: (approvedTerms: ModifiedGlossaryTerm[]) => void;
  canSubmitForReview: boolean;
  canApproveOrReject: boolean;
  canRevokeApproval?: boolean;
}

export const GlossaryBulkActionBar: FC<GlossaryBulkActionBarProps> = ({
  selectedTerms,
  onClearSelection,
  onSubmitForReview,
  onApprove,
  onReject,
  onRevokeApproval,
  canSubmitForReview,
  canApproveOrReject,
  canRevokeApproval = canApproveOrReject,
}) => {
  const { t } = useTranslation();

  const { draftTerms, inReviewTerms, approvedTerms } = useMemo(() => {
    const drafts: ModifiedGlossaryTerm[] = [];
    const inReviews: ModifiedGlossaryTerm[] = [];
    const approveds: ModifiedGlossaryTerm[] = [];

    selectedTerms.forEach((term) => {
      const status = term.entityStatus ?? EntityStatus.Approved;
      if (status === EntityStatus.Draft) {
        drafts.push(term);
      } else if (status === EntityStatus.InReview) {
        inReviews.push(term);
      } else if (status === EntityStatus.Approved) {
        approveds.push(term);
      }
    });

    return {
      draftTerms: drafts,
      inReviewTerms: inReviews,
      approvedTerms: approveds,
    };
  }, [selectedTerms]);

  if (selectedTerms.length === 0) {
    return null;
  }

  return (
    <div
      className="glossary-bulk-action-bar-container"
      data-testid="glossary-bulk-action-bar">
      <div className="bulk-bar-left">
        <Typography
          className="selected-count-text"
          data-testid="selected-count-tag"
          size="text-sm">
          {t('label.selected-records-count', 'Đã chọn {{count}} bản ghi', {
            count: selectedTerms.length,
          })}
        </Typography>

        {draftTerms.length > 0 && (
          <StatusBadge
            dataTestId="draft-count-tag"
            displayLabel={t('label.draft-count', '{{count}} bản nháp', {
              count: draftTerms.length,
            })}
            label={EntityStatus.Draft}
            status={EntityStatusClass[EntityStatus.Draft]}
          />
        )}

        {inReviewTerms.length > 0 && (
          <StatusBadge
            dataTestId="in-review-count-tag"
            displayLabel={t('label.in-review-count', '{{count}} chờ duyệt', {
              count: inReviewTerms.length,
            })}
            label={EntityStatus.InReview}
            status={EntityStatusClass[EntityStatus.InReview]}
          />
        )}

        {approvedTerms.length > 0 && (
          <StatusBadge
            dataTestId="approved-count-tag"
            displayLabel={t('label.approved-count', '{{count}} đã duyệt', {
              count: approvedTerms.length,
            })}
            label={EntityStatus.Approved}
            status={EntityStatusClass[EntityStatus.Approved]}
          />
        )}

        <Typography
          as="a"
          className="btn-clear tw:cursor-pointer tw:text-primary hover:tw:underline"
          data-testid="clear-selection-btn"
          size="text-sm"
          onClick={onClearSelection}>
          {t('label.clear-selection', 'Bỏ chọn')}
        </Typography>
      </div>

      <div className="bulk-bar-right">
        <Space size={8}>
          {canSubmitForReview && draftTerms.length > 0 && (
            <Button
              data-testid="bulk-submit-for-review-btn"
              icon={
                <Icon
                  component={PaperPlaneIcon}
                  style={{ fontSize: '14px', marginRight: '6px' }}
                />
              }
              type="primary"
              onClick={() => onSubmitForReview(draftTerms)}>
              {t('label.bulk-submit-for-review-count', 'Gửi phê duyệt ({{count}})', {
                count: draftTerms.length,
              })}
            </Button>
          )}

          {canApproveOrReject && inReviewTerms.length > 0 && (
            <>
              <Button
                className="btn-bulk-approve"
                data-testid="bulk-approve-btn"
                icon={
                  <Icon
                    component={CheckIcon}
                    style={{ fontSize: '14px', marginRight: '6px' }}
                  />
                }
                type="primary"
                onClick={() => onApprove(inReviewTerms)}>
                {t('label.bulk-approve-count', 'Phê duyệt tất cả ({{count}})', {
                  count: inReviewTerms.length,
                })}
              </Button>

              <Button
                danger
                data-testid="bulk-reject-btn"
                icon={<CloseOutlined style={{ marginRight: '6px' }} />}
                type="default"
                onClick={() => onReject(inReviewTerms)}>
                {t('label.bulk-reject-count', 'Từ chối tất cả ({{count}})', {
                  count: inReviewTerms.length,
                })}
              </Button>
            </>
          )}

          {canRevokeApproval && approvedTerms.length > 0 && onRevokeApproval && (
            <Button
              className="btn-bulk-revoke"
              data-testid="bulk-revoke-btn"
              icon={<UndoOutlined style={{ marginRight: '6px' }} />}
              type="default"
              onClick={() => onRevokeApproval(approvedTerms)}>
              {t('label.bulk-revoke-count', 'Hủy duyệt ({{count}})', {
                count: approvedTerms.length,
              })}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};

export default GlossaryBulkActionBar;
