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
import { Button } from '@openmetadata/ui-core-components';
import { Form, Input, InputNumber, Modal, Select, Tag as AntTag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GlossaryTermFormSection from '../../components/Glossary/AddGlossaryTermForm/GlossaryTermFormSection.component';
import CDESelector from '../../components/Glossary/CDESelector/CDESelector.component';
import { TECHNICAL_MAX_RANK } from '../../constants/TechnicalDictionary.constants';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Tag } from '../../generated/entity/classification/tag';
import { TechnicalDictionaryOptions } from '../../hooks/useTechnicalDictionaryOptions';
import { TechnicalColumnCandidate } from '../../rest/technicalDictionaryAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';

/** Editable values collected from the modal. `cde` is undefined when unchanged, null when cleared. */
export interface TechnicalRecordFormValues {
  cde?: GlossaryTerm | null;
  rank?: number | null;
  elementType?: string;
  generationType?: string;
  creationMethod?: string;
  timeliness?: string;
  systemOwnerId?: string;
}

export type TechnicalRecordModalMode = 'view' | 'edit' | 'create';

/** Lets `create` mode pick the physical Column to declare, inline in the same form. */
export interface TechnicalColumnPickerProps {
  candidates: TechnicalColumnCandidate[];
  isSearching: boolean;
  selectedKey?: string;
  onSearch: (text: string) => void;
  onSelect: (candidate?: TechnicalColumnCandidate) => void;
}

interface TechnicalRecordModalProps {
  open: boolean;
  mode: TechnicalRecordModalMode;
  row?: TechnicalDictionaryRow;
  options: TechnicalDictionaryOptions;
  isSaving: boolean;
  /** Data Dictionary version the CDEs are chosen from. */
  dataDictionaryVersion?: string;
  columnPicker?: TechnicalColumnPickerProps;
  onCancel: () => void;
  onSave: (values: TechnicalRecordFormValues) => void;
  /** Present when the caller may cancel the declaration of this record. */
  onDelete?: () => void;
}

const tagSelectOptions = (tags: Tag[]) =>
  tags.map((tag) => ({
    value: tag.fullyQualifiedName as string,
    label: tag.displayName || tag.name,
  }));

const columnOptionLabel = (candidate: TechnicalColumnCandidate) =>
  [candidate.sourceTable, candidate.sourceColumn].filter(Boolean).join(' · ');

const columnOptionPath = (candidate: TechnicalColumnCandidate) =>
  [candidate.sourceService, candidate.sourceDatabase, candidate.sourceSchema]
    .filter(Boolean)
    .join(' / ');

const TechnicalRecordModal = ({
  open,
  mode,
  row,
  options,
  isSaving,
  dataDictionaryVersion,
  columnPicker,
  onCancel,
  onSave,
  onDelete,
}: TechnicalRecordModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<TechnicalRecordFormValues>();
  const [pendingCde, setPendingCde] = useState<GlossaryTerm | null>();
  const isReadOnly = mode === 'view';
  const isCreate = mode === 'create';
  const isSaveDisabled = isSaving || (isCreate && !row);
  const titleKey = {
    view: 'label.view-technical-field',
    edit: 'label.edit-technical-field',
    create: 'label.add-column',
  }[mode];

  useEffect(() => {
    if (open && row) {
      setPendingCde(undefined);
      form.setFieldsValue({
        rank: row.rank,
        elementType: row.elementType?.fqn,
        generationType: row.generationType?.fqn,
        creationMethod: row.creationMethod?.fqn,
        timeliness: row.timeliness?.fqn,
      });
    }
  }, [open, row, form]);

  const selectedCde = useMemo(
    () =>
      row?.cdeTermId
        ? ({
            id: row.cdeTermId,
            name: row.cdeCode,
            displayName: row.cdeName,
            parentBusinessVersion: dataDictionaryVersion,
          } as GlossaryTerm)
        : undefined,
    [row, dataDictionaryVersion]
  );

  const shownName =
    pendingCde === undefined
      ? row?.cdeName
      : pendingCde
      ? getEntityName(pendingCde)
      : '';
  const handleOk = async () => {
    const values = await form.validateFields();
    const hasCde =
      pendingCde === undefined ? Boolean(row?.cdeTermId) : pendingCde !== null;
    if (hasCde && !values.rank) {
      form.setFields([
        { name: 'rank', errors: [t('message.technical-rank-required')] },
      ]);

      return;
    }
    onSave({ ...values, cde: pendingCde });
  };

  return (
    <Modal
      centered
      destroyOnClose
      className="edit-glossary-modal cde-glossary-term-modal cde-glossary-term-modal--cde cde-glossary-term-modal--add"
      data-testid="technical-record-modal"
      footer={[
        ...(onDelete && mode === 'edit'
          ? [
              <Button
                color="primary-destructive"
                data-testid="technical-record-delete"
                isDisabled={isSaving}
                key="delete-btn"
                onPress={onDelete}>
                {t('label.delete-declaration')}
              </Button>,
            ]
          : []),
        <Button color="secondary" key="cancel-btn" onPress={onCancel}>
          {t(isReadOnly ? 'label.close' : 'label.cancel')}
        </Button>,
        ...(isReadOnly
          ? []
          : [
              <Button
                color="primary"
                data-testid="technical-record-save"
                isDisabled={isSaveDisabled}
                isLoading={isSaving}
                key="save-btn"
                onPress={handleOk}>
                {t('label.save')}
              </Button>,
            ]),
      ]}
      maskClosable={false}
      open={open}
      title={
        <div className="cde-glossary-modal-title">
          <div>{t(titleKey)}</div>
          <div className="cde-glossary-modal-subtitle" title={row?.columnFqn}>
            {row
              ? [
                  row.databaseName,
                  row.schemaName,
                  row.tableName,
                  row.columnName,
                ]
                  .filter(Boolean)
                  .join(' / ')
              : t('label.technical-dictionary')}
          </div>
        </div>
      }
      width={1080}
      onCancel={onCancel}>
      <Form
        className="cde-glossary-term-form cde-glossary-term-form--add technical-dictionary-edit-form"
        disabled={isReadOnly}
        form={form}
        layout="vertical">
        <GlossaryTermFormSection
          description={t(
            isCreate
              ? 'message.technical-add-column-description'
              : 'message.technical-field-information-description'
          )}
          title={t('label.technical-field-information')}>
          {isCreate && columnPicker && (
            <Form.Item
              required
              className="cde-form-field-full"
              label={t('label.select-column')}>
              <Select
                showSearch
                className="cde-form-enum-select"
                data-testid="technical-add-column-select"
                filterOption={false}
                loading={columnPicker.isSearching}
                notFoundContent={t('message.technical-no-matching-columns')}
                optionLabelProp="label"
                placeholder={t('label.search-columns')}
                popupClassName="technical-dictionary-select-dropdown cde-enum-field-dropdown"
                value={columnPicker.selectedKey}
                onChange={(key?: string) =>
                  columnPicker.onSelect(
                    columnPicker.candidates.find(
                      (item) => item.columnKey === key
                    )
                  )
                }
                onSearch={columnPicker.onSearch}>
                {columnPicker.candidates.map((item) => (
                  <Select.Option
                    disabled={item.declared}
                    key={item.columnKey}
                    label={columnOptionLabel(item)}
                    value={item.columnKey}>
                    <div className="technical-column-option">
                      <span className="technical-column-option-title">
                        {columnOptionLabel(item)}
                      </span>
                      {item.sourceDataType && (
                        <span className="technical-column-option-meta">
                          {item.sourceDataType}
                        </span>
                      )}
                      {item.declared && <AntTag>{t('label.declared')}</AntTag>}
                    </div>
                    <div className="technical-column-option-path">
                      {columnOptionPath(item)}
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
          {[
            [t('label.database-name'), row?.databaseName],
            [t('label.schema-name'), row?.schemaName],
            [t('label.table-name'), row?.tableName],
            [t('label.column-name'), row?.columnName],
            [t('label.source'), row?.serviceName],
            [t('label.data-type'), row?.dataType],
          ].map(([label, value]) => (
            <Form.Item key={label} label={label}>
              <Input disabled value={value} />
            </Form.Item>
          ))}
          <Form.Item
            className="cde-form-field-full"
            label={t('label.description')}>
            <Input.TextArea autoSize disabled value={row?.description} />
          </Form.Item>
        </GlossaryTermFormSection>

        <GlossaryTermFormSection
          description={t(
            'message.technical-specification-and-reference-description'
          )}
          title={t('label.technical-specification-and-reference')}>
          <Form.Item label={t('label.cde-code-ref')}>
            <CDESelector
              requireActive
              className="cde-form-enum-select"
              disabled={isReadOnly}
              parentBusinessVersion={dataDictionaryVersion}
              popupClassName="technical-dictionary-select-dropdown cde-enum-field-dropdown"
              selectedCde={selectedCde}
              onChange={(value, cde) =>
                setPendingCde(value && cde ? cde : null)
              }
            />
          </Form.Item>
          <Form.Item label={t('label.cde-name')}>
            <Input disabled value={shownName} />
          </Form.Item>
          <Form.Item
            label={t('label.rank')}
            name="rank"
            rules={[
              {
                type: 'number',
                min: 1,
                max: TECHNICAL_MAX_RANK,
                message: t('message.technical-rank-range', {
                  max: TECHNICAL_MAX_RANK,
                }),
              },
            ]}>
            <InputNumber
              className="w-full"
              data-testid="technical-rank-input"
              max={TECHNICAL_MAX_RANK}
              min={1}
              precision={0}
            />
          </Form.Item>
          <Form.Item label={t('label.data-element-type')} name="elementType">
            <Select
              allowClear
              className="cde-form-enum-select"
              options={tagSelectOptions(options.elementTypes)}
              popupClassName="technical-dictionary-select-dropdown cde-enum-field-dropdown"
            />
          </Form.Item>
          <Form.Item label={t('label.generation-type')} name="generationType">
            <Select
              allowClear
              className="cde-form-enum-select"
              options={tagSelectOptions(options.generationTypes)}
              popupClassName="technical-dictionary-select-dropdown cde-enum-field-dropdown"
            />
          </Form.Item>
          <Form.Item label={t('label.creation-method')} name="creationMethod">
            <Select
              allowClear
              className="cde-form-enum-select"
              options={tagSelectOptions(options.creationMethods)}
              popupClassName="technical-dictionary-select-dropdown cde-enum-field-dropdown"
            />
          </Form.Item>
          <Form.Item label={t('label.timeliness')} name="timeliness">
            <Select
              allowClear
              className="cde-form-enum-select"
              options={tagSelectOptions(options.timeliness)}
              popupClassName="technical-dictionary-select-dropdown cde-enum-field-dropdown"
            />
          </Form.Item>
        </GlossaryTermFormSection>
      </Form>
    </Modal>
  );
};

export default TechnicalRecordModal;
