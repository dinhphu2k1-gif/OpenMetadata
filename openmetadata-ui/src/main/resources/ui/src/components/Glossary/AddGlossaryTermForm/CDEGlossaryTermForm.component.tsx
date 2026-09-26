/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { DownOutlined } from '@ant-design/icons';
import { Form, FormInstance, Input, Select, Tag } from 'antd';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { getCDEReleaseLevelValue } from '../../../constants/CDEReleaseLevel.constants';
import { EntityType } from '../../../enums/entity.enum';
import { TagLabel } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { mergeCDEDates, validateCDEDates } from '../../../utils/CDEDateUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import DatePicker from '../../common/DatePicker/DatePicker';
import DomainSelectableList from '../../common/DomainSelectableList/DomainSelectableList.component';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import { TagSelectableList } from '../../common/TagSelectableList/TagSelectableList.component';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import {
  CDE_TAG_CLASSIFICATIONS,
  renderCDEClassificationTags,
  renderCDEOwners,
} from '../GlossaryTermTab/CDEGlossaryTableColumns';
import {
  AddGlossaryTermFormProps,
  GlossaryTermForm,
} from './AddGlossaryTermForm.interface';

export interface CDEGlossaryTermFormValues {
  name?: string;
  displayName?: string;
  description?: string;
  version?: string;
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

interface CDEFormSectionProps {
  children: ReactNode;
  className?: string;
  title: string;
}

const CDEFormSection = ({
  children,
  className = '',
  title,
}: CDEFormSectionProps) => (
  <section className={`cde-form-section ${className}`}>
    <header className="cde-form-section-header">
      <span aria-hidden="true" className="cde-form-section-marker" />
      <h3 className="cde-form-section-title">{title}</h3>
    </header>
    <div className="cde-form-grid">{children}</div>
  </section>
);

type CDEFormSelectTriggerProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> & {
  content?: ReactNode;
  placeholder: string;
  values?: string[];
};

const CDEFormSelectTrigger = forwardRef<
  HTMLDivElement,
  CDEFormSelectTriggerProps
>(
  (
    { className, content, onKeyDown, placeholder, values = [], ...props },
    ref
  ) => {
    const displayValue = values.filter(Boolean).join(', ');
    const hasValue = Boolean(content || displayValue);

    return (
      <div
        {...props}
        className={`cde-form-select-trigger ${
          hasValue ? 'cde-form-select-trigger--populated' : ''
        } ${className ?? ''}`}
        ref={ref}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && ['Enter', ' '].includes(event.key)) {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}>
        <span className="cde-form-select-trigger-value">
          {content || displayValue || placeholder}
        </span>
        <DownOutlined />
      </div>
    );
  }
);

CDEFormSelectTrigger.displayName = 'CDEFormSelectTrigger';

interface CDETagSelectorProps {
  classification: string;
  placeholder: string;
  searchPlaceholder: string;
  variant: 'classification' | 'personal' | 'source';
  value?: TagLabel[];
  onChange?: (tags: TagLabel[]) => void;
}

const CDETagSelector = ({
  classification,
  onChange,
  placeholder,
  searchPlaceholder,
  variant,
  value = [],
}: CDETagSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <TagSelectableList
      classificationFilter={classification}
      hasPermission
      popoverProps={{
        open: isOpen,
        overlayClassName: 'cde-tag-select-popover',
        placement: 'bottomLeft',
        onOpenChange: setIsOpen,
      }}
      searchPlaceholder={searchPlaceholder}
      selectedTags={value}
      onCancel={() => setIsOpen(false)}
      onUpdate={async (tags) => {
        onChange?.(tags);
        setIsOpen(false);
      }}>
      <CDEFormSelectTrigger
        content={
          value.length
            ? renderCDEClassificationTags(value, classification, variant)
            : undefined
        }
        placeholder={placeholder}
      />
    </TagSelectableList>
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
        .join(', ') ||
      t('cde.select-business-group')
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
        ...(values.releaseLevel
          ? { releaseLevel: [values.releaseLevel] }
          : {}),
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
      initialValues={{ version: '1.0' }}
      layout="vertical"
      onFinish={onFinish}>
      <CDEFormSection
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
        <Form.Item
          required
          className="cde-form-version"
          label={t('cde.version')}
          name="version"
          rules={[{ required: true, whitespace: true }]}>
          <Input disabled data-testid="cde-version" placeholder="1.0" />
        </Form.Item>
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
      </CDEFormSection>

      <CDEFormSection
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
          <Select
            allowClear
            className="cde-form-enum-select"
            data-testid="cde-release-level"
            dropdownClassName="cde-enum-field-dropdown"
            getPopupContainer={() => document.body}
            options={[
              {
                displayLabel: (
                  <Tag className="cde-value-pill cde-value-pill-release">
                    {t('cde.release-level-ceo')}
                  </Tag>
                ),
                label: t('cde.release-level-ceo'),
                value: 'CEO',
              },
              {
                displayLabel: (
                  <Tag className="cde-value-pill cde-value-pill-release">
                    {t('cde.release-level-ttqldl')}
                  </Tag>
                ),
                label: t('cde.release-level-ttqldl'),
                value: 'TTQLDL',
              },
            ]}
            optionLabelProp="displayLabel"
            placeholder={t('cde.select-release-level')}
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
      </CDEFormSection>

      <CDEFormSection
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
          <Select
            allowClear
            className="cde-form-enum-select"
            dropdownClassName="cde-enum-field-dropdown"
            getPopupContainer={() => document.body}
            options={[
              {
                displayLabel: (
                  <Tag className="cde-value-pill cde-value-pill-quality">
                    {t('label.yes')}
                  </Tag>
                ),
                label: t('label.yes'),
                value: 'true',
              },
              {
                displayLabel: (
                  <Tag className="cde-value-pill cde-value-pill-neutral">
                    {t('label.no')}
                  </Tag>
                ),
                label: t('label.no'),
                value: 'false',
              },
            ]}
            optionLabelProp="displayLabel"
            placeholder={t('cde.select-data-quality-rules')}
          />
        </Form.Item>
      </CDEFormSection>

      <CDEFormSection
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
      </CDEFormSection>
    </Form>
  );
};

export default CDEGlossaryTermForm;
