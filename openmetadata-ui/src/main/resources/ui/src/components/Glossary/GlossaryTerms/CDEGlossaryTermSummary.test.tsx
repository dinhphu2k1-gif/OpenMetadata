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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import CDEGlossaryTermSummary from './CDEGlossaryTermSummary';

jest.mock('../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockImplementation(({ displayName }) => <span>{displayName}</span>)
);

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn().mockImplementation(({ markdown }) => <span>{markdown}</span>)
);

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockImplementation(({ selectedTags }) => (
    <div>
      {selectedTags.map((tag) => tag.displayName ?? tag.name).join(', ')}
    </div>
  ))
);

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockImplementation(() => <div>CustomPropertyTable</div>),
}));

jest.mock('../../common/DomainSelectableList/DomainSelectableList.component', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
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
      tagFQN: 'Nguon_du_lieu.CRM',
    },
    {
      name: 'Noi_bo',
      displayName: 'Nội bộ',
      tagFQN: 'Phan_loai_du_lieu.Noi_bo',
    },
    {
      name: 'Da_ra_soat',
      displayName: 'Đã rà soát',
      tagFQN: 'QTDL_ra_soat.Da_ra_soat',
    },
    {
      name: 'Co',
      displayName: 'Có',
      tagFQN: 'Du_lieu_ca_nhan.Co',
    },
  ],
  extension: {
    van_ban_quy_dinh_lien_quan: 'Quy chế quản lý khách hàng',
    quy_dinh_chat_luong_du_lieu: true,
    ghi_chu: 'Áp dụng cho dữ liệu khách hàng cá nhân và tổ chức.',
  },
} as GlossaryTerm;

describe('CDEGlossaryTermSummary', () => {
  it('renders every mapped CDE column as an independent field', () => {
    render(
      <MemoryRouter>
        <CDEGlossaryTermSummary glossaryTerm={glossaryTerm} />
      </MemoryRouter>
    );

    [
      'Nhóm theo nghiệp vụ',
      'Nguồn dữ liệu',
      'Chủ sở hữu dữ liệu',
      'Phân loại dữ liệu',
      'QTDL rà soát',
      'Dữ liệu cá nhân',
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());

    expect(screen.getAllByRole('group')).toHaveLength(6);

    expect(screen.getByText('Khách hàng')).toBeInTheDocument();
    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('Nội bộ')).toBeInTheDocument();
    expect(screen.getByText('Đã rà soát')).toBeInTheDocument();
    expect(screen.getByText('CustomPropertyTable')).toBeInTheDocument();
  });
});
