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

import { EditOutlined } from '@ant-design/icons';
import { Form, Input, Modal, Select } from 'antd';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import GlossaryTermFormSection from '../../components/Glossary/AddGlossaryTermForm/GlossaryTermFormSection.component';
import GovernedVersionFields from '../../components/Glossary/AddGlossaryTermForm/GovernedVersionFields.component';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import { TechnicalFieldItem } from './TechnicalDictionaryTable.component';

const { Option } = Select;

export interface TechnicalDictionaryEditModalProps {
  visible: boolean;
  fieldItem?: TechnicalFieldItem | null;
  cdeOptions?: Array<{
    label: string;
    value: string;
    name: string;
    code?: string;
    termId?: string;
    fullyQualifiedName?: string;
    snapshotId?: string;
    businessVersion?: string;
    parentBusinessVersion?: string;
    dataDictionaryVersionId?: string;
  }>;
  onCancel: () => void;
  onSave: (updatedItem: Partial<TechnicalFieldItem>) => Promise<void> | void;
  isSubmitting?: boolean;
  onSearchCde?: (search: string) => void;
}

export const TechnicalDictionaryEditModal: React.FC<
  TechnicalDictionaryEditModalProps
> = ({
  visible,
  fieldItem,
  cdeOptions = [],
  onCancel,
  onSave,
  isSubmitting = false,
  onSearchCde,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isReadOnly = useMemo(
    () =>
      fieldItem?.historical ||
      fieldItem?.catalogStatus === EntityStatus.Archived ||
      fieldItem?.status === EntityStatus.Approved ||
      fieldItem?.status === EntityStatus.InReview,
    [fieldItem]
  );

  useEffect(() => {
    if (visible && fieldItem) {
      form.setFieldsValue({
        tableName: fieldItem.tableName,
        columnName: fieldItem.columnName,
        cdeCode:
          cdeOptions.find((option) => option.code === fieldItem.cdeCode)
            ?.value ||
          fieldItem.cdeCode ||
          '',
        elementType: fieldItem.elementType || 'AtomicDataElement',
        generationType: fieldItem.generationType || 'ManualInput',
        creationMethod: fieldItem.creationMethod || 'NotApplicable',
        timeliness: fieldItem.timeliness || 'T',
        systemOwner: fieldItem.systemOwner || '',
        survivorshipRank: fieldItem.survivorshipRank,
      });
    } else {
      form.resetFields();
    }
  }, [visible, fieldItem, form]);

  useEffect(() => {
    const resetScrollFrame = visible
      ? globalThis.requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(
              '.technical-dictionary-edit-modal .ant-modal-body'
            )
            ?.scrollTo({ top: 0 });
        })
      : undefined;

    return () => {
      if (resetScrollFrame !== undefined) {
        globalThis.cancelAnimationFrame(resetScrollFrame);
      }
    };
  }, [visible]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const selectedCde = cdeOptions.find(
        (option) => option.value === values.cdeCode
      );
      const keepsExistingCde = Boolean(
        values.cdeCode &&
          (values.cdeCode === fieldItem?.cdeCode ||
            values.cdeCode === fieldItem?.cdeSnapshotId)
      );
      let cdeName = fieldItem?.cdeName;
      if (values.cdeCode) {
        if (selectedCde) {
          cdeName = selectedCde.name;
        }
      } else {
        cdeName = undefined;
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
        cdeCode: selectedCde?.code ?? values.cdeCode,
        cdeName,
        cdeFqn:
          selectedCde?.fullyQualifiedName ??
          (keepsExistingCde ? fieldItem?.cdeFqn : undefined),
        cdeTermId:
          selectedCde?.termId ??
          (keepsExistingCde ? fieldItem?.cdeTermId : undefined),
        cdeSnapshotId:
          selectedCde?.snapshotId ??
          (keepsExistingCde ? fieldItem?.cdeSnapshotId : undefined),
        cdeBusinessVersion:
          selectedCde?.businessVersion ??
          (keepsExistingCde ? fieldItem?.cdeBusinessVersion : undefined),
        dataDictionaryVersionId:
          selectedCde?.dataDictionaryVersionId ??
          (keepsExistingCde ? fieldItem?.dataDictionaryVersionId : undefined),
        cdeParentBusinessVersion:
          selectedCde?.parentBusinessVersion ??
          (keepsExistingCde ? fieldItem?.cdeParentBusinessVersion : undefined),
        elementTypeName,
        generationTypeName,
        creationMethodName,
        survivorshipRank: values.survivorshipRank
          ? Number(values.survivorshipRank)
          : undefined,
        survivorshipNote: fieldItem?.survivorshipNote,
        status: fieldItem?.status || EntityStatus.Draft,
      });
    } catch {
      // Form validation error
    }
  };

  return (
    <Modal
      centered
      bodyStyle={{ overflowY: 'auto' }}
      cancelButtonProps={{ className: 'technical-edit-modal-cancel' }}
      cancelText={t('label.cancel', { defaultValue: 'Hủy' })}
      className="technical-dictionary-edit-modal"
      confirmLoading={isSubmitting}
      data-testid="technical-dictionary-edit-modal"
      footer={isReadOnly ? null : undefined}
      okButtonProps={{
        className: 'technical-edit-modal-save',
        type: 'primary',
      }}
      okText={t('label.save-draft', { defaultValue: 'Lưu nháp' })}
      open={visible}
      title={
        <div className="technical-edit-modal-title">
          <span aria-hidden="true" className="technical-edit-modal-title-icon">
            <EditOutlined />
          </span>
          <div className="technical-edit-modal-title-content">
            <span className="technical-edit-modal-title-text">
              {isReadOnly
                ? t('label.view-technical-field-version', {
                    defaultValue: 'Xem phiên bản trường kỹ thuật',
                  })
                : t('label.edit-technical-field', {
                    defaultValue: 'Chỉnh sửa trường kỹ thuật',
                  })}
            </span>
            {fieldItem && (
              <div
                className="technical-edit-modal-path"
                title={fieldItem.columnFqn}>
                {[
                  fieldItem.databaseDisplayName || fieldItem.databaseName,
                  fieldItem.schemaDisplayName || fieldItem.schemaName,
                  fieldItem.tableDisplayName || fieldItem.tableName,
                  fieldItem.columnDisplayName || fieldItem.columnName,
                ]
                  .filter(Boolean)
                  .join(' / ')}
              </div>
            )}
          </div>
        </div>
      }
      width={720}
      onCancel={onCancel}
      onOk={handleSubmit}>
      <Form
        className="cde-glossary-term-form technical-dictionary-edit-form"
        form={form}
        layout="vertical">
        <GlossaryTermFormSection
          readOnly
          title={t('label.version-information', {
            defaultValue: 'Thông tin phiên bản',
          })}>
          <GovernedVersionFields
            bindToForm={false}
            releaseVersionType={fieldItem?.releaseVersionType}
            releaseVersionTypeLabel={t('label.release-version-type', {
              defaultValue: 'Loại phiên bản phát hành',
            })}
            version={fieldItem?.businessVersion}
            versionLabel={t('label.version', { defaultValue: 'Phiên bản' })}
          />
        </GlossaryTermFormSection>

        <GlossaryTermFormSection
          readOnly
          description={t('message.technical-field-information-description', {
            defaultValue: 'Thông tin định danh được đồng bộ từ hệ thống nguồn.',
          })}
          title={t('label.technical-field-information', {
            defaultValue: 'Thông tin trường kỹ thuật',
          })}>
          <Form.Item
            label={t('label.database-name', {
              defaultValue: 'Tên cơ sở dữ liệu',
            })}>
            <Input
              disabled
              value={fieldItem?.databaseDisplayName || fieldItem?.databaseName}
            />
          </Form.Item>
          <Form.Item
            label={t('label.schema-name', { defaultValue: 'Tên Schema' })}>
            <Input
              disabled
              value={fieldItem?.schemaDisplayName || fieldItem?.schemaName}
            />
          </Form.Item>
          <Form.Item
            label={t('label.table-name', { defaultValue: 'Tên Bảng' })}
            name="tableName">
            <Input disabled />
          </Form.Item>
          <Form.Item
            label={t('label.column-name', { defaultValue: 'Tên cột' })}
            name="columnName">
            <Input disabled />
          </Form.Item>
          <Form.Item label={t('label.source', { defaultValue: 'Nguồn' })}>
            <Input disabled value={fieldItem?.serviceName} />
          </Form.Item>
          <Form.Item
            label={t('label.data-type', { defaultValue: 'Loại dữ liệu' })}>
            <Input
              disabled
              value={fieldItem?.dataTypeDisplay || fieldItem?.dataType}
            />
          </Form.Item>
        </GlossaryTermFormSection>

        <GlossaryTermFormSection
          description={t(
            'message.technical-specification-and-reference-description',
            {
              defaultValue:
                'Cập nhật các thuộc tính kỹ thuật và CDE quy chiếu của trường.',
            }
          )}
          title={t('label.technical-specification-and-reference', {
            defaultValue: 'Thông tin đặc tả và quy chiếu',
          })}>
          <Form.Item
            label={t('label.cde-code-ref', {
              defaultValue: 'Mã CDE quy chiếu',
            })}
            name="cdeCode">
            <Select
              allowClear
              showSearch
              className="w-full"
              disabled={isReadOnly}
              filterOption={false}
              placeholder={t('label.select-cde', {
                defaultValue: 'Tìm theo mã hoặc tên CDE',
              })}
              onSearch={onSearchCde}>
              {cdeOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={t('label.survivorship-rank', {
              defaultValue: 'Thứ hạng sinh tồn',
            })}
            name="survivorshipRank">
            <Select
              allowClear
              showSearch
              className="w-full"
              disabled={isReadOnly}
              placeholder={t('label.unranked', {
                defaultValue: 'Chưa gán thứ hạng',
              })}>
              <Option value={1}>
                🥇{' '}
                {t('label.rank-n', {
                  defaultValue: 'Hạng {{rank}}',
                  rank: 1,
                })}
              </Option>
              <Option value={2}>
                🥈 {t('label.rank-2', { defaultValue: 'Hạng 2' })}
              </Option>
              <Option value={3}>
                🥉 {t('label.rank-3', { defaultValue: 'Hạng 3' })}
              </Option>
              <Option value={4}>
                🏷️ {t('label.rank-4', { defaultValue: 'Hạng 4' })}
              </Option>
              <Option value={5}>
                🏷️ {t('label.rank-5', { defaultValue: 'Hạng 5' })}
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={t('label.data-element-type', {
              defaultValue: 'Loại thành tố',
            })}
            name="elementType"
            rules={[{ required: true }]}>
            <Select className="w-full" disabled={isReadOnly}>
              <Option value="AtomicDataElement">
                {t('label.atomic-data-element', {
                  defaultValue: 'Dữ liệu nguyên tố',
                })}
              </Option>
              <Option value="TransformedDataElement">
                {t('label.transformed-data-element', {
                  defaultValue: 'Dữ liệu chuyển đổi',
                })}
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={t('label.field-generation-type', {
              defaultValue: 'Loại trường dữ liệu',
            })}
            name="generationType"
            rules={[{ required: true }]}>
            <Select className="w-full" disabled={isReadOnly}>
              <Option value="ManualInput">
                {t('label.manual-input', {
                  defaultValue: 'Nhập thủ công',
                })}
              </Option>
              <Option value="SystemGenerated">
                {t('label.system-generated', {
                  defaultValue: 'Hệ thống tự sinh',
                })}
              </Option>
              <Option value="SystemDerived">
                {t('label.system-derived', {
                  defaultValue: 'Hệ thống tính toán',
                })}
              </Option>
              <Option value="FileUpload">
                {t('label.file-upload', {
                  defaultValue: 'Tải lên',
                })}
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={t('label.data-creation-method', {
              defaultValue: 'Phương thức tạo',
            })}
            name="creationMethod"
            rules={[{ required: true }]}>
            <Select className="w-full" disabled={isReadOnly}>
              <Option value="Parameterised">
                {t('label.parameterised', { defaultValue: 'Tham số' })}
              </Option>
              <Option value="Hardcoded">
                {t('label.hardcoded', { defaultValue: 'Mã cứng' })}
              </Option>
              <Option value="NotApplicable">
                {t('label.not-applicable', { defaultValue: 'N/A' })}
              </Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={t('label.timeliness', { defaultValue: 'Thời gian' })}
            name="timeliness">
            <Input disabled={isReadOnly} placeholder="T, T+1, T+2..." />
          </Form.Item>

          <Form.Item
            className="cde-form-field-full"
            label={t('label.system-owner', {
              defaultValue: 'Chủ sở hữu hệ thống',
            })}
            name="systemOwner">
            <Input
              disabled={isReadOnly}
              placeholder="VD: Trung tâm Quản lý dữ liệu..."
            />
          </Form.Item>
        </GlossaryTermFormSection>
      </Form>
    </Modal>
  );
};

export default TechnicalDictionaryEditModal;
