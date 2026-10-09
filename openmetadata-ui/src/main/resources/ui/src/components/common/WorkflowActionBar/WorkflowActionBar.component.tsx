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
  Button,
  Divider,
  Dropdown,
  Tooltip,
} from '@openmetadata/ui-core-components';
import type { Key, MouseEvent } from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as HistoryIcon } from '../../../assets/svg/clock.svg';
import { ReactComponent as MenuIcon } from '../../../assets/svg/menu.svg';
import type {
  WorkflowAction,
  WorkflowActionBarProps,
  WorkflowMenuItem,
} from './WorkflowActionBar.interface';

const ActionButton = ({
  action,
  primary = false,
}: {
  action: WorkflowAction;
  primary?: boolean;
}) => (
  <Button
    className={
      primary && action.variant === 'approve'
        ? 'tw:bg-success-solid tw:text-white tw:ring-transparent tw:hover:bg-success-solid'
        : undefined
    }
    color={
      primary
        ? 'primary'
        : action.danger
        ? 'secondary-destructive'
        : 'secondary'
    }
    data-testid={action.testId}
    isDisabled={action.disabled}
    isLoading={action.loading}
    size="md"
    onClick={action.onClick}>
    {action.label}
  </Button>
);

const MenuItemContent = ({ item }: { item: WorkflowMenuItem }) => {
  const Icon = item.icon;

  return (
    <div
      className="tw:flex tw:w-full tw:items-start tw:gap-3 tw:whitespace-normal"
      data-testid={item.testId}>
      {Icon && (
        <Icon
          aria-hidden="true"
          className={
            item.danger
              ? 'tw:mt-0.5 tw:size-5 tw:shrink-0 tw:text-error-primary'
              : 'tw:mt-0.5 tw:size-5 tw:shrink-0 tw:text-fg-quaternary'
          }
        />
      )}
      <span className="tw:flex tw:min-w-0 tw:flex-col tw:text-left">
        <span
          className={
            item.danger
              ? 'tw:text-sm tw:font-medium tw:text-error-primary'
              : 'tw:text-sm tw:font-medium tw:text-primary'
          }>
          {item.name}
        </span>
        {item.description && (
          <span
            className={
              item.danger
                ? 'tw:text-xs tw:font-normal tw:text-error-primary'
                : 'tw:text-xs tw:font-normal tw:text-tertiary'
            }>
            {item.description}
          </span>
        )}
      </span>
    </div>
  );
};

const WorkflowActionBar = ({
  onHistory,
  historyTestId,
  secondary = [],
  primary,
  menu = [],
  menuTitle,
  menuTestId = 'manage-button',
}: WorkflowActionBarProps) => {
  const { t } = useTranslation();
  const { regularMenuItems, dangerMenuItems, menuItemsByKey } = useMemo(() => {
    const regular = menu.filter((item) => !item.danger);
    const danger = menu.filter((item) => item.danger);

    return {
      regularMenuItems: regular,
      dangerMenuItems: danger,
      menuItemsByKey: new Map(menu.map((item) => [item.key, item])),
    };
  }, [menu]);
  const hasMenu = menu.length > 0;
  const hasActionsAfterHistory =
    secondary.length > 0 || Boolean(primary) || hasMenu;
  const handleMenuAction = useCallback(
    (key: Key) => menuItemsByKey.get(String(key))?.onClick(),
    [menuItemsByKey]
  );
  const stopMenuClickPropagation = useCallback(
    (event: MouseEvent<Element>) => event.stopPropagation(),
    []
  );
  const resolvedMenuTitle = menuTitle ?? t('label.more-actions');

  return (
    <div
      className="tw:flex tw:items-stretch tw:justify-end tw:gap-2"
      data-testid="workflow-action-bar">
      {onHistory && (
        <>
          <Tooltip title={t('label.correction-history')}>
            <Button
              aria-label={t('label.correction-history')}
              color="secondary"
              data-testid={historyTestId}
              iconLeading={HistoryIcon}
              size="md"
              onClick={onHistory}
            />
          </Tooltip>
          {hasActionsAfterHistory && (
            <Divider className="tw:my-1" orientation="vertical" />
          )}
        </>
      )}

      {secondary.length > 0 && (
        <div className="tw:flex tw:items-center tw:gap-2">
          {secondary.map((action) => (
            <ActionButton action={action} key={action.key} />
          ))}
        </div>
      )}

      {primary && <ActionButton primary action={primary} />}

      {hasMenu && (
        <Dropdown.Root>
          <Tooltip title={resolvedMenuTitle}>
            <Button
              aria-label={resolvedMenuTitle}
              color="secondary"
              data-testid={menuTestId}
              iconLeading={MenuIcon}
              size="md"
            />
          </Tooltip>
          <Dropdown.Popover className="tw:w-88">
            <Dropdown.Menu onAction={handleMenuAction}>
              {regularMenuItems.map((item) => (
                <Dropdown.Item
                  id={item.key}
                  key={item.key}
                  textValue={item.name}
                  onClick={stopMenuClickPropagation}>
                  <MenuItemContent item={item} />
                </Dropdown.Item>
              ))}
              {regularMenuItems.length > 0 && dangerMenuItems.length > 0 && (
                <Dropdown.Separator data-testid="workflow-menu-divider" />
              )}
              {dangerMenuItems.map((item) => (
                <Dropdown.Item
                  id={item.key}
                  key={item.key}
                  textValue={item.name}
                  onClick={stopMenuClickPropagation}>
                  <MenuItemContent item={item} />
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      )}
    </div>
  );
};

export default WorkflowActionBar;
