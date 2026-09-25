import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import {
  commitCdeImport,
  downloadCdeImportTemplate,
  previewCdeImport,
} from '../../../rest/glossaryAPI';
import CDEImportModal from './CDEImportModal.component';

jest.mock('../../../rest/glossaryAPI', () => ({
  commitCdeImport: jest.fn(),
  downloadCdeImportTemplate: jest.fn(),
  previewCdeImport: jest.fn(),
}));
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const preview = {
  importSessionId: 'session-1',
  expiresAt: '2026-09-25T10:00:00Z',
  fileHash: 'hash',
  summary: { total: 1, error: 0 },
  canCommit: true,
  rows: [{
    rowNumber: 2,
    cdeCode: 'CUSTOMER_ID',
    action: 'REPLACE_IN_REVIEW_AND_REOPEN',
    warnings: ['review cancelled'],
    errors: [],
  }],
};

describe('CDEImportModal server-side atomic flow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('previews the workbook and warns about InReview rows before commit', async () => {
    (previewCdeImport as jest.Mock).mockResolvedValue(preview);
    render(
      <CDEImportModal
        glossaryId="glossary-id"
        parentBusinessVersion="2"
        visible
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['xlsx'], 'cde.xlsx')] } });
    await waitFor(() => expect(previewCdeImport).toHaveBeenCalledWith(
      'glossary-id', '2', 'OVERWRITE_EXISTING', expect.any(File)
    ));
    expect(await screen.findByText(/sẽ bị hủy duyệt/)).toBeInTheDocument();
    expect(screen.getByTestId('commit-cde-import')).toBeEnabled();
  });

  it('commits only the opaque session id and reports success', async () => {
    (previewCdeImport as jest.Mock).mockResolvedValue(preview);
    (commitCdeImport as jest.Mock).mockResolvedValue({ committed: 1 });
    const onSuccess = jest.fn();
    render(
      <CDEImportModal
        glossaryId="glossary-id"
        parentBusinessVersion="2"
        visible
        onCancel={jest.fn()}
        onSuccess={onSuccess}
      />
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['xlsx'], 'cde.xlsx')] } });
    fireEvent.click(await screen.findByTestId('commit-cde-import'));
    await waitFor(() => expect(commitCdeImport).toHaveBeenCalledWith('session-1'));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('keeps commit disabled when preview contains errors', async () => {
    (previewCdeImport as jest.Mock).mockResolvedValue({
      ...preview,
      canCommit: false,
      summary: { total: 1, error: 1 },
      rows: [{ ...preview.rows[0], errors: [{ rowNumber: 2, column: 'Mã CDE', code: 'DUPLICATE_CDE_NAME', message: 'duplicate' }] }],
    });
    render(
      <CDEImportModal
        glossaryId="glossary-id"
        parentBusinessVersion="2"
        visible
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'cde.xlsx')] },
    });
    expect(await screen.findByTestId('commit-cde-import')).toBeDisabled();
  });

  it('locks the stale preview after a 409 and does not retry', async () => {
    (previewCdeImport as jest.Mock).mockResolvedValue(preview);
    (commitCdeImport as jest.Mock).mockRejectedValue({ response: { status: 409 } });
    render(
      <CDEImportModal
        glossaryId="glossary-id"
        parentBusinessVersion="2"
        visible
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'cde.xlsx')] },
    });
    fireEvent.click(await screen.findByTestId('commit-cde-import'));
    expect(await screen.findByText(/Preview đã hết hạn hoặc dữ liệu đã thay đổi/)).toBeInTheDocument();
    expect(commitCdeImport).toHaveBeenCalledTimes(1);
  });

  it('downloads the dedicated server template', async () => {
    (downloadCdeImportTemplate as jest.Mock).mockResolvedValue(new Blob(['xlsx']));
    URL.createObjectURL = jest.fn(() => 'blob:template');
    URL.revokeObjectURL = jest.fn();
    render(
      <CDEImportModal
        glossaryId="glossary-id"
        parentBusinessVersion="2"
        visible
        onCancel={jest.fn()}
        onSuccess={jest.fn()}
      />
    );
    fireEvent.click(screen.getByText('Tải template'));
    await waitFor(() => expect(downloadCdeImportTemplate).toHaveBeenCalled());
  });
});
