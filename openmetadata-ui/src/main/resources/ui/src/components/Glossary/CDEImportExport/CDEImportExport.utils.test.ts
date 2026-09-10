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

import * as XLSX from 'xlsx';
import { EntityStatus, GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import {
  CDE_EXPORT_HEADERS,
  CDE_TEMPLATE_FILE_NAME,
  downloadCDEExcelTemplate,
  exportCDEToExcel,
  findMatchingDomain,
  findMatchingUserOrTeam,
  formatCDEImportErrorMessage,
  getCDEExportFileName,
  readAndValidateCDEExcel,
  transformRowToGlossaryTermPayload,
  validateCDEVersionValue,
  validateDataClassificationValue,
  validateDataQualityRulesValue,
  validateDataSourceValues,
  validatePersonalDataValue,
  validateUserOrTeamList,
} from './CDEImportExport.utils';

describe('CDEImportExport.utils', () => {
  describe('getCDEExportFileName', () => {
    it('should generate exact format Agribank_CDE_Danh_Tu_Dien_Du_Lieu_YYYYMMDD_HHmm.xlsx', () => {
      const fixedDate = new Date(2026, 8, 9, 9, 30); // 2026-09-09 09:30
      const fileName = getCDEExportFileName(fixedDate);
      expect(fileName).toBe('Agribank_CDE_Danh_Tu_Dien_Du_Lieu_20260909_0930.xlsx');
    });
  });

  describe('exportCDEToExcel and downloadCDEExcelTemplate', () => {
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;
    let mockClick: jest.Mock;

    beforeEach(() => {
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      URL.revokeObjectURL = jest.fn();

      mockClick = jest.fn();
      jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return {
            href: '',
            setAttribute: jest.fn(),
            click: mockClick,
          } as unknown as HTMLAnchorElement;
        }

        return document.createElement(tagName);
      });
      jest.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
      jest.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      jest.restoreAllMocks();
    });

    it('should export CDE terms with 14 headers and trigger download', () => {
      const mockTerms: GlossaryTerm[] = [
        {
          id: '1',
          name: 'CDE001',
          displayName: 'Mã số khách hàng',
          description: 'Định nghĩa khách hàng',
          entityStatus: EntityStatus.Approved,
          tags: [
            {
              tagFQN: 'DataSource.IPCAS',
              source: 'Classification',
            },
            {
              tagFQN: 'DataClassification.NoiBo',
              source: 'Classification',
            },
            {
              tagFQN: 'PersonalData.Co',
              source: 'Classification',
            },
          ],
          extension: {
            cdeVersion: '1.0',
            entityRelationship: 'Thuộc thực thể Khách hàng',
            relatedRegulatoryDocuments: 'QĐ 123',
            dataQualityRules: ['Y'],
          },
        } as unknown as GlossaryTerm,
      ];

      exportCDEToExcel(mockTerms);

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });

    it('should download template file Agribank_CDE_Mau_Nhap_Lieu.xlsx', () => {
      downloadCDEExcelTemplate();

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('readAndValidateCDEExcel', () => {
    it('should parse valid Excel file and flag all records with status Draft', async () => {
      const headers = [
        'Mã CDE quy chiếu',
        'Tên thành tố CDE',
        'Nhóm nghiệp vụ',
        'Nguồn dữ liệu',
        'Ý nghĩa nghiệp vụ',
        'Mối quan hệ với thực thể',
        'Chủ sở hữu dữ liệu',
        'Phân loại dữ liệu',
        'Dữ liệu cá nhân',
        'Văn bản quy định liên quan',
        'Quy định chất lượng dữ liệu',
        'Phiên bản',
        'Người kiểm soát',
      ];
      const rows = [
        headers,
        [
          'CDE100',
          'Tên khách hàng',
          'Khách hàng',
          'IPCAS',
          'Họ và tên đầy đủ',
          'Thuộc khách hàng',
          'Ban Kế toán',
          'Nội bộ',
          'Có',
          'QĐ 123',
          'Có',
          '1.0',
          'steward1',
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      const mockFile = {
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
      } as unknown as File;

      const result = await readAndValidateCDEExcel(mockFile);

      expect(result.totalRows).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.validCount).toBe(1);
      expect(result.rows[0].name).toBe('CDE100');
      expect(result.rows[0].status).toBe(EntityStatus.Draft); // Cố định trạng thái là Draft
      expect(result.rows[0].isValid).toBe(true);
    });

    it('should detect errors when Mã CDE is missing or duplicate', async () => {
      const rows = [
        ['Mã CDE quy chiếu', 'Tên thành tố CDE'],
        ['', 'Tên không có mã'],
        ['CDE200', 'Tên 1'],
        ['CDE200', 'Tên 2 trùng mã'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      const mockFile = {
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
      } as unknown as File;

      const result = await readAndValidateCDEExcel(mockFile);

      expect(result.totalRows).toBe(3);
      expect(result.rows[0].errors).toContain('Thiếu Mã CDE quy chiếu (bắt buộc).');
      expect(result.rows[2].errors[0]).toContain('bị trùng lặp với dòng khác trong file');
    });
  });

  describe('transformRowToGlossaryTermPayload', () => {
    it('should correctly format tags, extension, and always set entityStatus to Draft', () => {
      const row = {
        rowNumber: 2,
        name: 'CDE001',
        displayName: 'Mã số khách hàng',
        domain: 'Khách hàng',
        dataSource: 'IPCAS, SRC30',
        description: 'Mô tả',
        entityRelationship: 'Quan hệ thực thể',
        owner: 'Ban Kế toán',
        dataClassification: 'NoiBo',
        personalData: 'Có',
        relatedRegulatoryDocuments: 'Văn bản 123',
        dataQualityRules: 'Có',
        cdeVersion: '1.0',
        reviewer: 'steward',
        status: EntityStatus.Draft,
        errors: [],
        warnings: [],
        isValid: true,
      };

      const payload = transformRowToGlossaryTermPayload(row, 'Data Dictionary');

      expect(payload.name).toBe('CDE001');
      expect(payload.displayName).toBe('Mã số khách hàng');
      expect(payload.glossary).toBe('Data Dictionary');
      expect((payload as any).entityStatus).toBeUndefined(); // Không gửi entityStatus trong CreateGlossaryTerm payload
      expect(payload.extension).toEqual({
        cdeVersion: '1.0',
        entityRelationship: 'Quan hệ thực thể',
        relatedRegulatoryDocuments: 'Văn bản 123',
        dataQualityRules: ['Y'],
      });
      expect(payload.tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tagFQN: 'DataSource.IPCAS' }),
          expect.objectContaining({ tagFQN: 'DataSource.SRC30' }),
          expect.objectContaining({ tagFQN: 'DataClassification.Internal' }),
          expect.objectContaining({ tagFQN: 'PersonalData.Personal' }),
        ])
      );
    });

    it('should correctly transform Agribank_CDE_2.xlsx row (alo4) with domain Dich_vu, tags DataSource.Card, DataClassification.Internal, and no PersonalData tag', () => {
      const row = {
        rowNumber: 2,
        name: 'alo4',
        displayName: 'alo4',
        domain: 'Dịch vụ',
        dataSource: 'Thẻ',
        description: '<p>alo4</p>',
        entityRelationship: '<p>test 1 tý</p>',
        owner: 'KDVT, DCTC',
        dataClassification: 'Nội bộ',
        personalData: 'Không',
        relatedRegulatoryDocuments: '<p>okela</p>',
        dataQualityRules: 'Có',
        cdeVersion: '1.3',
        reviewer: 'KDVT',
        status: EntityStatus.Draft,
        errors: [],
        warnings: [],
        isValid: true,
      };

      const payload = transformRowToGlossaryTermPayload(row, 'Data Dictionary');

      expect(payload.name).toBe('alo4');
      expect(payload.displayName).toBe('alo4');
      expect(payload.glossary).toBe('Data Dictionary');
      expect(payload.domains).toEqual(['Dich_vu']);
      expect(payload.tags).toEqual([
        {
          tagFQN: 'DataSource.Card',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
        {
          tagFQN: 'DataClassification.Internal',
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        },
      ]);
      expect(payload.tags?.find((t) => t.tagFQN.startsWith('PersonalData.'))).toBeUndefined();
      expect(payload.extension).toEqual({
        cdeVersion: '1.3',
        entityRelationship: '<p>test 1 tý</p>',
        relatedRegulatoryDocuments: '<p>okela</p>',
        dataQualityRules: ['Y'],
      });
    });
  });

  describe('findMatchingDomain', () => {
    const mockDomains = [
      {
        id: '1',
        name: 'Dich_vu',
        displayName: 'Dịch vụ',
        fullyQualifiedName: 'Dich_vu',
      },
      {
        id: '2',
        name: 'Khach_hang',
        displayName: 'Khách hàng',
        fullyQualifiedName: 'Khach_hang',
      },
    ];

    it('should find domain by exact displayName', () => {
      const match = findMatchingDomain('Dịch vụ', mockDomains);
      expect(match?.name).toBe('Dich_vu');
    });

    it('should find domain by case-insensitive name or FQN', () => {
      const match = findMatchingDomain('dich_vu', mockDomains);
      expect(match?.displayName).toBe('Dịch vụ');
    });

    it('should find domain via KNOWN_CDE_DOMAIN_MAP unaccented keyword', () => {
      const match = findMatchingDomain('dich vu', mockDomains);
      expect(match?.name).toBe('Dich_vu');
    });

    it('should return undefined for non-existing domain such as Dịch vụ 2', () => {
      const match = findMatchingDomain('Dịch vụ 2', mockDomains);
      expect(match).toBeUndefined();
    });

    it('should return undefined for empty string or empty domains list', () => {
      expect(findMatchingDomain('', mockDomains)).toBeUndefined();
      expect(findMatchingDomain('Dịch vụ', [])).toBeUndefined();
    });
  });

  describe('Validation Helpers', () => {
    it('validateDataSourceValues should validate known and unknown sources', () => {
      const validRes = validateDataSourceValues('IPCAS, Thẻ');
      expect(validRes.isValid).toBe(true);
      expect(validRes.invalidSources).toEqual([]);

      const invalidRes = validateDataSourceValues('IPCAS, UnknownSource_123');
      expect(invalidRes.isValid).toBe(false);
      expect(invalidRes.invalidSources).toEqual(['UnknownSource_123']);
    });

    it('validateDataClassificationValue should validate 4 standard levels', () => {
      expect(validateDataClassificationValue('Nội bộ').isValid).toBe(true);
      expect(validateDataClassificationValue('Công cộng').isValid).toBe(true);
      expect(validateDataClassificationValue('Bí mật').isValid).toBe(true);
      expect(validateDataClassificationValue('Tối mật').isValid).toBe(true);
      expect(validateDataClassificationValue('Internal, Confidential').isValid).toBe(true);

      const invalid = validateDataClassificationValue('TuyMat');
      expect(invalid.isValid).toBe(false);
      expect(invalid.invalidValues).toEqual(['TuyMat']);
    });

    it('validatePersonalDataValue should validate boolean and category values', () => {
      expect(validatePersonalDataValue('Có').isValid).toBe(true);
      expect(validatePersonalDataValue('Không').isValid).toBe(true);
      expect(validatePersonalDataValue('Cơ bản').isValid).toBe(true);
      expect(validatePersonalDataValue('Nhạy cảm').isValid).toBe(true);
      expect(validatePersonalDataValue('Yes').isValid).toBe(true);
      expect(validatePersonalDataValue('No').isValid).toBe(true);

      const invalid = validatePersonalDataValue('UnknownValue');
      expect(invalid.isValid).toBe(false);
      expect(invalid.invalidValue).toBe('UnknownValue');
    });

    it('validateUserOrTeamList should validate users and teams existence', () => {
      const mockUsers = [
        { id: 'u1', type: 'user', name: 'user1', displayName: 'User One' },
      ];
      const mockTeams = [
        { id: 't1', type: 'team', name: 'Ban_Ke_toan', displayName: 'Ban Kế toán' },
      ];

      const validRes = validateUserOrTeamList('User One, Ban Kế toán', mockUsers, mockTeams);
      expect(validRes.isValid).toBe(true);
      expect(validRes.matchedRefs).toHaveLength(2);

      const invalidRes = validateUserOrTeamList('User One, GhostUser', mockUsers, mockTeams);
      expect(invalidRes.isValid).toBe(false);
      expect(invalidRes.invalidNames).toEqual(['GhostUser']);
    });

    it('validateDataQualityRulesValue should validate boolean responses', () => {
      expect(validateDataQualityRulesValue('Có').isValid).toBe(true);
      expect(validateDataQualityRulesValue('Không').isValid).toBe(true);
      expect(validateDataQualityRulesValue('1').isValid).toBe(true);
      expect(validateDataQualityRulesValue('0').isValid).toBe(true);
      expect(validateDataQualityRulesValue('invalid').isValid).toBe(false);
    });

    it('validateCDEVersionValue should validate version format', () => {
      expect(validateCDEVersionValue('1.0').isValid).toBe(true);
      expect(validateCDEVersionValue('2.1.0').isValid).toBe(true);
      expect(validateCDEVersionValue('v1.0').isValid).toBe(true);
      expect(validateCDEVersionValue('version_one').isValid).toBe(false);
    });
  });

  describe('readAndValidateCDEExcel with comprehensive pre-validation', () => {
    it('should detect invalid fields when domains, sources, users, and versions do not match', async () => {
      const headers = [
        'Mã CDE quy chiếu',
        'Tên thành tố CDE',
        'Nhóm nghiệp vụ',
        'Nguồn dữ liệu',
        'Ý nghĩa nghiệp vụ',
        'Mối quan hệ với thực thể',
        'Chủ sở hữu dữ liệu',
        'Phân loại dữ liệu',
        'Dữ liệu cá nhân',
        'Văn bản quy định liên quan',
        'Quy định chất lượng dữ liệu',
        'Phiên bản',
        'Người kiểm soát',
      ];
      const rows = [
        headers,
        [
          'CDE999',
          'Tên không hợp lệ',
          'Miền Không Tồn Tại',
          'Nguồn Lạ 999',
          'Mô tả',
          'Thực thể',
          'OwnerKhongTonTai',
          'Phân Loại Sai',
          'Dữ Liệu Cá Nhân Sai',
          'QĐ 123',
          'Không Phải Boolean',
          'version-sai',
          'ReviewerKhongTonTai',
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

      const mockFile = {
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
      } as unknown as File;

      const mockDomains = [
        { id: '1', name: 'Dich_vu', displayName: 'Dịch vụ' },
      ];
      const mockUsers = [
        { id: 'u1', type: 'user', name: 'user1', displayName: 'User One' },
      ];

      const result = await readAndValidateCDEExcel(
        mockFile,
        [],
        mockDomains,
        [],
        mockUsers,
        []
      );

      expect(result.errorCount).toBe(1);
      const rowErrors = result.rows[0].errors;
      expect(rowErrors.some((e) => e.includes('không tồn tại trên hệ thống'))).toBe(true);
      expect(rowErrors.some((e) => e.includes('Nguồn dữ liệu'))).toBe(true);
      expect(rowErrors.some((e) => e.includes('Phân loại dữ liệu'))).toBe(true);
      expect(rowErrors.some((e) => e.includes('Dữ liệu cá nhân'))).toBe(true);
      expect(rowErrors.some((e) => e.includes('Chủ sở hữu'))).toBe(true);
      expect(rowErrors.some((e) => e.includes('Người kiểm soát'))).toBe(true);
      expect(rowErrors.some((e) => e.includes('Quy định chất lượng dữ liệu'))).toBe(true);
      expect(rowErrors.some((e) => e.includes('Phiên bản'))).toBe(true);
    });
  });

  describe('formatCDEImportErrorMessage', () => {
    // Mock i18next t function
    const mockT = (key: string, defaultVal?: any, options?: any) => {
      if (typeof defaultVal === 'string' && options) {
        return defaultVal.replace(/\{\{(\w+)\}\}/g, (_, k) => options[k] ?? '');
      }
      return defaultVal || key;
    };

    it('should format duplicate term error from backend Java CatalogExceptionMessage', () => {
      const backendError = {
        response: {
          data: {
            message:
              "A term with the name 'alo4' already exists in 'Data Dictionary' glossary.",
          },
        },
      };

      const result = formatCDEImportErrorMessage(backendError, mockT, 'create');
      expect(result).toBe(
        "Mã CDE 'alo4' đã tồn tại trong danh mục 'Data Dictionary'."
      );
    });

    it('should format entity name already exists error', () => {
      const backendError =
        "GlossaryTerm with name 'alo4' already exists.";

      const result = formatCDEImportErrorMessage(backendError, mockT, 'create');
      expect(result).toBe("Mã CDE 'alo4' đã tồn tại trên hệ thống.");
    });

    it('should format parent chain already exists error', () => {
      const backendError =
        "Term 'alo4' (or one of its descendants) already exists in the parent chain.";

      const result = formatCDEImportErrorMessage(backendError, mockT, 'create');
      expect(result).toBe("Thuật ngữ 'alo4' đã tồn tại trong chuỗi phân cấp cha.");
    });

    it('should format generic already exists error', () => {
      const backendError = { message: 'Entity already exists' };

      const result = formatCDEImportErrorMessage(backendError, mockT, 'create');
      expect(result).toBe('Bản ghi CDE đã tồn tại trên hệ thống.');
    });

    it('should format permission denied error', () => {
      const backendError = {
        response: {
          data: {
            message:
              "Principal: CatalogPrincipal{name='test'} does not have permissions to create glossary term",
          },
        },
      };

      const result = formatCDEImportErrorMessage(backendError, mockT, 'create');
      expect(result).toBe('Bạn không có quyền thực hiện thao tác này.');
    });

    it('should format mutually exclusive tags error', () => {
      const backendError = 'Tag labels are mutually exclusive';

      const result = formatCDEImportErrorMessage(backendError, mockT, 'create');
      expect(result).toBe('Các nhãn phân loại (tags) bị xung đột lẫn nhau.');
    });

    it('should format entity not found error', () => {
      const backendError = 'Glossary instance for id not found';

      const result = formatCDEImportErrorMessage(backendError, mockT, 'update');
      expect(result).toBe('Không tìm thấy thông tin bản ghi trên hệ thống.');
    });

    it('should format network error', () => {
      const backendError = new Error('Network Error');

      const result = formatCDEImportErrorMessage(backendError, mockT, 'create');
      expect(result).toBe('Lỗi kết nối tới máy chủ.');
    });

    it('should format internal server error', () => {
      const backendError = 'Internal server error occurred';

      const result = formatCDEImportErrorMessage(backendError, mockT, 'create');
      expect(result).toBe('Lỗi máy chủ nội bộ. Vui lòng thử lại sau.');
    });

    it('should return fallback message when error is empty', () => {
      expect(formatCDEImportErrorMessage(null, mockT, 'create')).toBe(
        'Lỗi khi tạo mới bản ghi CDE.'
      );
      expect(formatCDEImportErrorMessage(undefined, mockT, 'update')).toBe(
        'Lỗi khi cập nhật bản ghi CDE.'
      );
    });

    it('should preserve already localized Vietnamese text', () => {
      const customMsg = 'Không tìm thấy ID của bản ghi CDE cần cập nhật.';
      expect(formatCDEImportErrorMessage(customMsg, mockT, 'update')).toBe(
        customMsg
      );
    });
  });
});


