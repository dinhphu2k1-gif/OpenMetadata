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
import CDESelectableField from '../../components/Glossary/CDESelectableList/CDESelectableField.component';
import { TECHNICAL_MAX_RANK } from '../../constants/TechnicalDictionary.constants';
import { EntityReference } from '../../generated/entity/type';
import { TechnicalDictionaryOptions } from '../../hooks/useTechnicalDictionaryOptions';
import {
  TechnicalColumnCandidate,
  TechnicalOwnerInput,
} from '../../rest/technicalDictionaryAPI';
import { getEntityName } from '../../utils/EntityNameUtils';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import TechnicalStatusBadge from './TechnicalStatusBadge.component';
import TechnicalTagSelect from './TechnicalTagSelect.component';

/** Editable values collected from the modal. `cde` is undefined when unchanged, null when cleared. */
export interface TechnicalRecordFormValues {
  cde?: EntityReference | null;
  rank?: number | null;
  elementType?: string;
  generationType?: string;
  creationMethod?: string;
  timeliness?: string;
  systemOwners?: TechnicalOwnerInput[];
}

export type TechnicalRecordModalMode = 'view' | 'edit' | 'create' | 'review';

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
  /** Current effective values while `row` contains the pending proposal. */
  options: TechnicalDictionaryOptions;
  isSaving: boolean;
  /** Data Dictionary version the CDEs are chosen from. */
  dataDictionaryVersion?: string;
  columnPicker?: TechnicalColumnPickerProps;
  onCancel: () => void;
  onSave: (values: TechnicalRecordFormValues) => void;
  /** Present when the caller may cancel the declaration of this record. */
  onDelete?: () => void;
  /** Present when the caller may switch a read-only view into the edit form. */
  onEdit?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  /** Present when the caller may send this draft for approval. */
  onSubmit?: () => void;
  /** Present when the caller may read the change history of this record. */
  onOpenHistory?: () => void;
}

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
  onEdit,
  onApprove,
  onReject,
  onSubmit,
  onOpenHistory,
}: TechnicalRecordModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<TechnicalRecordFormValues>();
  const [pendingCde, setPendingCde] = useState<EntityReference | null>();
  const isReadOnly = mode === 'view' || mode === 'review';
  const isCreate = mode === 'create';
  const isSaveDisabled = isSaving || (isCreate && !row);
  const titleKey = {
    view: 'label.view-technical-field',
    edit: 'label.edit-technical-field',
    create: 'label.add-column',
    review: 'label.technical-review-record',
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
        ? {
            id: row.cdeTermId,
            name: row.cdeCode,
            displayName: row.cdeName,
            type: 'glossaryTerm',
          }
        : undefined,
    [row]
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

  const isReview = mode === 'review';
  const closeButton = (
    <Button color="secondary" key="cancel-btn" onPress={onCancel}>
      {t(isReadOnly ? 'label.close' : 'label.cancel')}
    </Button>
  );
  const deleteButton =
    onDelete && mode === 'edit' ? (
      <Button
        color="tertiary-destructive"
        data-testid="technical-record-delete"
        isDisabled={isSaving}
        key="delete-btn"
        onPress={onDelete}>
        {t('label.delete-declaration')}
      </Button>
    ) : null;
  const editButton =
    onEdit && isReadOnly ? (
      <Button
        color="secondary"
        data-testid="technical-record-edit"
        key="edit-btn"
        onPress={onEdit}>
        {t('label.edit')}
      </Button>
    ) : null;
  const submitButton =
    onSubmit && mode === 'view' ? (
      <Button
        color="primary"
        data-testid="technical-record-submit"
        key="submit-btn"
        onPress={onSubmit}>
        {t(
          row?.status === 'Rejected'
            ? 'label.technical-resubmit'
            : 'label.technical-send-for-approval'
        )}
      </Button>
    ) : null;
  const saveButton = isReadOnly ? null : (
    <Button
      color="primary"
      data-testid="technical-record-save"
      isDisabled={isSaveDisabled}
      isLoading={isSaving}
      key="save-btn"
      onPress={handleOk}>
      {t(
        isCreate
          ? 'label.technical-save-draft'
          : row?.status === 'Rejected'
          ? 'label.technical-resubmit'
          : row?.status === 'Approved' || row?.hasPendingChange
          ? 'label.technical-save-change-draft'
          : 'label.save'
      )}
    </Button>
  );
  const reviewButtons = [
    <Button
      color="secondary-destructive"
      data-testid="technical-record-reject"
      key="reject-btn"
      onPress={onReject}>
      {t('label.reject')}
    </Button>,
    <Button
      color="primary"
      data-testid="technical-record-approve"
      key="approve-btn"
      onPress={onApprove}>
      {t('label.approve')}
    </Button>,
  ];
  const historyButton = onOpenHistory ? (
    <Button
      color="tertiary"
      data-testid="technical-record-history"
      key="history-btn"
      onPress={onOpenHistory}>
      {t('label.technical-history')}
    </Button>
  ) : null;
  const leftActions = isReview
    ? [closeButton, editButton, historyButton]
    : [deleteButton, historyButton];
  const rightActions = isReview
    ? reviewButtons
    : [closeButton, editButton, submitButton, saveButton];

  return (
    <Modal
      centered
      destroyOnClose
      className="edit-glossary-modal cde-glossary-term-modal cde-glossary-term-modal--cde cde-glossary-term-modal--add"
      data-testid="technical-record-modal"
      footer={
        <div className="tech-record-footer">
          {leftActions}
          <div className="tech-record-footer-actions">{rightActions}</div>
        </div>
      }
      maskClosable={false}
      open={open}
      title={
        <div className="cde-glossary-modal-title">
          <div className="tech-record-modal-heading">
            {t(titleKey)}
            {row?.status && !isCreate && (
              <TechnicalStatusBadge
                dataTestId="technical-record-status"
                status={row.status}
              />
            )}
          </div>
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
      {isReview && row?.changeOperation === 'DELETE' && (
        <p data-testid="technical-change-comparison">
          {t('message.technical-delete-change-review')}
        </p>
      )}
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
            <CDESelectableField
              dataDictionaryVersion={dataDictionaryVersion}
              disabled={isReadOnly}
              selectedCde={
                pendingCde === undefined ? selectedCde : pendingCde ?? undefined
              }
              onChange={(cde) => setPendingCde(cde ?? null)}
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
            <TechnicalTagSelect
              dataTestId="technical-elementType-select"
              disabled={isReadOnly}
              label={t('label.data-element-type')}
              loading={options.isLoading}
              tags={options.elementTypes}
              variant="method"
            />
          </Form.Item>
          <Form.Item label={t('label.generation-type')} name="generationType">
            <TechnicalTagSelect
              dataTestId="technical-generationType-select"
              disabled={isReadOnly}
              label={t('label.generation-type')}
              loading={options.isLoading}
              tags={options.generationTypes}
              variant="quality"
            />
          </Form.Item>
          <Form.Item label={t('label.creation-method')} name="creationMethod">
            <TechnicalTagSelect
              dataTestId="technical-creationMethod-select"
              disabled={isReadOnly}
              label={t('label.creation-method')}
              loading={options.isLoading}
              tags={options.creationMethods}
              variant="source"
            />
          </Form.Item>
          <Form.Item label={t('label.timeliness')} name="timeliness">
            <TechnicalTagSelect
              dataTestId="technical-timeliness-select"
              disabled={isReadOnly}
              label={t('label.timeliness')}
              loading={options.isLoading}
              tags={options.timeliness}
              variant="frequency"
            />
          </Form.Item>
        </GlossaryTermFormSection>
      </Form>
    </Modal>
  );
};

export default TechnicalRecordModal;
