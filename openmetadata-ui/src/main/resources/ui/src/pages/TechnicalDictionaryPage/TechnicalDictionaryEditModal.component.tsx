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

import { Form, Input, Modal, Select } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TechnicalFieldItem } from './TechnicalDictionaryTable.component';

const { Option } = Select;

export interface TechnicalDictionaryEditModalProps {
  visible: boolean;
  fieldItem?: TechnicalFieldItem | null;
  cdeOptions?: Array<{ label: string; value: string; name: string }>;
  onCancel: () => void;
  onSave: (updatedItem: Partial<TechnicalFieldItem>) => Promise<void> | void;
  isSubmitting?: boolean;
}

export const TechnicalDictionaryEditModal: React.FC<TechnicalDictionaryEditModalProps> = ({
  visible,
  fieldItem,
  cdeOptions = [],
  onCancel,
  onSave,
  isSubmitting = false,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && fieldItem) {
      form.setFieldsValue({
        tableName: fieldItem.tableName,
        columnName: fieldItem.columnName,
        cdeCode: fieldItem.cdeCode || '',
        elementType: fieldItem.elementType || 'AtomicDataElement',
        generationType: fieldItem.generationType || 'ManualInput',
        creationMethod: fieldItem.creationMethod || 'NotApplicable',
        timeliness: fieldItem.timeliness || 'T',
        systemOwner: fieldItem.systemOwner || '',
      });
    } else {
      form.resetFields();
    }
  }, [visible, fieldItem, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      let cdeName = fieldItem?.cdeName;
      if (values.cdeCode) {
        const found = cdeOptions.find((c) => c.value === values.cdeCode);
        if (found) {
          cdeName = found.name;
        }
      }

      let elementTypeName = t('label.atomic-data-element', {
        defaultValue: 'Dữ liệu nguyên tố',
      });
      if (values.elementType === 'TransformedDataElement') {
        elementTypeName = t('label.transformed-data-element', {
          defaultValue: 'Dữ liệu chuyển đổi',
        });
      }

      let generationTypeName = t('label.manual-input', {
        defaultValue: 'Nhập thủ công',
      });
      if (values.generationType === 'SystemGenerated') {
        generationTypeName = t('label.system-generated', {
          defaultValue: 'Hệ thống tự sinh',
        });
      } else if (values.generationType === 'SystemDerived') {
        generationTypeName = t('label.system-derived', {
          defaultValue: 'Hệ thống tính toán',
        });
      } else if (values.generationType === 'FileUpload') {
        generationTypeName = t('label.file-upload', {
          defaultValue: 'Tải lên',
        });
      }

      let creationMethodName = t('label.not-applicable', {
        defaultValue: 'N/A',
      });
      if (values.creationMethod === 'Parameterised') {
        creationMethodName = t('label.parameterised', {
          defaultValue: 'Tham số',
        });
      } else if (values.creationMethod === 'Hardcoded') {
        creationMethodName = t('label.hardcoded', {
          defaultValue: 'Mã cứng',
        });
      }

      await onSave({
        ...fieldItem,
        ...values,
        cdeName,
        elementTypeName,
        generationTypeName,
        creationMethodName,
        status: 'In Review',
      });
    } catch {
      // Form validation error
    }
  };

  return (
    <Modal
      cancelText={t('label.cancel', { defaultValue: 'Hủy' })}
      confirmLoading={isSubmitting}
      data-testid="technical-dictionary-edit-modal"
      okText={t('label.submit-approval', { defaultValue: 'Lưu & Gửi phê duyệt' })}
      open={visible}
      title={
        <div>
          <span className="font-semibold">
            {t('label.edit-technical-field', { defaultValue: 'Chỉnh sửa trường kỹ thuật' })}
          </span>
          {fieldItem && (
            <div className="text-grey-muted text-xs mt-1">
              {fieldItem.tableName} &gt; {fieldItem.columnName}
            </div>
          )}
        </div>
      }
      width={680}
      onCancel={onCancel}
      onOk={handleSubmit}>
      <Form form={form} layout="vertical">
        <div className="d-flex gap-4">
          <Form.Item
            className="flex-1"
            label={t('label.table-name', { defaultValue: 'Tên Bảng' })}
            name="tableName">
            <Input disabled />
          </Form.Item>
          <Form.Item
            className="flex-1"
            label={t('label.column-name', { defaultValue: 'Tên cột' })}
            name="columnName">
            <Input disabled />
          </Form.Item>
        </div>

        <Form.Item
          label={t('label.cde-code-ref', { defaultValue: 'Mã CDE quy chiếu' })}
          name="cdeCode">
          <Select
            allowClear
            filterOption={(input, option) =>
              (option?.children as unknown as string)
                ?.toLowerCase()
                ?.includes(input.toLowerCase())
            }
            placeholder={t('label.select-cde', { defaultValue: 'Chọn mã CDE quy chiếu' })}
            showSearch>
            {cdeOptions.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                {opt.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <div className="d-flex gap-4">
          <Form.Item
            className="flex-1"
            label={t('label.data-element-type', { defaultValue: 'Loại thành tố' })}
            name="elementType"
            rules={[{ required: true }]}>
            <Select>
              <Option value="AtomicDataElement">
                {t('label.atomic-data-element', { defaultValue: 'Dữ liệu nguyên tố' })} (Atomic)
              </Option>
              <Option value="TransformedDataElement">
                {t('label.transformed-data-element', { defaultValue: 'Dữ liệu chuyển đổi' })} (Transformed)
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            className="flex-1"
            label={t('label.field-generation-type', { defaultValue: 'Loại trường dữ liệu' })}
            name="generationType"
            rules={[{ required: true }]}>
            <Select>
              <Option value="ManualInput">
                {t('label.manual-input', { defaultValue: 'Nhập thủ công' })} (Manual Input)
              </Option>
              <Option value="SystemGenerated">
                {t('label.system-generated', { defaultValue: 'Hệ thống tự sinh' })} (System Generated)
              </Option>
              <Option value="SystemDerived">
                {t('label.system-derived', { defaultValue: 'Hệ thống tính toán' })} (System Derived)
              </Option>
              <Option value="FileUpload">
                {t('label.file-upload', { defaultValue: 'Tải lên' })} (File Upload)
              </Option>
            </Select>
          </Form.Item>
        </div>

        <div className="d-flex gap-4">
          <Form.Item
            className="flex-1"
            label={t('label.data-creation-method', { defaultValue: 'Phương thức tạo' })}
            name="creationMethod"
            rules={[{ required: true }]}>
            <Select>
              <Option value="Parameterised">
                {t('label.parameterised', { defaultValue: 'Tham số' })} (Parameterised)
              </Option>
              <Option value="Hardcoded">
                {t('label.hardcoded', { defaultValue: 'Mã cứng' })} (Hardcoded)
              </Option>
              <Option value="NotApplicable">
                {t('label.not-applicable', { defaultValue: 'N/A' })} (Not Applicable)
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            className="flex-1"
            label={t('label.timeliness', { defaultValue: 'Thời gian' })}
            name="timeliness">
            <Input placeholder="T, T+1, T+2..." />
          </Form.Item>
        </div>

        <Form.Item
          label={t('label.system-owner', { defaultValue: 'Chủ sở hữu hệ thống' })}
          name="systemOwner">
          <Input placeholder="VD: Trung tâm Quản lý dữ liệu..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default TechnicalDictionaryEditModal;
