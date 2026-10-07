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
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Button } from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './bulk-selection-bar.less';
import {
  BulkSelectionAction,
  BulkSelectionActionType,
  BulkSelectionBarProps,
  BulkSelectionTone,
} from './BulkSelectionBar.interface';

const CHIP_LABEL_KEYS: Record<BulkSelectionTone, string> = {
  draft: 'label.bulk-chip-draft',
  'in-review': 'label.bulk-chip-in-review',
  rejected: 'label.bulk-chip-rejected',
  approved: 'label.bulk-chip-approved',
  create: 'label.request-type-create',
  update: 'label.request-type-update',
  delete: 'label.request-type-delete',
};

const ACTION_LABEL_KEYS: Record<BulkSelectionActionType, string> = {
  submit: 'label.bulk-action-submit',
  approve: 'label.bulk-action-approve',
  reject: 'label.bulk-action-reject',
  withdraw: 'label.bulk-action-withdraw',
};

const ACTION_ICONS: Record<BulkSelectionActionType, ReactNode> = {
  submit: <SendOutlined />,
  approve: <CheckOutlined />,
  reject: <CloseOutlined />,
  withdraw: <UndoOutlined />,
};

const ACTION_ORDER: BulkSelectionActionType[] = [
  'submit',
  'withdraw',
  'reject',
  'approve',
];

/** Approve is the main action; submit takes over only when nothing can be approved. */
const buttonColor = (
  type: BulkSelectionActionType,
  hasApprove: boolean
): 'primary' | 'secondary' | 'secondary-destructive' => {
  let color: 'primary' | 'secondary' | 'secondary-destructive' = 'primary';
  if (type === 'reject') {
    color = 'secondary-destructive';
  } else if (type === 'withdraw' || (type === 'submit' && hasApprove)) {
    color = 'secondary';
  }

  return color;
};

/**
 * Takes the place of a table's toolbar while rows are ticked: how many, in which status, and what
 * can be done to them. Only actions that apply to at least one ticked record are shown.
 */
const BulkSelectionBar = ({
  selectedCount,
  chips,
  actions,
  onClear,
  testId,
  countTestId,
  clearTestId,
}: BulkSelectionBarProps) => {
  const { t } = useTranslation();
  const hasApprove = actions.some((action) => action.type === 'approve');
  const sortedActions: BulkSelectionAction[] = [...actions].sort(
    (left, right) =>
      ACTION_ORDER.indexOf(left.type) - ACTION_ORDER.indexOf(right.type)
  );

  return (
    <div
      aria-label={t('label.bulk-actions')}
      className="bulk-selection-bar"
      data-testid={testId}
      role="region">
      <span className="bulk-selection-bar-count" data-testid={countTestId}>
        {t('label.bulk-selected-count', { count: selectedCount })}
      </span>
      {chips.map((chip) => (
        <span
          className={`bulk-selection-chip bulk-selection-chip--${chip.tone}`}
          data-testid={chip.testId}
          key={chip.tone}>
          <span className="bulk-selection-chip-dot" />
          {chip.label ?? t(CHIP_LABEL_KEYS[chip.tone], { count: chip.count })}
        </span>
      ))}
      <button
        className="bulk-selection-bar-clear"
        data-testid={clearTestId}
        type="button"
        onClick={onClear}>
        {t('label.bulk-clear-selection')}
      </button>
      <span className="bulk-selection-bar-spacer" />
      {sortedActions.length === 0 && (
        <span className="bulk-selection-bar-empty">
          {t('message.bulk-no-actions')}
        </span>
      )}
      {sortedActions.map((action) => (
        <Button
          color={buttonColor(action.type, hasApprove)}
          data-testid={action.testId}
          iconLeading={ACTION_ICONS[action.type]}
          key={action.type}
          size="sm"
          onPress={action.onPress}>
          {t(ACTION_LABEL_KEYS[action.type], { count: action.count })}
        </Button>
      ))}
    </div>
  );
};

export default BulkSelectionBar;
