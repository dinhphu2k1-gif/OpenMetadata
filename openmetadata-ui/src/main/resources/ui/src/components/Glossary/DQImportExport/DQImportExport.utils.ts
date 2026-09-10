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

import { isEmpty } from 'lodash';
import * as XLSX from 'xlsx';
import { EntityStatus, GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { Tag } from '../../../generated/entity/classification/tag';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getEntityStatusLabel } from '../../../utils/EntityStatusUtils';
import { DQ_TAG_CLASSIFICATIONS, DQExtension } from '../GlossaryTermTab/DQGlossaryTableColumns';
import { ModifiedGlossaryTerm } from '../GlossaryTermTab/GlossaryTermTab.interface';

export interface DQImportRowData {
  rowNumber: number;
  name: string;
  cdeCode: string;
  cdeName: string;
  dimension: string;
  description: string;
  ruleExplanation: string;
  otherConstraints: string;
  exceptions: string;
  targetPopulation: string;
  method: string;
  frequency: string;
  qualityThreshold: string;
  dataSource: string;
  status: EntityStatus;
  isExisting?: boolean;
  existingId?: string;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

export interface DQValidationResult {
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  rows: DQImportRowData[];
}

export const DQ_EXCEL_SHEET_NAME = 'Quy tắc chất lượng dữ liệu';

export const DQ_EXPORT_HEADERS = [
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
  'Trạng thái',
];

export const DQ_TEMPLATE_HEADERS = [
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
];

export const DQ_COLUMN_WIDTHS = [
  { wch: 22 }, // Mã quy tắc
  { wch: 18 }, // Mã CDE
  { wch: 26 }, // Tên thành tố CDE
  { wch: 32 }, // Tiêu chí CLDL
  { wch: 45 }, // Quy tắc nghiệp vụ
  { wch: 40 }, // Diễn giải
  { wch: 35 }, // Ràng buộc
  { wch: 35 }, // Ngoại lệ
  { wch: 32 }, // Tiêu chí cơ sở
  { wch: 32 }, // Hình thức kiểm tra
  { wch: 18 }, // Tần suất
  { wch: 22 }, // Ngưỡng CLDL
  { wch: 20 }, // Nguồn dữ liệu
  { wch: 16 }, // Trạng thái
];

export const DQ_TEMPLATE_FILE_NAME = 'Agribank_DQ_Mau_Nhap_Lieu.xlsx';

export const getDQExportFileName = (date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const mm = pad(date.getMinutes());

  return `Agribank_DQ_Danh_Muc_Quy_Tac_${yyyy}${MM}${dd}_${HH}${mm}.xlsx`;
};

// Chuẩn hóa chuỗi tiếng Việt không dấu để so khớp
export const normalizeDQText = (str?: string): string => {
  if (!str) {
    return '';
  }

  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();
};

export const STANDARD_DQ_DIMENSIONS: Record<string, { fqn: string; label: string }> = {
  completeness: { fqn: 'DataQualityDimension.Completeness', label: 'Tính đầy đủ' },
  accuracy: { fqn: 'DataQualityDimension.Accuracy', label: 'Tính chính xác' },
  consistency: { fqn: 'DataQualityDimension.Consistency', label: 'Tính nhất quán' },
  compliance: { fqn: 'DataQualityDimension.Compliance', label: 'Tính tuân thủ' },
  timeliness: { fqn: 'DataQualityDimension.Timeliness', label: 'Tính kịp thời' },
};

export const STANDARD_DQ_POPULATIONS: Record<string, { fqn: string; label: string }> = {
  entirecustomerbase: { fqn: 'DataQualityTargetPopulation.EntireCustomerBase', label: 'Toàn nền khách hàng' },
  individualcustomers: { fqn: 'DataQualityTargetPopulation.IndividualCustomers', label: 'Khách hàng cá nhân' },
  customerswithinfo: { fqn: 'DataQualityTargetPopulation.CustomersWithInfo', label: 'Toàn bộ khách hàng có thông tin' },
  creditriskdata: { fqn: 'DataQualityTargetPopulation.CreditRiskData', label: 'Dữ liệu rủi ro tín dụng' },
};

export const STANDARD_DQ_METHODS: Record<string, { fqn: string; label: string }> = {
  technicalsqlrule: { fqn: 'DataQualityMethod.TechnicalSqlRule', label: 'Kiểm tra bằng Quy tắc kỹ thuật (SQL)' },
  dataprofiling: { fqn: 'DataQualityMethod.DataProfiling', label: 'Kiểm tra tự động (Data Profiling)' },
};

export const STANDARD_DQ_FREQUENCIES: Record<string, { fqn: string; label: string }> = {
  quarterly: { fqn: 'DataQualityFrequency.Quarterly', label: 'Hàng Quý' },
  monthlyorquarterly: { fqn: 'DataQualityFrequency.MonthlyOrQuarterly', label: 'Tháng/Quý' },
  monthly: { fqn: 'DataQualityFrequency.Monthly', label: 'Hàng Tháng' },
  daily: { fqn: 'DataQualityFrequency.Daily', label: 'Hàng Ngày' },
};

export const STANDARD_DQ_DATA_SOURCES: Record<string, { fqn: string; label: string }> = {
  ipcas: { fqn: 'DataSource.IPCAS', label: 'IPCAS' },
  creditriskdatawarehouse: { fqn: 'DataSource.CreditRiskDataWarehouse', label: 'Kho RRTD' },
  rrtd: { fqn: 'DataSource.CreditRiskDataWarehouse', label: 'Kho RRTD' },
};

/**
 * Thẩm định Tiêu chí Chất lượng Dữ liệu
 */
export const validateDQDimensionValue = (
  raw: string,
  availableTags: Tag[] = []
): { isValid: boolean; tagFQN?: string; normalizedLabel?: string } => {
  if (!raw || !raw.trim()) {
    return { isValid: false };
  }
  const clean = raw.trim();
  const norm = normalizeDQText(clean);

  // 1. Kiểm tra trong danh mục chuẩn
  for (const [key, item] of Object.entries(STANDARD_DQ_DIMENSIONS)) {
    if (norm.includes(key) || norm === normalizeDQText(item.label)) {
      return { isValid: true, tagFQN: item.fqn, normalizedLabel: item.label };
    }
  }

  // 2. Kiểm tra trong tags từ backend
  if (availableTags.length > 0) {
    const matched = availableTags.find((t) => {
      const tagNorm = normalizeDQText(t.displayName || t.name);
      return (
        t.classification?.name === DQ_TAG_CLASSIFICATIONS.dimension &&
        (tagNorm === norm || norm.includes(tagNorm))
      );
    });
    if (matched) {
      return {
        isValid: true,
        tagFQN: matched.fullyQualifiedName || matched.name,
        normalizedLabel: matched.displayName || matched.name,
      };
    }
  }

  return { isValid: false };
};

/**
 * Thẩm định Tiêu chí cơ sở / Tập dữ liệu kiểm tra
 */
export const validateDQTargetPopulationValue = (
  raw: string,
  availableTags: Tag[] = []
): { isValid: boolean; tagFQN?: string; normalizedLabel?: string } => {
  if (!raw || !raw.trim()) {
    return { isValid: true }; // Không bắt buộc
  }
  const clean = raw.trim();
  const norm = normalizeDQText(clean);

  for (const [key, item] of Object.entries(STANDARD_DQ_POPULATIONS)) {
    if (norm.includes(key) || norm === normalizeDQText(item.label)) {
      return { isValid: true, tagFQN: item.fqn, normalizedLabel: item.label };
    }
  }

  if (availableTags.length > 0) {
    const matched = availableTags.find((t) => {
      const tagNorm = normalizeDQText(t.displayName || t.name);
      return (
        t.classification?.name === DQ_TAG_CLASSIFICATIONS.targetPopulation &&
        (tagNorm === norm || norm.includes(tagNorm))
      );
    });
    if (matched) {
      return {
        isValid: true,
        tagFQN: matched.fullyQualifiedName || matched.name,
        normalizedLabel: matched.displayName || matched.name,
      };
    }
  }

  return { isValid: false };
};

/**
 * Thẩm định Hình thức kiểm tra
 */
export const validateDQMethodValue = (
  raw: string,
  availableTags: Tag[] = []
): { isValid: boolean; tagFQN?: string; normalizedLabel?: string } => {
  if (!raw || !raw.trim()) {
    return { isValid: true };
  }
  const clean = raw.trim();
  const norm = normalizeDQText(clean);

  if (norm.includes('sql') || norm.includes('quy tac ky thuat')) {
    return {
      isValid: true,
      tagFQN: STANDARD_DQ_METHODS.technicalsqlrule.fqn,
      normalizedLabel: STANDARD_DQ_METHODS.technicalsqlrule.label,
    };
  }
  if (norm.includes('profiling') || norm.includes('tu dong')) {
    return {
      isValid: true,
      tagFQN: STANDARD_DQ_METHODS.dataprofiling.fqn,
      normalizedLabel: STANDARD_DQ_METHODS.dataprofiling.label,
    };
  }

  if (availableTags.length > 0) {
    const matched = availableTags.find((t) => {
      const tagNorm = normalizeDQText(t.displayName || t.name);
      return (
        t.classification?.name === DQ_TAG_CLASSIFICATIONS.method &&
        (tagNorm === norm || norm.includes(tagNorm))
      );
    });
    if (matched) {
      return {
        isValid: true,
        tagFQN: matched.fullyQualifiedName || matched.name,
        normalizedLabel: matched.displayName || matched.name,
      };
    }
  }

  return { isValid: false };
};

/**
 * Thẩm định Tần suất kiểm tra
 */
export const validateDQFrequencyValue = (
  raw: string,
  availableTags: Tag[] = []
): { isValid: boolean; tagFQN?: string; normalizedLabel?: string } => {
  if (!raw || !raw.trim()) {
    return { isValid: true };
  }
  const clean = raw.trim();
  const norm = normalizeDQText(clean);

  if (norm.includes('thang/quy') || norm.includes('thang / quy')) {
    return {
      isValid: true,
      tagFQN: STANDARD_DQ_FREQUENCIES.monthlyorquarterly.fqn,
      normalizedLabel: STANDARD_DQ_FREQUENCIES.monthlyorquarterly.label,
    };
  }
  if (norm.includes('quy')) {
    return {
      isValid: true,
      tagFQN: STANDARD_DQ_FREQUENCIES.quarterly.fqn,
      normalizedLabel: STANDARD_DQ_FREQUENCIES.quarterly.label,
    };
  }
  if (norm.includes('thang')) {
    return {
      isValid: true,
      tagFQN: STANDARD_DQ_FREQUENCIES.monthly.fqn,
      normalizedLabel: STANDARD_DQ_FREQUENCIES.monthly.label,
    };
  }
  if (norm.includes('ngay')) {
    return {
      isValid: true,
      tagFQN: STANDARD_DQ_FREQUENCIES.daily.fqn,
      normalizedLabel: STANDARD_DQ_FREQUENCIES.daily.label,
    };
  }

  if (availableTags.length > 0) {
    const matched = availableTags.find((t) => {
      const tagNorm = normalizeDQText(t.displayName || t.name);
      return (
        t.classification?.name === DQ_TAG_CLASSIFICATIONS.frequency &&
        (tagNorm === norm || norm.includes(tagNorm))
      );
    });
    if (matched) {
      return {
        isValid: true,
        tagFQN: matched.fullyQualifiedName || matched.name,
        normalizedLabel: matched.displayName || matched.name,
      };
    }
  }

  return { isValid: false };
};

/**
 * Thẩm định Nguồn dữ liệu
 */
export const validateDQDataSourceValues = (
  raw: string,
  availableTags: Tag[] = []
): { isValid: boolean; matchedTags: TagLabel[]; invalidValues: string[] } => {
  if (!raw || !raw.trim()) {
    return { isValid: true, matchedTags: [], invalidValues: [] };
  }

  const items = raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const matchedTags: TagLabel[] = [];
  const invalidValues: string[] = [];

  for (const item of items) {
    const norm = normalizeDQText(item);
    let matchedFQN: string | undefined;

    // Check standard
    for (const [key, std] of Object.entries(STANDARD_DQ_DATA_SOURCES)) {
      if (norm.includes(key) || norm === normalizeDQText(std.label)) {
        matchedFQN = std.fqn;
        break;
      }
    }

    // Check availableTags
    if (!matchedFQN && availableTags.length > 0) {
      const found = availableTags.find((t) => {
        const tagNorm = normalizeDQText(t.displayName || t.name);
        return (
          t.classification?.name === DQ_TAG_CLASSIFICATIONS.dataSource &&
          (tagNorm === norm || norm.includes(tagNorm))
        );
      });
      if (found) {
        matchedFQN = found.fullyQualifiedName || found.name;
      }
    }

    if (matchedFQN) {
      matchedTags.push({
        tagFQN: matchedFQN,
        labelType: 'Manual',
        state: 'Confirmed',
      } as TagLabel);
    } else {
      invalidValues.push(item);
    }
  }

  return {
    isValid: invalidValues.length === 0,
    matchedTags,
    invalidValues,
  };
};

/**
 * Trích xuất nhãn tag theo classification từ mảng tagLabels
 */
export const getDQTagLabelByClassification = (
  tags: TagLabel[] = [],
  classificationName: string
): string => {
  const match = tags.find((t) => t.tagFQN?.startsWith(`${classificationName}.`));
  if (!match) {
    return '';
  }

  return match.displayName || match.name || match.tagFQN.split('.').at(-1)?.replace(/_/g, ' ') || '';
};

/**
 * Xuất danh sách Quy tắc CLDL ra tệp Excel
 */
export const exportDQToExcel = (
  terms: ModifiedGlossaryTerm[] | GlossaryTerm[] = []
): void => {
  const rows = terms.map((term) => {
    const ext = (term.extension || {}) as DQExtension;
    const tags = term.tags || [];

    const dimension = getDQTagLabelByClassification(tags, DQ_TAG_CLASSIFICATIONS.dimension);
    const targetPopulation = getDQTagLabelByClassification(tags, DQ_TAG_CLASSIFICATIONS.targetPopulation);
    const method = getDQTagLabelByClassification(tags, DQ_TAG_CLASSIFICATIONS.method);
    const frequency = getDQTagLabelByClassification(tags, DQ_TAG_CLASSIFICATIONS.frequency);
    const dataSource = getDQTagLabelByClassification(tags, DQ_TAG_CLASSIFICATIONS.dataSource);

    return [
      term.name || '',
      ext.cdeCode || '',
      ext.cdeName || '',
      dimension,
      term.description || '',
      ext.ruleExplanation || '',
      ext.otherConstraints || '',
      ext.exceptions || '',
      targetPopulation,
      method,
      frequency,
      ext.qualityThreshold || '',
      dataSource,
      getEntityStatusLabel(term.status || EntityStatus.Draft),
    ];
  });

  const wsData = [DQ_EXPORT_HEADERS, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  worksheet['!cols'] = DQ_COLUMN_WIDTHS;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, DQ_EXCEL_SHEET_NAME);

  const fileName = getDQExportFileName();
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Tải file mẫu Excel chuẩn hóa cho Chất lượng dữ liệu
 */
export const downloadDQExcelTemplate = (): void => {
  const sampleRows = [
    [
      'DQ3.1',
      'CDE3',
      'Mã số khách hàng',
      'Tính đầy đủ',
      'Mã số khách hàng (số CIF) không được để trống, không được NULL',
      'Đảm bảo mọi bản ghi khách hàng đều có số định danh CIF hợp lệ',
      'Không được chứa khoảng trắng thừa, độ dài chuẩn',
      'Các tài khoản vãng lai tạm thời chưa cấp CIF',
      'Toàn nền khách hàng',
      'Kiểm tra bằng Quy tắc kỹ thuật (SQL)',
      'Hàng Quý',
      '99%',
      'IPCAS',
    ],
    [
      'DQ3.2',
      'CDE3',
      'Mã số khách hàng',
      'Tính nhất quán',
      'Mã số khách hàng phải được đồng bộ chính xác và đồng nhất trên các hệ thống của Agribank',
      'Đồng nhất mã số giữa IPCAS, Payment Hub, Thẻ',
      '',
      '',
      'Toàn nền khách hàng',
      'Kiểm tra bằng Quy tắc kỹ thuật (SQL)',
      'Hàng Quý',
      '99%',
      'IPCAS',
    ],
  ];

  const wsData = [DQ_TEMPLATE_HEADERS, ...sampleRows];
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  worksheet['!cols'] = DQ_COLUMN_WIDTHS.slice(0, 13);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, DQ_EXCEL_SHEET_NAME);

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', DQ_TEMPLATE_FILE_NAME);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Đọc và thẩm định tệp Excel nạp quy tắc CLDL
 */
export const readAndValidateDQExcel = async (
  file: File,
  existingTerms: GlossaryTerm[] = [],
  availableTags: Tag[] = []
): Promise<DQValidationResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  // Tìm sheet phù hợp
  let sheetName = workbook.SheetNames.find(
    (name) =>
      name.toLowerCase().includes('quy tac') ||
      name.toLowerCase().includes('data quality') ||
      name.toLowerCase().includes('bussiness') ||
      name.toLowerCase().includes('cldl')
  );
  if (!sheetName) {
    sheetName = workbook.SheetNames[0];
  }

  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

  if (rawData.length === 0) {
    return {
      totalRows: 0,
      validCount: 0,
      warningCount: 0,
      errorCount: 0,
      rows: [],
    };
  }

  // Tìm hàng chứa tiêu đề cột (chứa 'Mã quy tắc' hoặc 'Mã CDE' hoặc 'Tiêu chí')
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(rawData.length, 10); r++) {
    const row = rawData[r];
    if (
      Array.isArray(row) &&
      row.some((cell) => {
        const text = normalizeDQText(String(cell || ''));
        return (
          text.includes('ma quy tac') ||
          text.includes('tieu chi') ||
          text.includes('quy tac nghiep vu')
        );
      })
    ) {
      headerRowIndex = r;
      break;
    }
  }

  const headerRow = rawData[headerRowIndex] || [];
  const colIndexMap: Record<string, number> = {};

  headerRow.forEach((colName: any, idx: number) => {
    const norm = normalizeDQText(String(colName || ''));
    if (norm.includes('ma quy tac')) {
      colIndexMap.name = idx;
    } else if (norm.includes('ma cde')) {
      colIndexMap.cdeCode = idx;
    } else if (norm.includes('ten thanh to') || norm.includes('ten cde')) {
      colIndexMap.cdeName = idx;
    } else if (norm.includes('tieu chi danh gia') || norm.includes('tieu chi chat luong') || norm === 'tieu chi') {
      colIndexMap.dimension = idx;
    } else if (norm.includes('quy tac nghiep vu ve') || norm.includes('quy tac nghiep vu') || norm.includes('mo ta')) {
      if (colIndexMap.description === undefined) {
        colIndexMap.description = idx;
      }
    } else if (norm.includes('dien giai')) {
      colIndexMap.ruleExplanation = idx;
    } else if (norm.includes('rang buoc') || norm.includes('yeu cau khac')) {
      colIndexMap.otherConstraints = idx;
    } else if (norm.includes('ngoai le')) {
      colIndexMap.exceptions = idx;
    } else if (norm.includes('tieu chi co so') || norm.includes('tap du lieu')) {
      colIndexMap.targetPopulation = idx;
    } else if (norm.includes('hinh thuc kiem tra') || norm.includes('phuong phap')) {
      colIndexMap.method = idx;
    } else if (norm.includes('tan suat')) {
      colIndexMap.frequency = idx;
    } else if (norm.includes('nguong')) {
      colIndexMap.qualityThreshold = idx;
    } else if (norm.includes('nguon du lieu') || norm === 'nguon') {
      colIndexMap.dataSource = idx;
    }
  });

  const getVal = (row: any[], key: string, fallbackIdx: number): string => {
    const idx = colIndexMap[key] !== undefined ? colIndexMap[key] : fallbackIdx;
    return String(row[idx] ?? '').trim();
  };

  const rows: DQImportRowData[] = [];
  const seenCodes = new Set<string>();

  for (let r = headerRowIndex + 1; r < rawData.length; r++) {
    const rawRow = rawData[r];
    if (!rawRow || rawRow.every((c) => c === undefined || c === null || String(c).trim() === '')) {
      continue;
    }

    const name = getVal(rawRow, 'name', 0);
    const cdeCode = getVal(rawRow, 'cdeCode', 1);
    const cdeName = getVal(rawRow, 'cdeName', 2);
    const dimension = getVal(rawRow, 'dimension', 3);
    const description = getVal(rawRow, 'description', 4);
    const ruleExplanation = getVal(rawRow, 'ruleExplanation', 5);
    const otherConstraints = getVal(rawRow, 'otherConstraints', 6);
    const exceptions = getVal(rawRow, 'exceptions', 7);
    const targetPopulation = getVal(rawRow, 'targetPopulation', 8);
    const method = getVal(rawRow, 'method', 9);
    const frequency = getVal(rawRow, 'frequency', 10);
    const qualityThreshold = getVal(rawRow, 'qualityThreshold', 11);
    const dataSource = getVal(rawRow, 'dataSource', 12);

    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    // 1. Mã quy tắc bắt buộc
    if (!name) {
      rowErrors.push('Thiếu Mã quy tắc nghiệp vụ (bắt buộc).');
    } else {
      const codeKey = name.toUpperCase();
      if (seenCodes.has(codeKey)) {
        rowErrors.push(`Mã quy tắc '${name}' bị trùng lặp với dòng khác trong file Excel.`);
      } else {
        seenCodes.add(codeKey);
      }
    }

    // 2. Thẩm định Tiêu chí CLDL
    if (dimension) {
      const dimRes = validateDQDimensionValue(dimension, availableTags);
      if (!dimRes.isValid) {
        rowErrors.push(
          `Tiêu chí CLDL '${dimension}' không hợp lệ (phải là Tính đầy đủ, Tính chính xác, Tính nhất quán, Tính tuân thủ hoặc Tính kịp thời).`
        );
      }
    } else {
      rowErrors.push('Thiếu Tiêu chí đánh giá Chất lượng Dữ liệu (bắt buộc).');
    }

    // 3. Thẩm định Quy tắc nghiệp vụ
    if (!description) {
      rowWarnings.push('Chưa có nội dung Quy tắc nghiệp vụ về chất lượng dữ liệu.');
    }

    // 4. Thẩm định Tiêu chí cơ sở
    if (targetPopulation) {
      const popRes = validateDQTargetPopulationValue(targetPopulation, availableTags);
      if (!popRes.isValid) {
        rowErrors.push(`Tiêu chí cơ sở '${targetPopulation}' không tồn tại trên hệ thống.`);
      }
    }

    // 5. Thẩm định Hình thức kiểm tra
    if (method) {
      const methRes = validateDQMethodValue(method, availableTags);
      if (!methRes.isValid) {
        rowErrors.push(`Hình thức kiểm tra '${method}' không hợp lệ (phải là SQL hoặc Data Profiling).`);
      }
    }

    // 6. Thẩm định Tần suất
    if (frequency) {
      const freqRes = validateDQFrequencyValue(frequency, availableTags);
      if (!freqRes.isValid) {
        rowErrors.push(`Tần suất '${frequency}' không hợp lệ (phải là Hàng Quý, Tháng/Quý, Hàng Tháng hoặc Hàng Ngày).`);
      }
    }

    // 7. Thẩm định Nguồn dữ liệu
    if (dataSource) {
      const dsRes = validateDQDataSourceValues(dataSource, availableTags);
      if (!dsRes.isValid) {
        rowErrors.push(`Nguồn dữ liệu '${dsRes.invalidValues.join(', ')}' không tồn tại trên hệ thống.`);
      }
    }

    // 8. Kiểm tra bản ghi đã tồn tại trên hệ thống
    const existing = existingTerms.find(
      (term) =>
        term.name.toLowerCase() === name.toLowerCase() ||
        (term.displayName && term.displayName.toLowerCase() === name.toLowerCase())
    );

    const isExisting = Boolean(existing);
    const existingId = existing?.id;

    if (isExisting) {
      rowWarnings.push(`Mã quy tắc '${name}' đã tồn tại trên hệ thống.`);
    }

    rows.push({
      rowNumber: rows.length + 1,
      name,
      cdeCode,
      cdeName,
      dimension,
      description,
      ruleExplanation,
      otherConstraints,
      exceptions,
      targetPopulation,
      method,
      frequency,
      qualityThreshold,
      dataSource,
      status: EntityStatus.Draft,
      isExisting,
      existingId,
      errors: rowErrors,
      warnings: rowWarnings,
      isValid: rowErrors.length === 0,
    });
  }

  const validCount = rows.filter((r) => r.isValid && !r.isExisting).length;
  const warningCount = rows.filter((r) => r.isValid && r.isExisting).length;
  const errorCount = rows.filter((r) => !r.isValid).length;

  return {
    totalRows: rows.length,
    validCount,
    warningCount,
    errorCount,
    rows,
  };
};

/**
 * Chuyển đổi dòng dữ liệu thành CreateGlossaryTerm payload
 */
export const transformDQRowToGlossaryTermPayload = (
  row: DQImportRowData,
  glossaryFQN: string,
  availableTags: Tag[] = [],
  allCdeTerms: GlossaryTerm[] = []
): {
  name: string;
  displayName: string;
  description: string;
  glossary: string;
  tags?: TagLabel[];
  relatedTerms?: EntityReference[];
  extension?: Record<string, unknown>;
} => {
  const tags: TagLabel[] = [];

  // 1. Tag Tiêu chí CLDL (Dimension)
  if (row.dimension) {
    const dimRes = validateDQDimensionValue(row.dimension, availableTags);
    if (dimRes.tagFQN) {
      tags.push({
        tagFQN: dimRes.tagFQN,
        labelType: 'Manual',
        state: 'Confirmed',
      } as TagLabel);
    }
  }

  // 2. Tag Tiêu chí cơ sở (TargetPopulation)
  if (row.targetPopulation) {
    const popRes = validateDQTargetPopulationValue(row.targetPopulation, availableTags);
    if (popRes.tagFQN) {
      tags.push({
        tagFQN: popRes.tagFQN,
        labelType: 'Manual',
        state: 'Confirmed',
      } as TagLabel);
    }
  }

  // 3. Tag Hình thức kiểm tra (Method)
  if (row.method) {
    const methRes = validateDQMethodValue(row.method, availableTags);
    if (methRes.tagFQN) {
      tags.push({
        tagFQN: methRes.tagFQN,
        labelType: 'Manual',
        state: 'Confirmed',
      } as TagLabel);
    }
  }

  // 4. Tag Tần suất (Frequency)
  if (row.frequency) {
    const freqRes = validateDQFrequencyValue(row.frequency, availableTags);
    if (freqRes.tagFQN) {
      tags.push({
        tagFQN: freqRes.tagFQN,
        labelType: 'Manual',
        state: 'Confirmed',
      } as TagLabel);
    }
  }

  // 5. Tag Nguồn dữ liệu (DataSource)
  if (row.dataSource) {
    const dsRes = validateDQDataSourceValues(row.dataSource, availableTags);
    if (dsRes.matchedTags.length > 0) {
      tags.push(...dsRes.matchedTags);
    }
  }

  // 6. Liên kết CDE liên quan (relatedTerms)
  let relatedTerms: EntityReference[] | undefined;
  if (row.cdeCode && allCdeTerms.length > 0) {
    const cleanCode = row.cdeCode.trim().toUpperCase();
    const matchedCde = allCdeTerms.find(
      (cde) =>
        cde.name.toUpperCase() === cleanCode ||
        cde.name.toUpperCase().replace(/\s+/g, '') === cleanCode
    );
    if (matchedCde) {
      relatedTerms = [
        {
          id: matchedCde.id,
          type: 'glossaryTerm',
          fullyQualifiedName: matchedCde.fullyQualifiedName,
          name: matchedCde.name,
          displayName: matchedCde.displayName,
        },
      ];
    }
  }

  // 7. Custom properties (extension)
  const extension: Record<string, unknown> = {
    cdeCode: row.cdeCode || undefined,
    cdeName: row.cdeName || undefined,
    ruleExplanation: row.ruleExplanation || undefined,
    otherConstraints: row.otherConstraints || undefined,
    exceptions: row.exceptions || undefined,
    qualityThreshold: row.qualityThreshold || undefined,
  };

  return {
    name: row.name,
    displayName: row.name,
    description: row.description || '',
    glossary: glossaryFQN,
    tags: tags.length ? tags : undefined,
    relatedTerms,
    extension: isEmpty(extension) ? undefined : extension,
  };
};

/**
 * Bản địa hóa thông báo lỗi từ backend khi nạp quy tắc CLDL
 */
export const formatDQImportErrorMessage = (
  rawError: any,
  t: (key: string, defaultVal?: any, options?: any) => string,
  mode: 'create' | 'update' = 'create'
): string => {
  if (!rawError) {
    return mode === 'update'
      ? t('dq.error-generic-update', 'Lỗi khi cập nhật quy tắc CLDL.')
      : t('dq.error-generic-create', 'Lỗi khi tạo mới quy tắc CLDL.');
  }

  let message = '';
  if (typeof rawError === 'string') {
    message = rawError.trim();
  } else if (rawError?.response?.data?.message) {
    message = String(rawError.response.data.message).trim();
  } else if (rawError?.response?.data?.responseMessage) {
    message = String(rawError.response.data.responseMessage).trim();
  } else if (typeof rawError?.response?.data === 'string') {
    message = rawError.response.data.trim();
  } else if (rawError?.message) {
    message = String(rawError.message).trim();
  }

  if (!message) {
    return mode === 'update'
      ? t('dq.error-generic-update', 'Lỗi khi cập nhật quy tắc CLDL.')
      : t('dq.error-generic-create', 'Lỗi khi tạo mới quy tắc CLDL.');
  }

  // 1. Lỗi thuật ngữ/quy tắc đã tồn tại trong glossary:
  const termAlreadyExistsMatch = message.match(
    /A term with the name ['"]?([^'"]+)['"]? already exists in ['"]?([^'"]+)['"]? glossary/i
  );
  if (termAlreadyExistsMatch) {
    const [, termName, glossaryName] = termAlreadyExistsMatch;
    return t(
      'dq.error-term-already-exists',
      `Mã quy tắc '${termName}' đã tồn tại trong danh mục '${glossaryName}'.`,
      { name: termName, glossary: glossaryName }
    );
  }

  // 2. Lỗi thực thể đã tồn tại với tên:
  const entityNameMatch = message.match(
    /(?:GlossaryTerm|Entity|Term)?\s*with name ['"]?([^'"]+)['"]? already exists/i
  );
  if (entityNameMatch) {
    const [, termName] = entityNameMatch;
    return t(
      'dq.error-term-name-exists',
      `Mã quy tắc '${termName}' đã tồn tại trên hệ thống.`,
      { name: termName }
    );
  }

  // 3. Lỗi đã tồn tại chung:
  if (/already exists/i.test(message)) {
    return t(
      'dq.error-already-exists',
      'Quy tắc CLDL đã tồn tại trên hệ thống.'
    );
  }

  // 4. Phân quyền:
  if (/permission|not allowed|access denied|forbidden|unauthorized|is not admin/i.test(message)) {
    return t(
      'dq.error-permission-denied',
      'Bạn không có quyền thực hiện thao tác này.'
    );
  }

  // 5. Thẻ phân loại xung đột:
  if (/mutually exclusive/i.test(message)) {
    return t(
      'dq.error-mutually-exclusive-tags',
      'Các nhãn phân loại (tags) bị xung đột lẫn nhau.'
    );
  }

  // 6. Không tìm thấy đối tượng:
  if (/instance for|entity.*not found|not found/i.test(message)) {
    return t(
      'dq.error-not-found',
      'Không tìm thấy thông tin bản ghi trên hệ thống.'
    );
  }

  // 7. Lỗi kết nối mạng:
  if (/network error|timeout|connection refused|econnrefused/i.test(message)) {
    return t('dq.error-network', 'Lỗi kết nối tới máy chủ.');
  }

  return message;
};
