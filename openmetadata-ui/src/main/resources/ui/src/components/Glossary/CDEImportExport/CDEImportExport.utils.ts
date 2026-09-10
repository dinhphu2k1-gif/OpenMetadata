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
import { CDE_TAG_CLASSIFICATIONS, CDEExtension } from '../GlossaryTermTab/CDEGlossaryTableColumns';
import { ModifiedGlossaryTerm } from '../GlossaryTermTab/GlossaryTermTab.interface';

export interface CDEImportRowData {
  rowNumber: number;
  name: string;
  displayName: string;
  domain: string;
  dataSource: string;
  description: string;
  entityRelationship: string;
  owner: string;
  dataClassification: string;
  personalData: string;
  relatedRegulatoryDocuments: string;
  dataQualityRules: string;
  cdeVersion: string;
  reviewer: string;
  status: EntityStatus;
  isExisting?: boolean;
  existingId?: string;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

export interface CDEValidationResult {
  totalRows: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  rows: CDEImportRowData[];
}

export const CDE_EXCEL_SHEET_NAME = 'Danh mục CDE';

export const CDE_EXPORT_HEADERS = [
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
  'Trạng thái',
];

export const CDE_TEMPLATE_HEADERS = [
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

export const CDE_COLUMN_WIDTHS = [
  { wch: 18 }, // Mã CDE quy chiếu
  { wch: 30 }, // Tên thành tố CDE
  { wch: 22 }, // Nhóm nghiệp vụ
  { wch: 22 }, // Nguồn dữ liệu
  { wch: 45 }, // Ý nghĩa nghiệp vụ
  { wch: 35 }, // Mối quan hệ với thực thể
  { wch: 25 }, // Chủ sở hữu dữ liệu
  { wch: 20 }, // Phân loại dữ liệu
  { wch: 18 }, // Dữ liệu cá nhân
  { wch: 35 }, // Văn bản quy định liên quan
  { wch: 24 }, // Quy định chất lượng dữ liệu
  { wch: 14 }, // Phiên bản
  { wch: 22 }, // Người kiểm soát
  { wch: 20 }, // Trạng thái
];

/**
 * Sinh tên file Export chuẩn theo quy tắc:
 * Agribank_CDE_Danh_Tu_Dien_Du_Lieu_YYYYMMDD_HHmm.xlsx
 */
export const getCDEExportFileName = (date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `Agribank_CDE_Danh_Tu_Dien_Du_Lieu_${year}${month}${day}_${hours}${minutes}.xlsx`;
};

export const CDE_TEMPLATE_FILE_NAME = 'Agribank_CDE_Mau_Nhap_Lieu.xlsx';

const extractClassificationTagNames = (
  tags: TagLabel[] = [],
  classification: string
): string => {
  return tags
    .filter((tag) => tag.tagFQN?.split('.')[0] === classification)
    .map((tag) => tag.displayName ?? tag.name ?? tag.tagFQN?.split('.').at(-1) ?? '')
    .filter(Boolean)
    .join(', ');
};

const extractPersonalDataTag = (tags: TagLabel[] = []): string => {
  const personalTags = tags.filter(
    (tag) => tag.tagFQN?.split('.')[0] === CDE_TAG_CLASSIFICATIONS.personalData
  );
  if (personalTags.length === 0) {
    return 'Không';
  }

  const isYes = personalTags.some(
    (t) =>
      ['CO', 'CÓ', 'YES', 'TRUE', '1'].includes(
        (t.name || t.tagFQN.split('.').at(-1) || '').toUpperCase()
      )
  );

  return isYes ? 'Có' : 'Không';
};

const formatReferences = (refs: EntityReference[] = []): string => {
  return refs
    .map((r) => getEntityName(r) || r.displayName || r.name || '')
    .filter(Boolean)
    .join(', ');
};

const formatQualityRules = (
  rules: boolean | string | string[] | undefined
): string => {
  if (rules === undefined || rules === null || rules === '') {
    return 'Không';
  }
  const raw = Array.isArray(rules) ? rules[0] : rules;
  const str = String(raw).trim().toUpperCase();

  return ['1', 'TRUE', 'Y', 'YES', 'CO', 'CÓ'].includes(str) ? 'Có' : 'Không';
};

export const stripHtmlTags = (str: string): string => {
  return String(str ?? '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
};

/**
 * Xuất danh sách CDE sang file Excel (.xlsx)
 */
export const exportCDEToExcel = (
  terms: (ModifiedGlossaryTerm | GlossaryTerm)[],
  customFileName?: string
) => {
  const fileName = customFileName ?? getCDEExportFileName();

  const dataRows = terms
    .filter((term) => !('isLoadMoreButton' in term && term.isLoadMoreButton))
    .map((term) => {
      const ext = (term.extension ?? {}) as CDEExtension;
      const entityRel = ext.entityRelationship ?? ext.moi_quan_he_voi_thuc_the ?? '';
      const regDocs = ext.relatedRegulatoryDocuments ?? ext.van_ban_quy_dinh_lien_quan ?? '';
      const dqRules = formatQualityRules(ext.dataQualityRules ?? ext.quy_dinh_chat_luong_du_lieu);
      const version = ext.cdeVersion ?? ext.phien_ban ?? '1.0';
      const statusLabel = getEntityStatusLabel(term.entityStatus ?? EntityStatus.Approved);

      return [
        term.name ?? '',
        term.displayName ?? '',
        formatReferences(term.domains),
        extractClassificationTagNames(term.tags, CDE_TAG_CLASSIFICATIONS.dataSource),
        stripHtmlTags(term.description ?? ''),
        stripHtmlTags(entityRel),
        formatReferences(term.owners),
        extractClassificationTagNames(term.tags, CDE_TAG_CLASSIFICATIONS.dataClassification),
        extractPersonalDataTag(term.tags),
        regDocs,
        dqRules,
        version,
        formatReferences(term.reviewers),
        statusLabel,
      ];
    });

  const worksheetData = [CDE_EXPORT_HEADERS, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  worksheet['!cols'] = CDE_COLUMN_WIDTHS;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, CDE_EXCEL_SHEET_NAME);

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
 * Sinh và tải file Excel mẫu CDE (.xlsx)
 */
export const downloadCDEExcelTemplate = () => {
  const sampleRows = [
    [
      'CDE001',
      'Mã số khách hàng (CIF)',
      'Khách hàng',
      'IPCAS, SRC30',
      'Mã định danh duy nhất của khách hàng trên toàn hệ thống Agribank.',
      'Thuộc thực thể Thông tin định danh khách hàng',
      'Ban Kế toán',
      'Nội bộ',
      'Có',
      'Quyết định số 123/QĐ-NHNo',
      'Có',
      '1.0',
      'steward_user',
    ],
    [
      'CDE002',
      'Số dư tài khoản thanh toán',
      'Tiền gửi',
      'IPCAS',
      'Số dư khả dụng thực tế tại thời điểm truy vấn của tài khoản thanh toán.',
      'Thuộc thực thể Tài khoản thanh toán',
      'Ban Khách hàng',
      'Bảo mật',
      'Không',
      'Thông tư 23/2014/TT-NHNN',
      'Có',
      '1.0',
      'steward_user',
    ],
  ];

  const worksheetData = [CDE_TEMPLATE_HEADERS, ...sampleRows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet['!cols'] = CDE_COLUMN_WIDTHS.slice(0, CDE_TEMPLATE_HEADERS.length);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, CDE_EXCEL_SHEET_NAME);

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', CDE_TEMPLATE_FILE_NAME);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const normalizeHeader = (header: unknown): string => {
  return String(header ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
};

const HEADER_KEY_MAPPING: Record<string, string> = {
  macdequychieu: 'name',
  macde: 'name',
  code: 'name',
  name: 'name',
  tenthanhtocde: 'displayName',
  tenthanhto: 'displayName',
  displayname: 'displayName',
  tennghiepvu: 'displayName',
  nhomnghiepvu: 'domain',
  miendulieu: 'domain',
  domain: 'domain',
  domains: 'domain',
  nguondulieu: 'dataSource',
  datasource: 'dataSource',
  datasources: 'dataSource',
  hethongnguon: 'dataSource',
  ynghianghiepvu: 'description',
  dinhnghia: 'description',
  description: 'description',
  mota: 'description',
  moiquanhevoithucthe: 'entityRelationship',
  moiquanhethucthe: 'entityRelationship',
  entityrelationship: 'entityRelationship',
  chusohuudulieu: 'owner',
  chusohudulieu: 'owner',
  chusohuu: 'owner',
  chusohu: 'owner',
  owner: 'owner',
  owners: 'owner',
  phanloaidulieu: 'dataClassification',
  dataclassification: 'dataClassification',
  dulieucanhan: 'personalData',
  personaldata: 'personalData',
  vanbanquydinhlienquan: 'relatedRegulatoryDocuments',
  vanbanquydinh: 'relatedRegulatoryDocuments',
  relatedregulatorydocuments: 'relatedRegulatoryDocuments',
  quydinhchatluongdulieu: 'dataQualityRules',
  chatluongdulieu: 'dataQualityRules',
  dataqualityrules: 'dataQualityRules',
  cldl: 'dataQualityRules',
  phienban: 'cdeVersion',
  version: 'cdeVersion',
  cdeversion: 'cdeVersion',
  nguoikiemsoat: 'reviewer',
  nguoipheduyet: 'reviewer',
  reviewer: 'reviewer',
  reviewers: 'reviewer',
  steward: 'reviewer',
};

export const KNOWN_CDE_TAG_MAP: Record<string, string> = {
  // DataSource
  the: 'DataSource.Card',
  thẻ: 'DataSource.Card',
  card: 'DataSource.Card',
  ipcas: 'DataSource.IPCAS',
  src30: 'DataSource.SRC30',
  src_30: 'DataSource.SRC30',
  'ftp mis': 'DataSource.FTP_MIS',
  ftp_mis: 'DataSource.FTP_MIS',
  'he thong mcc': 'DataSource.MCC_System',
  'hệ thống mcc': 'DataSource.MCC_System',
  mcc_system: 'DataSource.MCC_System',
  mis: 'DataSource.MIS',
  'payment hub': 'DataSource.PaymentHub',
  paymenthub: 'DataSource.PaymentHub',
  'kho rrtd': 'DataSource.CreditRiskDataWarehouse',
  'kho dữ liệu rrtd': 'DataSource.RRTD_DataWarehouse',
  'theo doi thu cong': 'DataSource.ManualTracking',
  'theo dõi thủ công': 'DataSource.ManualTracking',
  'phan loai khach hang - mis': 'DataSource.CustomerClassification_MIS',
  'phân loại khách hàng - mis': 'DataSource.CustomerClassification_MIS',

  // DataClassification
  'noi bo': 'DataClassification.Internal',
  'nội bộ': 'DataClassification.Internal',
  noibo: 'DataClassification.Internal',
  internal: 'DataClassification.Internal',
  'bi mat': 'DataClassification.Confidential',
  'bí mật': 'DataClassification.Confidential',
  confidential: 'DataClassification.Confidential',
  'bao mat': 'DataClassification.Confidential',
  'bảo mật': 'DataClassification.Confidential',
  baomat: 'DataClassification.Confidential',
  'cong cong': 'DataClassification.Public',
  'công cộng': 'DataClassification.Public',
  public: 'DataClassification.Public',
  'toi mat': 'DataClassification.Restricted',
  'tối mật': 'DataClassification.Restricted',
  toimat: 'DataClassification.Restricted',
  restricted: 'DataClassification.Restricted',

  // PersonalData
  co: 'PersonalData.Personal',
  có: 'PersonalData.Personal',
  yes: 'PersonalData.Personal',
  'co ban': 'PersonalData.Basic',
  'cơ bản': 'PersonalData.Basic',
  basic: 'PersonalData.Basic',
  'nhay cam': 'PersonalData.Sensitive',
  'nhạy cảm': 'PersonalData.Sensitive',
  sensitive: 'PersonalData.Sensitive',
  personal: 'PersonalData.Personal',
  specialcategory: 'PersonalData.SpecialCategory',
};

export const KNOWN_CDE_DOMAIN_MAP: Record<string, string> = {
  'dich vu': 'Dich_vu',
  'dịch vụ': 'Dich_vu',
  dich_vu: 'Dich_vu',
  'khach hang': 'Khach_hang',
  'khách hàng': 'Khach_hang',
  khach_hang: 'Khach_hang',
  'kinh doanh von va tien te': 'Kinh_doanh_von_va_tien_te',
  'kinh doanh vốn và tiền tệ': 'Kinh_doanh_von_va_tien_te',
  'nguon von': 'Nguon_von',
  'nguồn vốn': 'Nguon_von',
  nguon_von: 'Nguon_von',
  'rui ro': 'Rui_ro',
  'rủi ro': 'Rui_ro',
  rui_ro: 'Rui_ro',
  'thanh toan': 'Thanh_toan',
  'thanh toán': 'Thanh_toan',
  thanh_toan: 'Thanh_toan',
  the: 'The',
  thẻ: 'The',
  'tai chinh': 'Tai_chinh',
  'tài chính': 'Tai_chinh',
  tai_chinh: 'Tai_chinh',
  'tai tro thuong mai': 'Tai_tro_thuong_mai',
  'tài trợ thương mại': 'Tai_tro_thuong_mai',
  tai_tro_thuong_mai: 'Tai_tro_thuong_mai',
  'tin dung': 'Tin_dung',
  'tín dụng': 'Tin_dung',
  tin_dung: 'Tin_dung',
};

export const resolveCDETagFQN = (
  rawInput: string,
  classification: string,
  availableTags: Tag[] = []
): string | undefined => {
  const clean = rawInput.trim();
  if (!clean) {
    return undefined;
  }
  const cleanLower = clean.toLowerCase();

  // 1. Check against dynamically available tags
  const matchedDynamic = availableTags.find(
    (t) =>
      t.fullyQualifiedName?.toLowerCase() === cleanLower ||
      t.name?.toLowerCase() === cleanLower ||
      t.displayName?.toLowerCase() === cleanLower ||
      t.fullyQualifiedName?.toLowerCase() ===
        `${classification.toLowerCase()}.${cleanLower}`
  );
  if (matchedDynamic?.fullyQualifiedName) {
    return matchedDynamic.fullyQualifiedName;
  }

  // 2. Check against known map
  if (KNOWN_CDE_TAG_MAP[cleanLower]) {
    return KNOWN_CDE_TAG_MAP[cleanLower];
  }

  // 3. Fallback: only if it already has classification prefix or valid name
  if (clean.includes('.')) {
    return clean;
  }

  // 4. Default fallback: construct tag under classification prefix
  return `${classification}.${clean.replace(/\s+/g, '_')}`;
};

/**
 * Tìm kiếm Domain phù hợp từ danh sách Domains có sẵn trên hệ thống.
 * Hỗ trợ khớp theo name, displayName, fullyQualifiedName (không phân biệt hoa thường)
 * hoặc qua bản đồ từ khóa thông dụng KNOWN_CDE_DOMAIN_MAP.
 */
export const findMatchingDomain = (
  rawInput: string,
  availableDomains: EntityReference[] = []
): EntityReference | undefined => {
  const clean = rawInput.trim();
  if (!clean || availableDomains.length === 0) {
    return undefined;
  }
  const cleanLower = clean.toLowerCase();

  // 1. Khớp trực tiếp với FQN, name hoặc displayName
  const matched = availableDomains.find(
    (d) =>
      d.fullyQualifiedName?.toLowerCase() === cleanLower ||
      d.name?.toLowerCase() === cleanLower ||
      d.displayName?.toLowerCase() === cleanLower
  );
  if (matched) {
    return matched;
  }

  // 2. Khớp qua KNOWN_CDE_DOMAIN_MAP
  const mappedFqn = KNOWN_CDE_DOMAIN_MAP[cleanLower];
  if (mappedFqn) {
    const matchedMapped = availableDomains.find(
      (d) =>
        d.fullyQualifiedName?.toLowerCase() === mappedFqn.toLowerCase() ||
        d.name?.toLowerCase() === mappedFqn.toLowerCase()
    );
    if (matchedMapped) {
      return matchedMapped;
    }
  }

  return undefined;
};

export const resolveCDEDomainFQN = (
  rawInput: string,
  availableDomains: EntityReference[] = []
): string | undefined => {
  const clean = rawInput.trim();
  if (!clean) {
    return undefined;
  }

  const matched = findMatchingDomain(clean, availableDomains);
  if (matched?.fullyQualifiedName) {
    return matched.fullyQualifiedName;
  }

  const cleanLower = clean.toLowerCase();
  // Fallback map tĩnh khi không có availableDomains
  if (KNOWN_CDE_DOMAIN_MAP[cleanLower]) {
    return KNOWN_CDE_DOMAIN_MAP[cleanLower];
  }

  return undefined;
};

/**
 * Thẩm định danh sách nguồn dữ liệu (DataSource)
 */
export const validateDataSourceValues = (
  rawInput: string,
  availableTags: Tag[] = []
): { isValid: boolean; invalidSources: string[]; resolvedFQNs: string[] } => {
  const clean = rawInput.trim();
  if (!clean) {
    return { isValid: true, invalidSources: [], resolvedFQNs: [] };
  }

  const items = clean.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  const invalidSources: string[] = [];
  const resolvedFQNs: string[] = [];

  for (const item of items) {
    const itemLower = item.toLowerCase();

    // 1. Kiểm tra trong availableTags
    const matchedTag = availableTags.find((t) => {
      const fqn = (t.fullyQualifiedName || '').toLowerCase();
      const isDs =
        fqn.startsWith('datasource.') ||
        t.classification?.name?.toLowerCase() === 'datasource';

      return (
        isDs &&
        (fqn === itemLower ||
          fqn === `datasource.${itemLower}` ||
          (t.name || '').toLowerCase() === itemLower ||
          (t.displayName || '').toLowerCase() === itemLower)
      );
    });

    if (matchedTag?.fullyQualifiedName) {
      resolvedFQNs.push(matchedTag.fullyQualifiedName);
      continue;
    }

    // 2. Kiểm tra trong KNOWN_CDE_TAG_MAP
    if (KNOWN_CDE_TAG_MAP[itemLower]?.startsWith('DataSource.')) {
      resolvedFQNs.push(KNOWN_CDE_TAG_MAP[itemLower]);
      continue;
    }

    // 3. Nếu người dùng nhập trực tiếp FQN dạng DataSource.xxx
    if (itemLower.startsWith('datasource.')) {
      resolvedFQNs.push(item);
      continue;
    }

    invalidSources.push(item);
  }

  return {
    isValid: invalidSources.length === 0,
    invalidSources,
    resolvedFQNs,
  };
};

/**
 * Thẩm định giá trị phân loại dữ liệu (DataClassification)
 */
export const validateDataClassificationValue = (
  rawInput: string,
  availableTags: Tag[] = []
): { isValid: boolean; invalidValues: string[] } => {
  const clean = rawInput.trim();
  if (!clean) {
    return { isValid: true, invalidValues: [] };
  }

  const items = clean.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  const invalidValues: string[] = [];

  const allowedBaseKeys = new Set([
    'cong cong',
    'công cộng',
    'public',
    'noi bo',
    'nội bộ',
    'noibo',
    'internal',
    'bi mat',
    'bí mật',
    'bimat',
    'bao mat',
    'bảo mật',
    'baomat',
    'confidential',
    'toi mat',
    'tối mật',
    'toimat',
    'restricted',
    'top secret',
  ]);

  for (const item of items) {
    const itemLower = item.toLowerCase();

    // 1. Khớp các giá trị chuẩn base
    if (allowedBaseKeys.has(itemLower)) {
      continue;
    }

    // 2. Khớp trong KNOWN_CDE_TAG_MAP
    if (KNOWN_CDE_TAG_MAP[itemLower]?.startsWith('DataClassification.')) {
      continue;
    }

    // 3. Khớp trong availableTags
    const matchedTag = availableTags.find((t) => {
      const fqn = (t.fullyQualifiedName || '').toLowerCase();
      const isDc =
        fqn.startsWith('dataclassification.') ||
        t.classification?.name?.toLowerCase() === 'dataclassification';

      return (
        isDc &&
        (fqn === itemLower ||
          fqn === `dataclassification.${itemLower}` ||
          (t.name || '').toLowerCase() === itemLower ||
          (t.displayName || '').toLowerCase() === itemLower)
      );
    });

    if (matchedTag) {
      continue;
    }

    // 4. Nếu có tiền tố DataClassification.
    if (itemLower.startsWith('dataclassification.')) {
      continue;
    }

    invalidValues.push(item);
  }

  return {
    isValid: invalidValues.length === 0,
    invalidValues,
  };
};

/**
 * Thẩm định giá trị Dữ liệu cá nhân (PersonalData)
 */
export const validatePersonalDataValue = (
  rawInput: string,
  availableTags: Tag[] = []
): { isValid: boolean; invalidValue?: string } => {
  const clean = rawInput.trim();
  if (!clean) {
    return { isValid: true };
  }

  const cleanLower = clean.toLowerCase();
  const allowedBaseKeys = new Set([
    'khong',
    'không',
    'no',
    'false',
    '0',
    'k',
    'n',
    'co',
    'có',
    'yes',
    'true',
    '1',
    'y',
    'co ban',
    'cơ bản',
    'basic',
    'nhay cam',
    'nhạy cảm',
    'sensitive',
    'personal',
    'specialcategory',
  ]);

  if (allowedBaseKeys.has(cleanLower)) {
    return { isValid: true };
  }

  if (KNOWN_CDE_TAG_MAP[cleanLower]?.startsWith('PersonalData.')) {
    return { isValid: true };
  }

  if (cleanLower.startsWith('personaldata.')) {
    return { isValid: true };
  }

  const matchedTag = availableTags.find((t) => {
    const fqn = (t.fullyQualifiedName || '').toLowerCase();
    const isPd =
      fqn.startsWith('personaldata.') ||
      t.classification?.name?.toLowerCase() === 'personaldata';

    return (
      isPd &&
      (fqn === cleanLower ||
        fqn === `personaldata.${cleanLower}` ||
        (t.name || '').toLowerCase() === cleanLower ||
        (t.displayName || '').toLowerCase() === cleanLower)
    );
  });

  if (matchedTag) {
    return { isValid: true };
  }

  return { isValid: false, invalidValue: clean };
};

/**
 * Tìm người dùng (User) hoặc Đội ngũ (Team) phù hợp từ danh sách có sẵn
 */
export const findMatchingUserOrTeam = (
  rawInput: string,
  availableUsers: EntityReference[] = [],
  availableTeams: EntityReference[] = []
): EntityReference | undefined => {
  const clean = rawInput.trim();
  if (!clean) {
    return undefined;
  }
  const cleanLower = clean.toLowerCase();

  // 1. Tìm trong người dùng (Users)
  const matchedUser = availableUsers.find((u) => {
    return (
      (u.name && u.name.toLowerCase() === cleanLower) ||
      (u.displayName && u.displayName.toLowerCase() === cleanLower) ||
      (u.fullyQualifiedName && u.fullyQualifiedName.toLowerCase() === cleanLower) ||
      ((u as any).email && (u as any).email.toLowerCase() === cleanLower)
    );
  });
  if (matchedUser) {
    return {
      id: matchedUser.id,
      type: 'user',
      name: matchedUser.name,
      displayName: matchedUser.displayName,
      fullyQualifiedName: matchedUser.fullyQualifiedName,
    };
  }

  // 2. Tìm trong Đội ngũ (Teams)
  const matchedTeam = availableTeams.find((t) => {
    return (
      (t.name && t.name.toLowerCase() === cleanLower) ||
      (t.displayName && t.displayName.toLowerCase() === cleanLower) ||
      (t.fullyQualifiedName && t.fullyQualifiedName.toLowerCase() === cleanLower)
    );
  });
  if (matchedTeam) {
    return {
      id: matchedTeam.id,
      type: 'team',
      name: matchedTeam.name,
      displayName: matchedTeam.displayName,
      fullyQualifiedName: matchedTeam.fullyQualifiedName,
    };
  }

  return undefined;
};

/**
 * Thẩm định danh sách Người dùng hoặc Đội ngũ (Owner / Reviewer)
 */
export const validateUserOrTeamList = (
  rawInput: string,
  availableUsers: EntityReference[] = [],
  availableTeams: EntityReference[] = []
): { isValid: boolean; invalidNames: string[]; matchedRefs: EntityReference[] } => {
  const clean = rawInput.trim();
  if (!clean) {
    return { isValid: true, invalidNames: [], matchedRefs: [] };
  }

  // Nếu cả hai danh sách đều trống (chưa nạp hoặc môi trường thử nghiệm), không bắt lỗi
  if (availableUsers.length === 0 && availableTeams.length === 0) {
    return { isValid: true, invalidNames: [], matchedRefs: [] };
  }

  const items = clean.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  const invalidNames: string[] = [];
  const matchedRefs: EntityReference[] = [];

  for (const item of items) {
    const matched = findMatchingUserOrTeam(item, availableUsers, availableTeams);
    if (matched) {
      matchedRefs.push(matched);
    } else {
      invalidNames.push(item);
    }
  }

  return {
    isValid: invalidNames.length === 0,
    invalidNames,
    matchedRefs,
  };
};

/**
 * Thẩm định Quy định chất lượng dữ liệu (DataQualityRules)
 */
export const validateDataQualityRulesValue = (
  rawInput: string
): { isValid: boolean } => {
  const clean = rawInput.trim();
  if (!clean) {
    return { isValid: true };
  }
  const cleanUpper = clean.toUpperCase();
  const allowed = [
    'CO',
    'CÓ',
    'YES',
    'Y',
    'TRUE',
    '1',
    'KHONG',
    'KHÔNG',
    'NO',
    'N',
    'FALSE',
    '0',
  ];

  return {
    isValid: allowed.includes(cleanUpper),
  };
};

/**
 * Thẩm định Định dạng phiên bản CDE (CDEVersion)
 */
export const validateCDEVersionValue = (
  rawInput: string
): { isValid: boolean } => {
  const clean = rawInput.trim();
  if (!clean) {
    return { isValid: true };
  }
  const versionRegex = /^v?\d+(\.\d+)*$/i;

  return {
    isValid: versionRegex.test(clean),
  };
};

/**
 * Đọc và thẩm định (Validate) file Excel CDE
 */
export const readAndValidateCDEExcel = async (
  file: File,
  existingTerms: (ModifiedGlossaryTerm | GlossaryTerm)[] = [],
  availableDomains: EntityReference[] = [],
  availableTags: Tag[] = [],
  availableUsers: EntityReference[] = [],
  availableTeams: EntityReference[] = []
): Promise<CDEValidationResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Excel không có sheet dữ liệu nào.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    header: 1,
    defval: '',
  }) as unknown as string[][];

  if (rawRows.length < 2) {
    throw new Error(
      'File Excel không có dòng dữ liệu hợp lệ (tối thiểu 1 dòng tiêu đề và 1 dòng dữ liệu).'
    );
  }

  const headerRow = rawRows[0].map(String);
  const columnKeys: (string | null)[] = headerRow.map((h) => {
    const norm = normalizeHeader(h);

    return HEADER_KEY_MAPPING[norm] ?? null;
  });

  const existingMap = new Map<string, GlossaryTerm | ModifiedGlossaryTerm>();
  existingTerms.forEach((term) => {
    if (term.name) {
      existingMap.set(term.name.trim().toLowerCase(), term);
    }
  });

  const seenNamesInFile = new Set<string>();
  const parsedRows: CDEImportRowData[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.every((cell) => String(cell ?? '').trim() === '')) {
      continue; // Bỏ qua dòng trống hoàn toàn
    }

    const rowData: Record<string, string> = {
      name: '',
      displayName: '',
      domain: '',
      dataSource: '',
      description: '',
      entityRelationship: '',
      owner: '',
      dataClassification: '',
      personalData: '',
      relatedRegulatoryDocuments: '',
      dataQualityRules: '',
      cdeVersion: '1.0',
      reviewer: '',
    };

    columnKeys.forEach((key, colIdx) => {
      if (key && colIdx < row.length) {
        let val = String(row[colIdx] ?? '').trim();
        if (['description', 'entityRelationship'].includes(key)) {
          val = stripHtmlTags(val);
        }
        rowData[key] = val;
      }
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Thẩm định Mã CDE
    if (!rowData.name) {
      errors.push('Thiếu Mã CDE quy chiếu (bắt buộc).');
    } else {
      const lowerName = rowData.name.toLowerCase();
      if (seenNamesInFile.has(lowerName)) {
        errors.push(
          `Mã CDE '${rowData.name}' bị trùng lặp với dòng khác trong file.`
        );
      } else {
        seenNamesInFile.add(lowerName);
      }

      if (/[^a-zA-Z0-9_\-.]/.test(rowData.name)) {
        warnings.push(
          'Mã CDE chứa ký tự đặc biệt, nên dùng chữ không dấu và dấu gạch dưới.'
        );
      }
    }

    // 2. Thẩm định Tên thành tố
    if (!rowData.displayName) {
      if (rowData.name) {
        rowData.displayName = rowData.name;
        warnings.push(
          'Thiếu Tên thành tố, hệ thống tạm thời lấy Mã CDE làm tên hiển thị.'
        );
      } else {
        errors.push('Thiếu Tên thành tố CDE.');
      }
    }

    // 3. Thẩm định Nhóm nghiệp vụ (Domain)
    if (!rowData.domain) {
      warnings.push('Chưa gán Nhóm nghiệp vụ (Domain).');
    } else if (availableDomains.length > 0) {
      const isDomainValid = Boolean(
        findMatchingDomain(rowData.domain, availableDomains)
      );
      if (!isDomainValid) {
        errors.push(`Miền '${rowData.domain}' không tồn tại trên hệ thống.`);
      }
    }

    // 4. Thẩm định Nguồn dữ liệu (DataSource)
    if (rowData.dataSource) {
      const dsRes = validateDataSourceValues(rowData.dataSource, availableTags);
      if (!dsRes.isValid) {
        errors.push(
          `Nguồn dữ liệu '${dsRes.invalidSources.join(', ')}' không tồn tại trên hệ thống.`
        );
      }
    }

    // 5. Thẩm định Phân loại dữ liệu (DataClassification)
    if (rowData.dataClassification) {
      const dcRes = validateDataClassificationValue(
        rowData.dataClassification,
        availableTags
      );
      if (!dcRes.isValid) {
        errors.push(
          `Phân loại dữ liệu '${dcRes.invalidValues.join(', ')}' không hợp lệ (hợp lệ: Công cộng, Nội bộ, Bí mật, Tối mật).`
        );
      }
    }

    // 6. Thẩm định Dữ liệu cá nhân (PersonalData)
    if (rowData.personalData) {
      const pdRes = validatePersonalDataValue(
        rowData.personalData,
        availableTags
      );
      if (!pdRes.isValid) {
        errors.push(
          `Dữ liệu cá nhân '${pdRes.invalidValue || rowData.personalData}' không hợp lệ (hợp lệ: Có, Không, Cơ bản, Nhạy cảm).`
        );
      }
    }

    // 7. Thẩm định Chủ sở hữu dữ liệu (Owner)
    if (
      rowData.owner &&
      (availableUsers.length > 0 || availableTeams.length > 0)
    ) {
      const ownerRes = validateUserOrTeamList(
        rowData.owner,
        availableUsers,
        availableTeams
      );
      if (!ownerRes.isValid) {
        errors.push(
          `Chủ sở hữu '${ownerRes.invalidNames.join(', ')}' không tồn tại trên hệ thống (Người dùng hoặc Nhóm).`
        );
      }
    }

    // 8. Thẩm định Người kiểm soát (Reviewer)
    if (
      rowData.reviewer &&
      (availableUsers.length > 0 || availableTeams.length > 0)
    ) {
      const revRes = validateUserOrTeamList(
        rowData.reviewer,
        availableUsers,
        availableTeams
      );
      if (!revRes.isValid) {
        errors.push(
          `Người kiểm soát '${revRes.invalidNames.join(', ')}' không tồn tại trên hệ thống (Người dùng hoặc Nhóm).`
        );
      }
    }

    // 9. Thẩm định Quy định chất lượng dữ liệu
    if (rowData.dataQualityRules) {
      const dqRes = validateDataQualityRulesValue(rowData.dataQualityRules);
      if (!dqRes.isValid) {
        errors.push(
          `Quy định chất lượng dữ liệu '${rowData.dataQualityRules}' phải là 'Có' hoặc 'Không'.`
        );
      }
    }

    // 10. Thẩm định Phiên bản CDE
    if (rowData.cdeVersion) {
      const verRes = validateCDEVersionValue(rowData.cdeVersion);
      if (!verRes.isValid) {
        errors.push(
          `Phiên bản '${rowData.cdeVersion}' không đúng định dạng (ví dụ: 1.0, 2.0).`
        );
      }
    }

    // 11. Thẩm định Định nghĩa
    if (!rowData.description) {
      warnings.push('Chưa có Ý nghĩa nghiệp vụ / Định nghĩa chi tiết.');
    }

    const existingTerm = existingMap.get(rowData.name.toLowerCase());
    const isExisting = Boolean(existingTerm);

    parsedRows.push({
      rowNumber: i + 1,
      name: rowData.name,
      displayName: rowData.displayName,
      domain: rowData.domain,
      dataSource: rowData.dataSource,
      description: rowData.description,
      entityRelationship: rowData.entityRelationship,
      owner: rowData.owner,
      dataClassification: rowData.dataClassification,
      personalData: rowData.personalData,
      relatedRegulatoryDocuments: rowData.relatedRegulatoryDocuments,
      dataQualityRules: rowData.dataQualityRules,
      cdeVersion: rowData.cdeVersion || '1.0',
      reviewer: rowData.reviewer,
      status: EntityStatus.Draft, // Cố định trạng thái khi import là Draft theo quy định
      isExisting,
      existingId: existingTerm?.id,
      errors,
      warnings,
      isValid: errors.length === 0,
    });
  }

  const validCount = parsedRows.filter(
    (r) => r.isValid && r.warnings.length === 0
  ).length;
  const warningCount = parsedRows.filter(
    (r) => r.isValid && r.warnings.length > 0
  ).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;

  return {
    totalRows: parsedRows.length,
    validCount,
    warningCount,
    errorCount,
    rows: parsedRows,
  };
};

/**
 * Chuyển đổi dữ liệu CDE dòng Excel sang payload API CreateGlossaryTerm
 */
export const transformRowToGlossaryTermPayload = (
  row: CDEImportRowData,
  glossaryFQN: string,
  availableDomains: EntityReference[] = [],
  availableTags: Tag[] = [],
  availableUsers: EntityReference[] = [],
  availableTeams: EntityReference[] = []
) => {
  const tags: TagLabel[] = [];

  // Nguồn dữ liệu (DataSource)
  if (row.dataSource) {
    const sources = row.dataSource
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    sources.forEach((src) => {
      const fqn = resolveCDETagFQN(
        src,
        CDE_TAG_CLASSIFICATIONS.dataSource,
        availableTags
      );
      if (fqn) {
        tags.push({
          tagFQN: fqn,
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        } as TagLabel);
      }
    });
  }

  // Phân loại dữ liệu (DataClassification)
  if (row.dataClassification) {
    const classifications = row.dataClassification
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    classifications.forEach((cls) => {
      const fqn = resolveCDETagFQN(
        cls,
        CDE_TAG_CLASSIFICATIONS.dataClassification,
        availableTags
      );
      if (fqn) {
        tags.push({
          tagFQN: fqn,
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        } as TagLabel);
      }
    });
  }

  // Dữ liệu cá nhân (PersonalData)
  if (row.personalData) {
    const cleanPd = row.personalData.trim().toUpperCase();
    const isNo = ['KHONG', 'KHÔNG', 'NO', 'FALSE', '0'].includes(cleanPd);
    if (!isNo) {
      const fqn = resolveCDETagFQN(
        row.personalData,
        CDE_TAG_CLASSIFICATIONS.personalData,
        availableTags
      );
      if (fqn) {
        tags.push({
          tagFQN: fqn,
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        } as TagLabel);
      }
    }
  }

  // Nhóm nghiệp vụ (Domain)
  let domains: string[] | undefined;
  if (row.domain) {
    const domainFQN = resolveCDEDomainFQN(row.domain, availableDomains);
    if (domainFQN) {
      domains = [domainFQN];
    }
  }

  // Chủ sở hữu (Owners)
  let owners: EntityReference[] | undefined;
  if (row.owner && (availableUsers.length > 0 || availableTeams.length > 0)) {
    const ownerRes = validateUserOrTeamList(
      row.owner,
      availableUsers,
      availableTeams
    );
    if (ownerRes.matchedRefs.length > 0) {
      owners = ownerRes.matchedRefs;
    }
  }

  // Người kiểm soát (Reviewers)
  let reviewers: EntityReference[] | undefined;
  if (row.reviewer && (availableUsers.length > 0 || availableTeams.length > 0)) {
    const revRes = validateUserOrTeamList(
      row.reviewer,
      availableUsers,
      availableTeams
    );
    if (revRes.matchedRefs.length > 0) {
      reviewers = revRes.matchedRefs;
    }
  }

  // Extension CDE
  const isDqYes = ['CO', 'CÓ', 'YES', 'TRUE', '1'].includes(
    row.dataQualityRules.trim().toUpperCase()
  );
  const extension: Record<string, unknown> = {
    cdeVersion: row.cdeVersion || '1.0',
    ...(row.entityRelationship ? { entityRelationship: row.entityRelationship } : {}),
    ...(row.relatedRegulatoryDocuments
      ? { relatedRegulatoryDocuments: row.relatedRegulatoryDocuments }
      : {}),
    ...(row.dataQualityRules ? { dataQualityRules: isDqYes ? ['Y'] : ['N'] } : {}),
  };

  return {
    name: row.name,
    displayName: row.displayName,
    description: row.description || '',
    glossary: glossaryFQN,
    domains,
    owners,
    reviewers,
    tags: tags.length ? tags : undefined,
    extension: isEmpty(extension) ? undefined : extension,
    // Không gửi entityStatus ở đây vì CreateGlossaryTerm schema của backend
    // quy định additionalProperties: false. Trạng thái Draft được gán qua patchGlossaryTerm sau khi tạo.
  };
};

/**
 * Chuyển đổi và bản địa hóa thông báo lỗi từ backend/hệ thống sang ngôn ngữ đang chọn của giao diện.
 */
export const formatCDEImportErrorMessage = (
  rawError: any,
  t: (key: string, defaultVal?: any, options?: any) => string,
  mode: 'create' | 'update' = 'create'
): string => {
  if (!rawError) {
    return mode === 'update'
      ? t('cde.error-generic-update', 'Lỗi khi cập nhật bản ghi CDE.')
      : t('cde.error-generic-create', 'Lỗi khi tạo mới bản ghi CDE.');
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
      ? t('cde.error-generic-update', 'Lỗi khi cập nhật bản ghi CDE.')
      : t('cde.error-generic-create', 'Lỗi khi tạo mới bản ghi CDE.');
  }

  // 1. Lỗi thuật ngữ đã tồn tại trong danh mục:
  // "A term with the name 'alo4' already exists in 'Data Dictionary' glossary."
  const termAlreadyExistsMatch = message.match(
    /A term with the name ['"]?([^'"]+)['"]? already exists in ['"]?([^'"]+)['"]? glossary/i
  );
  if (termAlreadyExistsMatch) {
    const [, termName, glossaryName] = termAlreadyExistsMatch;
    return t(
      'cde.error-term-already-exists',
      `Mã CDE '${termName}' đã tồn tại trong danh mục '${glossaryName}'.`,
      { name: termName, glossary: glossaryName }
    );
  }

  // 2. Lỗi thực thể/thuật ngữ đã tồn tại với tên:
  // "GlossaryTerm with name 'alo4' already exists." or "Entity with name '...' already exists."
  const entityNameMatch = message.match(
    /(?:GlossaryTerm|Entity|Term)?\s*with name ['"]?([^'"]+)['"]? already exists/i
  );
  if (entityNameMatch) {
    const [, termName] = entityNameMatch;
    return t(
      'cde.error-term-name-exists',
      `Mã CDE '${termName}' đã tồn tại trên hệ thống.`,
      { name: termName }
    );
  }

  // 3. Lỗi chuỗi phân cấp cha:
  // "Term 'alo4' (or one of its descendants) already exists in the parent chain."
  const parentChainMatch = message.match(
    /Term ['"]?([^'"]+)['"]? .*already exists in the parent chain/i
  );
  if (parentChainMatch) {
    const [, termName] = parentChainMatch;
    return t(
      'cde.error-parent-chain-exists',
      `Thuật ngữ '${termName}' đã tồn tại trong chuỗi phân cấp cha.`,
      { name: termName }
    );
  }

  // 4. Lỗi đã tồn tại chung: "Entity already exists"
  if (/already exists/i.test(message)) {
    return t(
      'cde.error-already-exists',
      'Bản ghi CDE đã tồn tại trên hệ thống.'
    );
  }

  // 5. Phân quyền / Không có quyền
  if (
    /permission|not allowed|access denied|forbidden|unauthorized|is not admin/i.test(
      message
    )
  ) {
    return t(
      'cde.error-permission-denied',
      'Bạn không có quyền thực hiện thao tác này.'
    );
  }

  // 6. Thẻ phân loại xung đột (mutually exclusive)
  if (/mutually exclusive/i.test(message)) {
    return t(
      'cde.error-mutually-exclusive-tags',
      'Các nhãn phân loại (tags) bị xung đột lẫn nhau.'
    );
  }

  // 7. Không tìm thấy đối tượng (not found)
  if (/instance for|entity.*not found|not found/i.test(message)) {
    return t(
      'cde.error-not-found',
      'Không tìm thấy thông tin bản ghi trên hệ thống.'
    );
  }

  // 8. Lỗi kết nối mạng / timeout
  if (/network error|timeout|connection refused|econnrefused/i.test(message)) {
    return t('cde.error-network', 'Lỗi kết nối tới máy chủ.');
  }

  // 9. Lỗi máy chủ 500
  if (/internal server error|server error/i.test(message)) {
    return t(
      'cde.error-server-internal',
      'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.'
    );
  }

  // 10. Yêu cầu không hợp lệ 400
  if (/invalid request|bad request/i.test(message)) {
    return t(
      'cde.error-invalid-request',
      'Dữ liệu yêu cầu không hợp lệ hoặc sai định dạng.'
    );
  }

  return message;
};

