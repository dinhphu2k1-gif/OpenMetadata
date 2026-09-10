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

import { fireEvent, render, screen } from '@testing-library/react';
import CDEImportModal from './CDEImportModal.component';
import * as utils from './CDEImportExport.utils';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal: string) => defaultVal || key,
  }),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  addGlossaryTerm: jest.fn().mockResolvedValue({ id: 'new-id', name: 'CDE001', entityStatus: 'Draft' }),
  patchGlossaryTerm: jest.fn().mockResolvedValue({ id: 'patch-id', name: 'CDE001', entityStatus: 'Draft' }),
}));

jest.mock('../../../rest/domainAPI', () => ({
  getDomainList: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../rest/tagAPI', () => ({
  getTags: jest.fn().mockResolvedValue({ data: [] }),
}));

describe('CDEImportModal', () => {
  const defaultProps = {
    visible: true,
    onCancel: jest.fn(),
    onSuccess: jest.fn(),
    glossaryFQN: 'Data Dictionary',
    existingTerms: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render step 1 with upload dragger and download template button', () => {
    render(<CDEImportModal {...defaultProps} />);

    expect(screen.getByText('Tải file & Cấu hình')).toBeInTheDocument();
    expect(screen.getByText('Tải file mẫu Excel')).toBeInTheDocument();
    expect(screen.getByText(/Kéo thả file Excel/i)).toBeInTheDocument();
    expect(screen.getByText(/Mọi bản ghi CDE nạp mới sẽ được khởi tạo ở trạng thái/i)).toBeInTheDocument();
    expect(screen.getByText(/Bản nháp \(Draft\)/i)).toBeInTheDocument();
  });

  it('should trigger downloadCDEExcelTemplate when template button is clicked', () => {
    const spyDownload = jest.spyOn(utils, 'downloadCDEExcelTemplate').mockImplementation();

    render(<CDEImportModal {...defaultProps} />);

    const downloadBtn = screen.getByText('Tải file mẫu Excel');
    fireEvent.click(downloadBtn);

    expect(spyDownload).toHaveBeenCalled();
  });
});
