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
import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GlossaryTermFormSection from '../../components/Glossary/AddGlossaryTermForm/GlossaryTermFormSection.component';
import GovernedVersionFields from '../../components/Glossary/AddGlossaryTermForm/GovernedVersionFields.component';
import CDESelector from '../../components/Glossary/CDESelector/CDESelector.component';
import { renderDictionaryOwnerList } from '../../components/Glossary/GlossaryTermTab/DictionaryCellRenderers';
import { TECHNICAL_MAX_RANK } from '../../constants/TechnicalDictionary.constants';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Tag } from '../../generated/entity/classification/tag';
import { TechnicalDictionaryOptions } from '../../hooks/useTechnicalDictionaryOptions';
import { getEntityName } from '../../utils/EntityNameUtils';
import { TechnicalDictionaryRow } from './technicalDictionary.interface';
import TechnicalVersionHistory from './TechnicalVersionHistory.component';

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

interface TechnicalRecordModalProps {
  open: boolean;
  mode: TechnicalRecordModalMode;
  row?: TechnicalDictionaryRow;
  options: TechnicalDictionaryOptions;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (values: TechnicalRecordFormValues) => void;
}

const tagSelectOptions = (tags: Tag[]) =>
  tags.map((tag) => ({
    value: tag.fullyQualifiedName as string,
    label: tag.displayName || tag.name,
  }));

const TechnicalRecordModal = ({
  open,
  mode,
  row,
  options,
  isSaving,
  onCancel,
  onSave,
}: TechnicalRecordModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<TechnicalRecordFormValues>();
  const [pendingCde, setPendingCde] = useState<GlossaryTerm | null>();
  const isReadOnly = mode === 'view';
  const isCreate = mode === 'create';
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
        elementType: row.elementType?.tagFQN,
        generationType: row.generationType?.tagFQN,
        creationMethod: row.creationMethod?.tagFQN,
        timeliness: row.timeliness?.tagFQN,
        systemOwnerId: row.systemOwner?.id,
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
            businessVersion: row.cdeRelation?.versionContext?.businessVersion,
            parentBusinessVersion: row.parentBusinessVersion,
          } as GlossaryTerm)
        : undefined,
    [row]
  );

  const shownName =
    pendingCde === undefined
      ? row?.cdeName
      : pendingCde
      ? getEntityName(pendingCde)
      : '';
  const shownOwners =
    pendingCde === undefined ? row?.dataOwners : pendingCde?.owners ?? [];

  const handleOk = async () => {
    const values = await form.validateFields();
    onSave({ ...values, cde: pendingCde });
  };

  return (
    <Modal
      centered
      destroyOnClose
      cancelText={t('label.cancel')}
      className="technical-dictionary-edit-modal"
      confirmLoading={isSaving}
      data-testid="technical-record-modal"
      okButtonProps={{ hidden: isReadOnly }}
      okText={t('label.save')}
      open={open}
      title={
        <div className="technical-edit-modal-title-content">
          <span className="technical-edit-modal-title-text">
            <EditOutlined />{' '}
            {t(titleKey)}
          </span>
          {row && (
            <div className="technical-edit-modal-path" title={row.columnFqn}>
              {[row.databaseName, row.schemaName, row.tableName, row.columnName]
                .filter(Boolean)
                .join(' / ')}
            </div>
          )}
        </div>
      }
      width={720}
      onCancel={onCancel}
      onOk={handleOk}>
      <Form
        className="cde-glossary-term-form technical-dictionary-edit-form"
        disabled={isReadOnly}
        form={form}
        layout="vertical">
        {!isCreate && (
          <GlossaryTermFormSection
            readOnly
            title={t('label.version-information')}>
            <GovernedVersionFields
              bindToForm={false}
              releaseVersionType={row?.releaseVersionType}
              releaseVersionTypeLabel={t('label.release-version-type')}
              version={row?.businessVersion}
              versionLabel={t('label.version')}
            />
          </GlossaryTermFormSection>
        )}

        <GlossaryTermFormSection
          readOnly
          description={t('message.technical-field-information-description')}
          title={t('label.technical-field-information')}>
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
              disabled={isReadOnly}
              parentBusinessVersion={row?.parentBusinessVersion}
              selectedCde={selectedCde}
              selectedVersionContext={row?.cdeRelation?.versionContext}
              onChange={(value, cde) =>
                setPendingCde(value && cde ? cde : null)
              }
            />
          </Form.Item>
          <Form.Item label={t('label.cde-name')}>
            <Input disabled value={shownName} />
          </Form.Item>
          <Form.Item label={t('label.data-owner')}>
            {renderDictionaryOwnerList(shownOwners, 'tech-modal-owner')}
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
              options={tagSelectOptions(options.elementTypes)}
            />
          </Form.Item>
          <Form.Item label={t('label.generation-type')} name="generationType">
            <Select
              allowClear
              options={tagSelectOptions(options.generationTypes)}
            />
          </Form.Item>
          <Form.Item label={t('label.creation-method')} name="creationMethod">
            <Select
              allowClear
              options={tagSelectOptions(options.creationMethods)}
            />
          </Form.Item>
          <Form.Item label={t('label.timeliness')} name="timeliness">
            <Select allowClear options={tagSelectOptions(options.timeliness)} />
          </Form.Item>
          <Form.Item
            className="cde-form-field-full"
            label={t('label.system-owner')}
            name="systemOwnerId">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={options.teams.map((team) => ({
                value: team.id,
                label: team.displayName || team.name,
              }))}
            />
          </Form.Item>
        </GlossaryTermFormSection>
        {!isCreate && row && (
          <GlossaryTermFormSection readOnly title={t('label.version-history')}>
            <div className="cde-form-field-full">
              <TechnicalVersionHistory row={row} />
            </div>
          </GlossaryTermFormSection>
        )}
      </Form>
    </Modal>
  );
};

export default TechnicalRecordModal;
