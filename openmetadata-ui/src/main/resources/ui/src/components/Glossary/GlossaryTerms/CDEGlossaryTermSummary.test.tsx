/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import CDEGlossaryTermSummary from './CDEGlossaryTermSummary';

const mockUpdate = jest.fn();
let mockPermissions: Record<string, boolean> = {};
let mockVersionView = false;
jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: () => ({
    permissions: mockPermissions,
    isVersionView: mockVersionView,
    entityRules: { canAddMultipleDomains: true },
    onUpdate: mockUpdate,
  }),
}));

jest.mock('../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockImplementation(({ displayName }) => <span>{displayName}</span>)
);

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn().mockImplementation(({ markdown }) => <span>{markdown}</span>)
);

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () =>
  jest
    .fn()
    .mockImplementation(({ selectedTags }) => (
      <div>
        {selectedTags.map((tag) => tag.displayName ?? tag.name).join(', ')}
      </div>
    ))
);

jest.mock(
  '../../common/DomainSelectableList/DomainSelectableList.component',
  () => jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

const glossaryTerm = {
  name: 'CDE_KHACH_HANG',
  displayName: 'Khách hàng',
  description: 'Khách hàng là cá nhân hoặc tổ chức có quan hệ với Agribank.',
  domains: [
    {
      id: 'domain-id',
      name: 'Khách hàng',
      type: 'domain',
    },
  ],
  owners: [
    {
      id: 'owner-id',
      name: 'khnb',
      displayName: 'Khối Ngân hàng Bán lẻ',
      type: 'team',
    },
  ],
  tags: [
    {
      name: 'CRM',
      tagFQN: 'DataSource.CRM',
    },
    {
      name: 'Noi_bo',
      displayName: 'Nội bộ',
      tagFQN: 'DataClassification.Noi_bo',
    },
    {
      name: 'Co',
      displayName: 'Có',
      tagFQN: 'PersonalData.Co',
    },
  ],
  extension: {
    entityRelationship: 'Quan hệ khách hàng với tài khoản',
    relatedRegulatoryDocuments: 'Quy chế quản lý khách hàng',
    dataQualityRules: true,
  },
} as GlossaryTerm;

const cdeTranslations: Record<'en' | 'vi', Record<string, string>> = {
  en: {
    'cde.version': 'Version',
    'cde.effective-date': 'Effective date',
    'cde.expiration-date': 'Expiration date',
    'cde.business-group': 'Business Group',
    'cde.data-source': 'Data Source',
    'cde.data-owner': 'Data Owner',
    'cde.data-classification': 'Data Classification',
    'cde.personal-data': 'Personal Data',
    'cde.data-quality-rules': 'Data Quality Rules',
    'cde.related-regulatory-documents': 'Related Regulatory Documents',
    'cde.entity-relationship': 'Entity Relationship',
    'label.yes': 'Yes',
    'label.no': 'No',
  },
  vi: {
    'cde.version': 'Phiên bản',
    'cde.effective-date': 'Ngày hiệu lực',
    'cde.expiration-date': 'Ngày hết hiệu lực',
    'cde.business-group': 'Nhóm theo nghiệp vụ',
    'cde.data-source': 'Nguồn dữ liệu',
    'cde.data-owner': 'Chủ sở hữu dữ liệu',
    'cde.data-classification': 'Phân loại dữ liệu',
    'cde.personal-data': 'Dữ liệu cá nhân',
    'cde.data-quality-rules': 'Quy định về chất lượng dữ liệu',
    'cde.related-regulatory-documents': 'Văn bản quy định liên quan',
    'cde.entity-relationship': 'Mối quan hệ với thực thể',
    'label.yes': 'Có',
    'label.no': 'Không',
  },
};

const setCDELocale = (locale: keyof typeof cdeTranslations) => {
  (useTranslation as jest.Mock).mockReturnValue({
    t: (key: string) => cdeTranslations[locale][key] ?? key,
    i18n: { language: locale === 'en' ? 'en-US' : 'vi-VN' },
  });
};

describe('CDEGlossaryTermSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPermissions = {};
    mockVersionView = false;
    mockUpdate.mockResolvedValue(undefined);
    setCDELocale('vi');
  });

  it('renders Group 1 and Group 2 as structured sections with mapped CDE fields', () => {
    render(
      <MemoryRouter>
        <CDEGlossaryTermSummary glossaryTerm={glossaryTerm} />
      </MemoryRouter>
    );

    expect(
      screen.getByTestId('cde-glossary-term-summary-group-1')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('cde-glossary-term-summary-group-2')
    ).toBeInTheDocument();

    [
      'Nhóm theo nghiệp vụ',
      'Nguồn dữ liệu',
      'Chủ sở hữu dữ liệu',
      'Phân loại dữ liệu',
      'Dữ liệu cá nhân',
      'Quy định về chất lượng dữ liệu',
      'Mối quan hệ với thực thể',
      'Văn bản quy định liên quan',
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());

    expect(screen.getAllByRole('group')).toHaveLength(10);
    expect(
      screen.queryByRole('group', { name: 'Phiên bản' })
    ).not.toBeInTheDocument();

    const effectiveDate = screen.getByRole('group', { name: 'Ngày hiệu lực' });
    const expirationDate = screen.getByRole('group', {
      name: 'Ngày hết hiệu lực',
    });

    expect(effectiveDate.nextElementSibling).toBe(expirationDate);

    expect(screen.getByText('Khách hàng')).toBeInTheDocument();
    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('Nội bộ')).toBeInTheDocument();
    expect(screen.getByText('Y')).toBeInTheDocument();
    expect(
      screen.getByText('Quan hệ khách hàng với tài khoản')
    ).toBeInTheDocument();
    expect(screen.getByText('Quy chế quản lý khách hàng')).toBeInTheDocument();
  });

  it('uses English labels when language is set to English', () => {
    setCDELocale('en');

    render(
      <MemoryRouter>
        <CDEGlossaryTermSummary glossaryTerm={glossaryTerm} />
      </MemoryRouter>
    );

    [
      'Business Group',
      'Data Source',
      'Data Owner',
      'Data Classification',
      'Personal Data',
      'Data Quality Rules',
      'Entity Relationship',
      'Related Regulatory Documents',
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });

  it.each([false, true])(
    'does not offer date editing without permission or in version view (%s)',
    (versionView) => {
      mockPermissions = { EditCustomFields: versionView };
      mockVersionView = versionView;
      render(
        <MemoryRouter>
          <CDEGlossaryTermSummary
            glossaryTerm={{
              ...glossaryTerm,
              extension: {
                cdeVersion: '1.2',
                effectiveDate: '2026-01-01',
              },
            }}
          />
        </MemoryRouter>
      );

      expect(screen.queryByText('1.2')).not.toBeInTheDocument();
      expect(screen.getByText('01/01/2026')).toBeInTheDocument();
      expect(
        within(
          screen.getByRole('group', { name: 'Ngày hiệu lực' })
        ).queryByRole('button')
      ).not.toBeInTheDocument();
    }
  );

  it('allows custom-field editors to clear a date while retaining metadata and status', async () => {
    mockPermissions = { EditCustomFields: true };
    const term = {
      ...glossaryTerm,
      extension: {
        ...glossaryTerm.extension,
        custom: 'keep',
        effectiveDate: '2026-01-01',
        expirationDate: '2026-12-31',
      },
    };
    render(
      <MemoryRouter>
        <CDEGlossaryTermSummary glossaryTerm={term} />
      </MemoryRouter>
    );
    fireEvent.click(
      within(
        screen.getByRole('group', { name: 'Ngày hết hiệu lực' })
      ).getByRole('button')
    );
    const dialog = screen.getByRole('dialog');

    expect(
      within(dialog).queryByLabelText('Ngày hiệu lực')
    ).not.toBeInTheDocument();

    const expiration = within(dialog)
      .getByLabelText('Ngày hết hiệu lực')
      .closest('.ant-picker');
    await act(async () => {
      fireEvent.mouseUp(expiration!.querySelector('.ant-picker-clear')!);
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    const [updated, field] = mockUpdate.mock.calls[0];

    expect(field).toBe('extension');
    expect(updated.extension).toMatchObject({
      custom: 'keep',
      effectiveDate: '2026-01-01',
    });
    expect(updated.extension).not.toHaveProperty('expirationDate');
    expect(updated.entityStatus).toBe(term.entityStatus);
  });
});
