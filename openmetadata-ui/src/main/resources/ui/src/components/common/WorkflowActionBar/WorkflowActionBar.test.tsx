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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import WorkflowActionBar from './WorkflowActionBar.component';

jest.mock('@openmetadata/ui-core-components', () => {
  const React = jest.requireActual('react');
  const MenuActionContext = React.createContext(() => undefined);

  return {
    Button: ({
      children,
      iconLeading: Icon,
      isDisabled,
      isLoading,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      iconLeading?: React.ComponentType;
      isDisabled?: boolean;
      isLoading?: boolean;
    }) => (
      <button {...props} disabled={isDisabled}>
        {Icon && <Icon />}
        {isLoading && <span>loading</span>}
        {children == null ? null : String(children)}
      </button>
    ),
    Divider: (props: React.HTMLAttributes<HTMLDivElement>) => (
      <div role="separator" {...props} />
    ),
    Dropdown: {
      Root: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
      Popover: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
      Menu: ({
        children,
        onAction,
      }: React.PropsWithChildren<{ onAction: (key: string) => void }>) => (
        <MenuActionContext.Provider value={onAction}>
          <div role="menu">{children}</div>
        </MenuActionContext.Provider>
      ),
      Item: ({
        children,
        id,
        onClick,
      }: React.PropsWithChildren<{
        id: string;
        onClick?: React.MouseEventHandler<HTMLDivElement>;
      }>) => {
        const onAction = React.useContext(MenuActionContext);

        return (
          <div
            role="menuitem"
            onClick={(event) => {
              onClick?.(event);
              onAction(id);
            }}>
            {children}
          </div>
        );
      },
      Separator: (props: React.HTMLAttributes<HTMLDivElement>) => (
        <div role="separator" {...props} />
      ),
    },
    Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('WorkflowActionBar', () => {
  it('renders groups in the required order and forwards action test ids', () => {
    const onHistory = jest.fn();
    const onSecondary = jest.fn();
    const onPrimary = jest.fn();

    render(
      <WorkflowActionBar
        historyTestId="history"
        menu={[{ key: 'menu', name: 'Menu item', onClick: jest.fn() }]}
        menuTestId="menu"
        primary={{
          key: 'primary',
          label: 'Primary',
          onClick: onPrimary,
          testId: 'primary',
        }}
        secondary={[
          {
            key: 'secondary',
            label: 'Secondary',
            onClick: onSecondary,
            testId: 'secondary',
          },
        ]}
        onHistory={onHistory}
      />
    );

    const history = screen.getByTestId('history');
    const secondary = screen.getByTestId('secondary');
    const primary = screen.getByTestId('primary');
    const menu = screen.getByTestId('menu');

    expect(history.compareDocumentPosition(secondary)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(secondary.compareDocumentPosition(primary)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(primary.compareDocumentPosition(menu)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );

    fireEvent.click(history);
    fireEvent.click(secondary);
    fireEvent.click(primary);

    expect(onHistory).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it('hides optional history and menu controls', () => {
    render(<WorkflowActionBar menu={[]} />);

    expect(
      screen.queryByRole('button', { name: 'label.correction-history' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.more-actions' })
    ).not.toBeInTheDocument();
  });

  it('moves dangerous menu items after regular items and inserts a divider', async () => {
    render(
      <WorkflowActionBar
        menu={[
          {
            key: 'danger',
            name: 'Delete',
            onClick: jest.fn(),
            testId: 'danger-item',
            danger: true,
          },
          {
            key: 'regular',
            name: 'Rename',
            onClick: jest.fn(),
            testId: 'regular-item',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.more-actions' }));

    await waitFor(() =>
      expect(screen.getByTestId('danger-item')).toBeVisible()
    );

    const regular = screen.getByTestId('regular-item');
    const divider = screen.getByTestId('workflow-menu-divider');
    const danger = screen.getByTestId('danger-item');

    expect(regular.compareDocumentPosition(divider)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(divider.compareDocumentPosition(danger)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(screen.getByText('Delete')).toHaveClass('tw:text-error-primary');
  });

  it('runs the selected menu item callback', async () => {
    const onMenuClick = jest.fn();

    render(
      <WorkflowActionBar
        menu={[
          {
            key: 'menu-action',
            name: 'Menu action',
            onClick: onMenuClick,
            testId: 'menu-action',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.more-actions' }));
    await waitFor(() =>
      expect(screen.getByTestId('menu-action')).toBeVisible()
    );
    fireEvent.click(screen.getByTestId('menu-action'));

    await waitFor(() => expect(onMenuClick).toHaveBeenCalledTimes(1));
  });
});
