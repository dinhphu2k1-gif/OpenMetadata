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
  downloadDQExcelTemplate,
  exportDQToExcel,
  formatDQImportErrorMessage,
  getDQExportFileName,
  readAndValidateDQExcel,
  transformDQRowToGlossaryTermPayload,
  validateDQDataSourceValues,
  validateDQDimensionValue,
  validateDQFrequencyValue,
  validateDQMethodValue,
  validateDQTargetPopulationValue,
} from './DQImportExport.utils';

describe('DQImportExport.utils', () => {
  describe('getDQExportFileName', () => {
    it('should generate Agribank_DQ_Danh_Muc_Quy_Tac_YYYYMMDD_HHmm.xlsx', () => {
      const fixedDate = new Date(2026, 8, 9, 14, 30);
      const name = getDQExportFileName(fixedDate);
      expect(name).toBe('Agribank_DQ_Danh_Muc_Quy_Tac_20260909_1430.xlsx');
    });
  });

  describe('exportDQToExcel and downloadDQExcelTemplate', () => {
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;
    let mockClick: jest.Mock;
    let setAttributeSpy: jest.Mock;

    beforeEach(() => {
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      URL.revokeObjectURL = jest.fn();

      mockClick = jest.fn();
      setAttributeSpy = jest.fn();
      jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return {
            href: '',
            setAttribute: setAttributeSpy,
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

    it('should export DQ terms to Excel and trigger download', () => {
      const mockTerms: GlossaryTerm[] = [
        {
          id: 'term-1',
          name: 'DQ3.1',
          displayName: 'DQ3.1',
          description: 'Mô tả quy tắc',
          fullyQualifiedName: 'Data Quality.DQ3.1',
          status: EntityStatus.Draft,
          extension: {
            cdeCode: 'CDE3',
            cdeName: 'Mã số khách hàng',
            ruleExplanation: 'Diễn giải',
            qualityThreshold: '99%',
          },
          tags: [
            {
              tagFQN: 'DataQualityDimension.Completeness',
              displayName: 'Tính đầy đủ',
              labelType: 'Manual',
              state: 'Confirmed',
            },
            {
              tagFQN: 'DataSource.IPCAS',
              displayName: 'IPCAS',
              labelType: 'Manual',
              state: 'Confirmed',
            },
          ],
        } as unknown as GlossaryTerm,
      ];

      exportDQToExcel(mockTerms);

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(setAttributeSpy).toHaveBeenCalledWith(
        'download',
        expect.stringMatching(/^Agribank_DQ_Danh_Muc_Quy_Tac_\d{8}_\d{4}\.xlsx$/)
      );
      expect(mockClick).toHaveBeenCalled();
    });

    it('should download template file Agribank_DQ_Mau_Nhap_Lieu.xlsx', () => {
      downloadDQExcelTemplate();

      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(setAttributeSpy).toHaveBeenCalledWith(
        'download',
        'Agribank_DQ_Mau_Nhap_Lieu.xlsx'
      );
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Validation Helpers', () => {
    it('validateDQDimensionValue should validate standard and custom dimensions', () => {
      expect(validateDQDimensionValue('Tính đầy đủ').isValid).toBe(true);
      expect(validateDQDimensionValue('completeness').isValid).toBe(true);
      expect(validateDQDimensionValue('Tính chính xác').isValid).toBe(true);
      expect(validateDQDimensionValue('Tính nhất quán').isValid).toBe(true);
      expect(validateDQDimensionValue('Tính tuân thủ').isValid).toBe(true);
      expect(validateDQDimensionValue('Tính kịp thời').isValid).toBe(true);
      expect(validateDQDimensionValue('Không tồn tại').isValid).toBe(false);
    });

    it('validateDQTargetPopulationValue should validate target population', () => {
      expect(validateDQTargetPopulationValue('Toàn nền khách hàng').isValid).toBe(true);
      expect(validateDQTargetPopulationValue('Khách hàng cá nhân').isValid).toBe(true);
      expect(validateDQTargetPopulationValue('Dữ liệu rủi ro tín dụng').isValid).toBe(true);
      expect(validateDQTargetPopulationValue('').isValid).toBe(true);
    });

    it('validateDQMethodValue should validate inspection methods', () => {
      expect(validateDQMethodValue('SQL').isValid).toBe(true);
      expect(validateDQMethodValue('Kiểm tra bằng Quy tắc kỹ thuật (SQL)').isValid).toBe(true);
      expect(validateDQMethodValue('Data Profiling').isValid).toBe(true);
      expect(validateDQMethodValue('').isValid).toBe(true);
    });

    it('validateDQFrequencyValue should validate frequency', () => {
      expect(validateDQFrequencyValue('Hàng Quý').isValid).toBe(true);
      expect(validateDQFrequencyValue('Tháng/Quý').isValid).toBe(true);
      expect(validateDQFrequencyValue('Hàng Tháng').isValid).toBe(true);
      expect(validateDQFrequencyValue('Hàng Ngày').isValid).toBe(true);
      expect(validateDQFrequencyValue('').isValid).toBe(true);
    });

    it('validateDQDataSourceValues should validate data sources', () => {
      const res = validateDQDataSourceValues('IPCAS, Kho RRTD');
      expect(res.isValid).toBe(true);
      expect(res.matchedTags.length).toBe(2);

      const invalidRes = validateDQDataSourceValues('UnknownSourceXYZ');
      expect(invalidRes.isValid).toBe(false);
      expect(invalidRes.invalidValues).toContain('UnknownSourceXYZ');
    });
  });

  describe('readAndValidateDQExcel', () => {
    it('should read valid Excel and parse records', async () => {
      const rows = [
        [
          'Mã quy tắc nghiệp vụ',
          'Mã CDE quy chiếu',
          'Tên thành tố CDE',
          'Tiêu chí đánh giá Chất lượng Dữ liệu',
          'Quy tắc nghiệp vụ về chất lượng dữ liệu',
          'Diễn giải Quy tắc nghiệp vụ',
          'Ràng buộc/yêu cầu khác/Ghi chú khác biệt',
          'Dấu hiệu xác định các trường hợp ngoại lệ',
          'Tiêu chí cơ sở (Tập dữ liệu kiểm tra)',
          'Hình thức kiểm tra chất lượng dữ liệu',
          'Tần suất',
          'Ngưỡng Chất lượng Dữ liệu',
          'Nguồn dữ liệu',
        ],
        [
          'DQ3.1',
          'CDE3',
          'Mã số khách hàng',
          'Tính đầy đủ',
          'Mã số khách hàng không được để trống',
          'Diễn giải chi tiết',
          'Ràng buộc',
          'Ngoại lệ',
          'Toàn nền khách hàng',
          'Kiểm tra bằng Quy tắc kỹ thuật (SQL)',
          'Hàng Quý',
          '99%',
          'IPCAS',
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Quy tắc chất lượng dữ liệu');
      const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const mockFile = {
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
      } as unknown as File;

      const result = await readAndValidateDQExcel(mockFile);

      expect(result.totalRows).toBe(1);
      expect(result.validCount).toBe(1);
      expect(result.rows[0].name).toBe('DQ3.1');
      expect(result.rows[0].cdeCode).toBe('CDE3');
      expect(result.rows[0].isValid).toBe(true);
    });

    it('should detect duplicate or missing rule code', async () => {
      const rows = [
        [
          'Mã quy tắc nghiệp vụ',
          'Mã CDE quy chiếu',
          'Tên thành tố CDE',
          'Tiêu chí đánh giá Chất lượng Dữ liệu',
          'Quy tắc nghiệp vụ về chất lượng dữ liệu',
        ],
        ['', 'CDE1', 'Tên', 'Tính đầy đủ', 'Mô tả'],
        ['DQ1.1', 'CDE1', 'Tên', 'Tính đầy đủ', 'Mô tả'],
        ['DQ1.1', 'CDE1', 'Tên', 'Tính đầy đủ', 'Mô tả lặp'],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

      const mockFile = {
        arrayBuffer: jest.fn().mockResolvedValue(arrayBuffer),
      } as unknown as File;

      const result = await readAndValidateDQExcel(mockFile);

      expect(result.totalRows).toBe(3);
      expect(result.rows[0].errors).toContain('Thiếu Mã quy tắc nghiệp vụ (bắt buộc).');
      expect(result.rows[2].errors[0]).toContain('bị trùng lặp với dòng khác trong file');
    });
  });

  describe('transformDQRowToGlossaryTermPayload', () => {
    it('should transform row into payload with tags and extensions', () => {
      const row = {
        rowNumber: 1,
        name: 'DQ3.1',
        cdeCode: 'CDE3',
        cdeName: 'Mã số khách hàng',
        dimension: 'Tính đầy đủ',
        description: 'Mô tả quy tắc',
        ruleExplanation: 'Diễn giải',
        otherConstraints: 'Ràng buộc',
        exceptions: 'Ngoại lệ',
        targetPopulation: 'Toàn nền khách hàng',
        method: 'SQL',
        frequency: 'Hàng Quý',
        qualityThreshold: '99%',
        dataSource: 'IPCAS',
        status: EntityStatus.Draft,
        errors: [],
        warnings: [],
        isValid: true,
      };

      const mockCdeTerms = [
        {
          id: 'cde-3-id',
          name: 'CDE3',
          displayName: 'Mã số khách hàng',
          fullyQualifiedName: 'Data Dictionary.CDE3',
        } as unknown as GlossaryTerm,
      ];

      const payload = transformDQRowToGlossaryTermPayload(
        row,
        'Data Quality',
        [],
        mockCdeTerms
      );

      expect(payload.name).toBe('DQ3.1');
      expect(payload.glossary).toBe('Data Quality');
      expect(payload.extension).toEqual({
        cdeCode: 'CDE3',
        cdeName: 'Mã số khách hàng',
        ruleExplanation: 'Diễn giải',
        otherConstraints: 'Ràng buộc',
        exceptions: 'Ngoại lệ',
        qualityThreshold: '99%',
      });
      expect(payload.tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tagFQN: 'DataQualityDimension.Completeness' }),
          expect.objectContaining({ tagFQN: 'DataSource.IPCAS' }),
          expect.objectContaining({ tagFQN: 'DataQualityFrequency.Quarterly' }),
        ])
      );
      expect(payload.relatedTerms).toHaveLength(1);
      expect(payload.relatedTerms?.[0].id).toBe('cde-3-id');
    });
  });

  describe('formatDQImportErrorMessage', () => {
    const mockT = (key: string, defaultVal?: any, options?: any) => {
      if (typeof defaultVal === 'string' && options) {
        return defaultVal.replace(/\{\{(\w+)\}\}/g, (_, k) => options[k] ?? '');
      }
      return defaultVal || key;
    };

    it('should format backend duplicate error', () => {
      const err = {
        response: {
          data: {
            message: "A term with the name 'DQ3.1' already exists in 'Data Quality' glossary.",
          },
        },
      };
      expect(formatDQImportErrorMessage(err, mockT)).toBe(
        "Mã quy tắc 'DQ3.1' đã tồn tại trong danh mục 'Data Quality'."
      );
    });

    it('should format entity name already exists error', () => {
      const err = "GlossaryTerm with name 'DQ3.1' already exists.";
      expect(formatDQImportErrorMessage(err, mockT)).toBe(
        "Mã quy tắc 'DQ3.1' đã tồn tại trên hệ thống."
      );
    });

    it('should format permission denied error', () => {
      const err = 'Permission denied for user';
      expect(formatDQImportErrorMessage(err, mockT)).toBe(
        'Bạn không có quyền thực hiện thao tác này.'
      );
    });
  });
});
