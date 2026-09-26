/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityStatus, GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import CDEReleaseLevelField from './CDEReleaseLevelField';

const mockUpdate = jest.fn();
let mockData = {} as GlossaryTerm;
let mockIsVersionView = false;
let mockPermissions: Record<string, boolean> = {};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'cde.not-set': 'Chưa thiết lập',
        'cde.release-level': 'Cấp phát hành',
        'cde.release-level-ceo': 'Tổng Giám đốc',
        'cde.release-level-ttqldl': 'TTQLDL',
        'cde.select-release-level': 'Chọn cấp phát hành',
        'label.edit-entity': 'Chỉnh sửa Cấp phát hành',
      }[key] ?? key),
  }),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: () => ({
    data: mockData,
    isVersionView: mockIsVersionView,
    onUpdate: mockUpdate,
    permissions: mockPermissions,
  }),
}));

describe('CDEReleaseLevelField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockData = {
      id: 'cde-id',
      name: 'CDE1',
      entityStatus: EntityStatus.Draft,
      extension: { custom: 'keep' },
    } as GlossaryTerm;
    mockIsVersionView = false;
    mockPermissions = {};
  });

  it.each([
    ['CEO', 'Tổng Giám đốc'],
    ['TTQLDL', 'TTQLDL'],
  ])('renders %s as %s', (releaseLevel, label) => {
    mockData.extension = { releaseLevel: [releaseLevel] };
    render(<CDEReleaseLevelField />);

    expect(screen.getByTestId('cde-release-level-value')).toHaveTextContent(
      label
    );
  });

  it('shows a muted empty state without an always-visible select', () => {
    render(<CDEReleaseLevelField />);

    expect(screen.getByText('Chưa thiết lập')).toHaveClass('text-grey-muted');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('opens the editor on demand for an editable draft', () => {
    mockPermissions = { EditCustomFields: true };
    render(<CDEReleaseLevelField />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it.each([
    [EntityStatus.Approved, false],
    [EntityStatus.Archived, false],
    [EntityStatus.Draft, true],
  ])('is read-only for status %s and versionView=%s', (status, versionView) => {
    mockData.entityStatus = status;
    mockIsVersionView = versionView;
    mockPermissions = { EditAll: true };
    render(<CDEReleaseLevelField />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('preserves the existing extension when the release level changes', async () => {
    mockPermissions = { EditAll: true };
    mockUpdate.mockResolvedValue(undefined);
    render(<CDEReleaseLevelField />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await screen.findByRole('option', { name: 'TTQLDL' });
    fireEvent.click(
      document.querySelector(
        '.ant-select-item-option[title="TTQLDL"]'
      ) as HTMLElement
    );

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: { custom: 'keep', releaseLevel: ['TTQLDL'] },
        })
      )
    );
  });
});
