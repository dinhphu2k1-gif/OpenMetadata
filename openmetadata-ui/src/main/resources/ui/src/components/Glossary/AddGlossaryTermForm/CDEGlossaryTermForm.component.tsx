/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Form, FormInstance, Input } from 'antd';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getCDEReleaseLevelValue } from '../../../constants/CDEReleaseLevel.constants';
import { EntityType } from '../../../enums/entity.enum';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { mergeCDEDates, validateCDEDates } from '../../../utils/CDEDateUtils';
import { getCDEReleaseVersionType } from '../../../utils/CDEReleaseVersionTypeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import ClassificationSelect from '../../common/ClassificationSelect/ClassificationSelect.component';
import SingleClassificationSelect from '../../common/ClassificationSelect/SingleClassificationSelect.component';
import { useClassificationOptions } from '../../common/ClassificationSelect/useClassificationOptions';
import DatePicker from '../../common/DatePicker/DatePicker';
import DomainSelectableList from '../../common/DomainSelectableList/DomainSelectableList.component';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import {
  CDE_TAG_CLASSIFICATIONS,
  renderCDEOwners,
} from '../GlossaryTermTab/CDEGlossaryTableColumns';
import {
  AddGlossaryTermFormProps,
  GlossaryTermForm,
} from './AddGlossaryTermForm.interface';
import { CDEFormSelectTrigger } from './CDEFormSelectTrigger.component';
import GlossaryTermFormSection from './GlossaryTermFormSection.component';
import GovernedVersionFields from './GovernedVersionFields.component';

export interface CDEGlossaryTermFormValues {
  name?: string;
  displayName?: string;
  description?: string;
  version?: string;
  releaseVersionType?: string;
  effectiveDate?: DateTime | null;
  expirationDate?: DateTime | null;
  domains?: EntityReference[];
  owners?: EntityReference[];
  releaseLevel?: string;
  dataSourceTags?: TagLabel[];
  dataClassificationTags?: TagLabel[];
  personalDataTags?: TagLabel[];
  dataQualityRules?: string;
  relatedRegulatoryDocuments?: string;
  entityRelationship?: string;
  quy_dinh_chat_luong_du_lieu?: string;
  van_ban_quy_dinh_lien_quan?: string;
  moi_quan_he_voi_thuc_the?: string;
}

interface CDETagSelectorProps {
  classification: string;
  placeholder: string;
  searchPlaceholder: string;
  variant: 'classification' | 'personal' | 'source';
  value?: TagLabel[];
  onChange?: (tags: TagLabel[]) => void;
}

const CDE_CLASSIFICATION_TEST_ID_PREFIX = 'cde-classification-';

const toTagLabel = (fqn: string, label?: string): TagLabel => ({
  tagFQN: fqn,
  name: fqn.split('.').at(-1),
  displayName: label,
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
});

export const CDETagSelector = ({
  classification,
  onChange,
  placeholder,
  searchPlaceholder,
  variant,
  value = [],
}: CDETagSelectorProps) => {
  const { options, isLoading } = useClassificationOptions(classification);

  const handleChange = (fqns: string[]) =>
    onChange?.(
      fqns.map(
        (fqn) =>
          value.find((tag) => tag.tagFQN === fqn) ??
          toTagLabel(fqn, options.find((option) => option.value === fqn)?.label)
      )
    );

  return (
    <ClassificationSelect
      dataTestId={`${CDE_CLASSIFICATION_TEST_ID_PREFIX}${classification}`}
      loading={isLoading}
      mode="multiple"
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      value={value.map((tag) => tag.tagFQN)}
      variant={variant}
      onChange={handleChange}
    />
  );
};

interface CDEOwnerSelectorProps {
  multiple: { team: boolean; user: boolean };
  placeholder: string;
  value?: EntityReference[];
  onChange?: (owners?: EntityReference[]) => void;
}

const CDEOwnerSelector = ({
  multiple,
  onChange,
  placeholder,
  value = [],
}: CDEOwnerSelectorProps) => (
  <UserTeamSelectableList
    hasPermission
    listHeight={200}
    multiple={multiple}
    owner={value}
    onUpdate={async (owners) => onChange?.(owners)}>
    <CDEFormSelectTrigger
      content={value.length ? renderCDEOwners(value) : undefined}
      placeholder={placeholder}
    />
  </UserTeamSelectableList>
);

const CDEGlossaryTermForm = ({
  editMode,
  formRef,
  glossaryTerm,
  onSave,
}: AddGlossaryTermFormProps) => {
  const form = formRef as unknown as FormInstance<CDEGlossaryTermFormValues>;
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { entityRules } = useEntityRules(EntityType.GLOSSARY_TERM);
  const domains = Form.useWatch<EntityReference[]>('domains', form) ?? [];
  const owners = Form.useWatch<EntityReference[]>('owners', form) ?? [];
  const domainLabel = domains.length
    ? domains
        .filter(Boolean)
        .map(
          (domain) => getEntityName(domain) || domain.fullyQualifiedName || ''
        )
        .filter(Boolean)
        .join(', ') || t('cde.select-business-group')
    : t('cde.select-business-group');

  useEffect(() => {
    if (editMode && glossaryTerm) {
      const tags = glossaryTerm.tags ?? [];
      form.setFieldsValue({
        name: glossaryTerm.name,
        displayName: glossaryTerm.displayName,
        description: glossaryTerm.description,
        domains: glossaryTerm.domains,
        owners: glossaryTerm.owners,
        releaseLevel: getCDEReleaseLevelValue(
          glossaryTerm.extension?.releaseLevel
        ),
        dataSourceTags: tags.filter(
          (tag) =>
            tag.tagFQN.split('.')[0] === CDE_TAG_CLASSIFICATIONS.dataSource
        ),
        dataClassificationTags: tags.filter(
          (tag) =>
            tag.tagFQN.split('.')[0] ===
            CDE_TAG_CLASSIFICATIONS.dataClassification
        ),
        personalDataTags: tags.filter(
          (tag) =>
            tag.tagFQN.split('.')[0] === CDE_TAG_CLASSIFICATIONS.personalData
        ),
        dataQualityRules:
          glossaryTerm.extension?.dataQualityRules !== undefined &&
          glossaryTerm.extension?.dataQualityRules !== null
            ? String(
                Array.isArray(glossaryTerm.extension.dataQualityRules)
                  ? glossaryTerm.extension.dataQualityRules.includes('Y') ||
                      glossaryTerm.extension.dataQualityRules.includes('true')
                  : ['1', 'TRUE', 'Y', 'YES', 'CO', 'CÓ'].includes(
                      String(glossaryTerm.extension.dataQualityRules)
                        .trim()
                        .toUpperCase()
                    )
              )
            : glossaryTerm.extension?.quy_dinh_chat_luong_du_lieu !==
                undefined &&
              glossaryTerm.extension?.quy_dinh_chat_luong_du_lieu !== null
            ? String(
                Array.isArray(
                  glossaryTerm.extension.quy_dinh_chat_luong_du_lieu
                )
                  ? glossaryTerm.extension.quy_dinh_chat_luong_du_lieu.includes(
                      'Y'
                    ) ||
                      glossaryTerm.extension.quy_dinh_chat_luong_du_lieu.includes(
                        'true'
                      )
                  : ['1', 'TRUE', 'Y', 'YES', 'CO', 'CÓ'].includes(
                      String(glossaryTerm.extension.quy_dinh_chat_luong_du_lieu)
                        .trim()
                        .toUpperCase()
                    )
              )
            : undefined,
        relatedRegulatoryDocuments:
          glossaryTerm.extension?.relatedRegulatoryDocuments ??
          glossaryTerm.extension?.van_ban_quy_dinh_lien_quan,
        entityRelationship:
          glossaryTerm.extension?.entityRelationship ??
          glossaryTerm.extension?.moi_quan_he_voi_thuc_the,
        effectiveDate: glossaryTerm.extension?.effectiveDate
          ? DateTime.fromISO(glossaryTerm.extension.effectiveDate)
          : null,
        expirationDate: glossaryTerm.extension?.expirationDate
          ? DateTime.fromISO(glossaryTerm.extension.expirationDate)
          : null,
        version: glossaryTerm.businessVersion ?? '1.0',
        releaseVersionType: getCDEReleaseVersionType(
          glossaryTerm.extension?.releaseVersionType,
          glossaryTerm.businessVersion
        ),
      });
    }
  }, [editMode, form, glossaryTerm]);

  const onFinish = async (values: CDEGlossaryTermFormValues) => {
    const currentOwners = (owners ?? []).filter(Boolean);
    const currentDomains = (domains ?? []).filter(Boolean);

    const formTags = [
      values.dataSourceTags,
      values.dataClassificationTags,
      values.personalDataTags,
    ].flatMap((tags) => tags ?? []);

    const existingNonCDETags = (glossaryTerm?.tags ?? []).filter(
      (tag) =>
        !Object.values(CDE_TAG_CLASSIFICATIONS).includes(
          tag.tagFQN.split('.')[0]
        )
    );

    const allTags = [...existingNonCDETags, ...formTags];

    const dataQualityVal =
      values.dataQualityRules ?? values.quy_dinh_chat_luong_du_lieu;
    const relatedDocsVal =
      values.relatedRegulatoryDocuments ?? values.van_ban_quy_dinh_lien_quan;
    const entityRelationshipVal =
      values.entityRelationship ?? values.moi_quan_he_voi_thuc_the;

    const preservedExtension = { ...glossaryTerm?.extension };
    [
      'version',
      'releaseVersionType',
      'entityRelationship',
      'relatedRegulatoryDocuments',
      'dataQualityRules',
      'releaseLevel',
      'moi_quan_he_voi_thuc_the',
      'van_ban_quy_dinh_lien_quan',
      'quy_dinh_chat_luong_du_lieu',
    ].forEach((key) => delete preservedExtension[key]);
    const extension = mergeCDEDates(
      {
        ...preservedExtension,
        ...(values.releaseLevel ? { releaseLevel: [values.releaseLevel] } : {}),
        ...(entityRelationshipVal
          ? {
              entityRelationship: entityRelationshipVal,
            }
          : {}),
        ...(dataQualityVal !== undefined &&
        dataQualityVal !== null &&
        dataQualityVal !== ''
          ? {
              dataQualityRules: dataQualityVal === 'true' ? ['Y'] : ['N'],
            }
          : {}),
        ...(relatedDocsVal
          ? {
              relatedRegulatoryDocuments: relatedDocsVal,
            }
          : {}),
      },
      {
        effectiveDate: values.effectiveDate?.toFormat('yyyy-MM-dd') ?? '',
        expirationDate: values.expirationDate?.toFormat('yyyy-MM-dd') ?? '',
      }
    );

    await onSave({
      name: String(values.name ?? '').trim(),
      displayName: String(values.displayName ?? '').trim(),
      description: String(values.description ?? ''),
      domains: currentDomains,
      owners: currentOwners.length
        ? currentOwners
        : [{ id: currentUser?.id ?? '', type: 'user' }],
      tags: allTags,
      extension: isEmpty(extension) ? undefined : extension,
    } as GlossaryTermForm);
  };

  const tagField = (
    name: string,
    label: string,
    classification: string,
    tone: 'classification' | 'personal' | 'source',
    placeholder: string
  ) => (
    <Form.Item className={`cde-form-tag-${tone}`} label={label} name={name}>
      <CDETagSelector
        classification={classification}
        placeholder={placeholder}
        searchPlaceholder={t('label.search-for-type', { type: label })}
        variant={tone}
      />
    </Form.Item>
  );

  return (
    <Form<CDEGlossaryTermFormValues>
      className={`cde-glossary-term-form cde-glossary-term-form--${
        editMode ? 'edit' : 'add'
      }`}
      form={form}
      initialValues={{
        version: '1.0',
        releaseVersionType: getCDEReleaseVersionType(undefined, '1.0'),
      }}
      layout="vertical"
      onFinish={onFinish}>
      <GlossaryTermFormSection
        className="cde-form-section-basic"
        title={t('cde.basic-information')}>
        <Form.Item
          required
          label={t('cde.term-code')}
          name="name"
          rules={[{ required: true, whitespace: true }]}>
          <Input
            data-testid="cde-term-code"
            disabled={editMode}
            placeholder={t('cde.term-code-placeholder', 'Ví dụ: CDE_CIF_001')}
          />
        </Form.Item>
        <Form.Item label={t('cde.business-term-name')} name="displayName">
          <Input
            data-testid="cde-business-term-name"
            placeholder={t(
              'cde.business-term-name-placeholder',
              'Ví dụ: Mã định danh khách hàng'
            )}
          />
        </Form.Item>
        <GovernedVersionFields
          versionRequired
          releaseVersionTypeLabel={t('cde.release-version-type')}
          releaseVersionTypeTestId="cde-release-version-type"
          versionLabel={t('cde.version')}
          versionTestId="cde-version"
        />
        <Form.Item
          required
          className="cde-form-business-meaning cde-form-field-full"
          initialValue={glossaryTerm?.description ?? ''}
          label={t('cde.business-meaning')}
          name="description"
          rules={[{ required: true, whitespace: true }]}
          trigger="onTextChange">
          <RichTextEditor
            data-testid="cde-business-meaning"
            initialValue={glossaryTerm?.description ?? ''}
            placeHolder={t('cde.business-meaning-placeholder')}
          />
        </Form.Item>
      </GlossaryTermFormSection>

      <GlossaryTermFormSection
        className="cde-form-section-management"
        title={t('cde.management-information')}>
        <Form.Item label={t('cde.business-group')} name="domains">
          <DomainSelectableList
            hasPermission
            isClearable
            showAllDomains
            multiple={entityRules.canAddMultipleDomains}
            selectedDomain={domains}
            wrapInButton={false}
            onUpdate={async (value) =>
              form.setFieldValue(
                'domains',
                value ? (Array.isArray(value) ? value : [value]) : []
              )
            }>
            <div data-testid="cde-business-group">
              <CDEFormSelectTrigger
                placeholder={t('cde.select-business-group')}
                values={domains.length ? [domainLabel] : []}
              />
            </div>
          </DomainSelectableList>
        </Form.Item>
        <Form.Item label={t('cde.data-owner')} name="owners">
          <CDEOwnerSelector
            multiple={{
              user: entityRules.canAddMultipleUserOwners,
              team: entityRules.canAddMultipleTeamOwner,
            }}
            placeholder={t('cde.select-data-owner')}
          />
        </Form.Item>
        <Form.Item label={t('cde.release-level')} name="releaseLevel">
          <SingleClassificationSelect
            dataTestId="cde-release-level"
            options={[
              {
                label: t('cde.release-level-ceo'),
                value: 'CEO',
                variant: 'release',
              },
              {
                label: t('cde.release-level-ttqldl'),
                value: 'TTQLDL',
                variant: 'release',
              },
            ]}
            placeholder={t('cde.select-release-level')}
            searchPlaceholder={t('label.search-for-type', {
              type: t('cde.release-level'),
            })}
          />
        </Form.Item>
        {(['effectiveDate', 'expirationDate'] as const).map((key) => (
          <Form.Item
            dependencies={[
              key === 'effectiveDate' ? 'expirationDate' : 'effectiveDate',
            ]}
            key={key}
            label={t(
              key === 'effectiveDate'
                ? 'cde.effective-date'
                : 'cde.expiration-date'
            )}
            name={key}
            rules={[
              ({ getFieldValue }) => ({
                validator: async () => {
                  const error = validateCDEDates({
                    effectiveDate:
                      getFieldValue('effectiveDate')?.toFormat('yyyy-MM-dd') ??
                      '',
                    expirationDate:
                      getFieldValue('expirationDate')?.toFormat('yyyy-MM-dd') ??
                      '',
                  });
                  if (error) {
                    throw new Error(t(error));
                  }
                },
              }),
            ]}>
            <DatePicker
              allowClear
              data-testid={`cde-${key}`}
              format="dd/MM/yyyy"
              placeholder={t('cde.select-date')}
            />
          </Form.Item>
        ))}
      </GlossaryTermFormSection>

      <GlossaryTermFormSection
        className="cde-form-section-classification"
        title={t('cde.classification-control')}>
        {tagField(
          'dataSourceTags',
          t('cde.data-source'),
          CDE_TAG_CLASSIFICATIONS.dataSource,
          'source',
          t('cde.select-data-source')
        )}
        {tagField(
          'dataClassificationTags',
          t('cde.data-classification'),
          CDE_TAG_CLASSIFICATIONS.dataClassification,
          'classification',
          t('cde.select-data-classification')
        )}
        {tagField(
          'personalDataTags',
          t('cde.personal-data'),
          CDE_TAG_CLASSIFICATIONS.personalData,
          'personal',
          t('cde.select-personal-data')
        )}
        <Form.Item label={t('cde.data-quality-rules')} name="dataQualityRules">
          <SingleClassificationSelect
            dataTestId="cde-data-quality-rules"
            options={[
              { label: t('label.yes'), value: 'true', variant: 'quality' },
              { label: t('label.no'), value: 'false', variant: 'neutral' },
            ]}
            placeholder={t('cde.select-data-quality-rules')}
            searchPlaceholder={t('label.search-for-type', {
              type: t('cde.data-quality-rules'),
            })}
          />
        </Form.Item>
      </GlossaryTermFormSection>

      <GlossaryTermFormSection
        className="cde-form-section-context"
        title={t('cde.business-context')}>
        <Form.Item
          className="cde-form-markdown-editor cde-form-field-full"
          initialValue={
            glossaryTerm?.extension?.entityRelationship ??
            glossaryTerm?.extension?.moi_quan_he_voi_thuc_the ??
            ''
          }
          label={t('cde.entity-relationship')}
          name="entityRelationship"
          trigger="onTextChange">
          <RichTextEditor
            data-testid="cde-entity-relationship"
            initialValue={
              glossaryTerm?.extension?.entityRelationship ??
              glossaryTerm?.extension?.moi_quan_he_voi_thuc_the ??
              ''
            }
            placeHolder={t('cde.entity-relationship-placeholder')}
          />
        </Form.Item>
        <Form.Item
          className="cde-form-markdown-editor cde-form-field-full"
          initialValue={
            glossaryTerm?.extension?.relatedRegulatoryDocuments ??
            glossaryTerm?.extension?.van_ban_quy_dinh_lien_quan ??
            ''
          }
          label={t('cde.related-regulatory-documents')}
          name="relatedRegulatoryDocuments"
          trigger="onTextChange">
          <RichTextEditor
            data-testid="cde-related-regulatory-documents"
            initialValue={
              glossaryTerm?.extension?.relatedRegulatoryDocuments ??
              glossaryTerm?.extension?.van_ban_quy_dinh_lien_quan ??
              ''
            }
            placeHolder={t('cde.related-regulatory-documents-placeholder')}
          />
        </Form.Item>
      </GlossaryTermFormSection>
    </Form>
  );
};

export default CDEGlossaryTermForm;
