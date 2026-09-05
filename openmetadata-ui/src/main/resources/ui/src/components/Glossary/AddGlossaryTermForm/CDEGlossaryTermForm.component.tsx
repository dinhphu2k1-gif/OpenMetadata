/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { DownOutlined } from '@ant-design/icons';
import { Button, Form, FormInstance, Input, Select } from 'antd';
import { isEmpty } from 'lodash';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { TagLabel } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useEntityRules } from '../../../hooks/useEntityRules';
import TagSuggestion from '../../../pages/TasksPage/shared/TagSuggestion';
import { getEntityName } from '../../../utils/EntityNameUtils';
import DomainSelectableList from '../../common/DomainSelectableList/DomainSelectableList.component';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import UserTeamSelectableListSearchInput from '../../common/UserTeamSelectableListSearchInput/UserTeamSelectableListSearchInput.component';
import { CDE_TAG_CLASSIFICATIONS } from '../GlossaryTermTab/CDEGlossaryTableColumns';
import {
  AddGlossaryTermFormProps,
  GlossaryTermForm,
} from './AddGlossaryTermForm.interface';

export interface CDEGlossaryTermFormValues {
  name?: string;
  displayName?: string;
  description?: string;
  cdeVersion?: string;
  phien_ban?: string;
  domains?: EntityReference[];
  owners?: EntityReference[];
  reviewers?: EntityReference[];
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
  const reviewers = Form.useWatch<EntityReference[]>('reviewers', form) ?? [];
  const domainLabel = domains.length
    ? domains
      .filter(Boolean)
      .map(
        (domain) =>
          getEntityName(domain) || domain.fullyQualifiedName || ''
      )
      .filter(Boolean)
      .join(', ') || t('label.select-entity', { entity: t('label.domain-plural') })
    : t('label.select-entity', { entity: t('label.domain-plural') });

  useEffect(() => {
    if (editMode && glossaryTerm) {
      const tags = glossaryTerm.tags ?? [];
      form.setFieldsValue({
        name: glossaryTerm.name,
        displayName: glossaryTerm.displayName,
        description: glossaryTerm.description,
        domains: glossaryTerm.domains,
        owners: glossaryTerm.owners,
        reviewers: glossaryTerm.reviewers,
        dataSourceTags: tags.filter(
          (tag) => tag.tagFQN.split('.')[0] === CDE_TAG_CLASSIFICATIONS.dataSource
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
                      String(glossaryTerm.extension.dataQualityRules).trim().toUpperCase()
                    )
              )
            : glossaryTerm.extension?.quy_dinh_chat_luong_du_lieu !== undefined &&
              glossaryTerm.extension?.quy_dinh_chat_luong_du_lieu !== null
            ? String(
                Array.isArray(glossaryTerm.extension.quy_dinh_chat_luong_du_lieu)
                  ? glossaryTerm.extension.quy_dinh_chat_luong_du_lieu.includes('Y') ||
                      glossaryTerm.extension.quy_dinh_chat_luong_du_lieu.includes('true')
                  : ['1', 'TRUE', 'Y', 'YES', 'CO', 'CÓ'].includes(
                      String(glossaryTerm.extension.quy_dinh_chat_luong_du_lieu).trim().toUpperCase()
                    )
              )
            : undefined,
        relatedRegulatoryDocuments:
          glossaryTerm.extension?.relatedRegulatoryDocuments ??
          glossaryTerm.extension?.van_ban_quy_dinh_lien_quan,
        entityRelationship:
          glossaryTerm.extension?.entityRelationship ??
          glossaryTerm.extension?.moi_quan_he_voi_thuc_the,
        cdeVersion:
          glossaryTerm.extension?.cdeVersion ??
          glossaryTerm.extension?.phien_ban ??
          '1.0',
      });
    }
  }, [editMode, form, glossaryTerm]);

  const onFinish = async (values: CDEGlossaryTermFormValues) => {
    const currentOwners = (owners ?? []).filter(Boolean);
    const currentDomains = (domains ?? []).filter(Boolean);
    const currentReviewers = (reviewers ?? []).filter(Boolean);

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

    const versionVal = values.cdeVersion?.trim();

    const extension = {
      ...(versionVal ? { cdeVersion: versionVal } : {}),
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
    };

    await onSave({
      name: String(values.name ?? '').trim(),
      displayName: String(values.displayName ?? '').trim(),
      description: String(values.description ?? ''),
      domains: currentDomains,
      owners: currentOwners.length
        ? currentOwners
        : [{ id: currentUser?.id ?? '', type: 'user' }],
      reviewers: currentReviewers,
      tags: allTags,
      synonyms: [],
      references: undefined,
      relatedTerms: undefined,
      mutuallyExclusive: false,
      style: undefined,
      extension: isEmpty(extension) ? undefined : extension,
    } as GlossaryTermForm);
  };

  const tagField = (
    name: string,
    label: string,
    classification: string,
    tone: string
  ) => (
    <Form.Item className={`cde-form-tag-${tone}`} label={label} name={name}>
      <TagSuggestion classificationFilter={classification} />
    </Form.Item>
  );

  return (
    <Form<CDEGlossaryTermFormValues>
      className={`cde-glossary-term-form cde-glossary-term-form--${editMode ? 'edit' : 'add'
        }`}
      form={form}
      initialValues={{ cdeVersion: '1.0' }}
      layout="vertical"
      onFinish={onFinish}>
      <section className="cde-form-section">
        {editMode && (
          <div className="cde-form-section-title">
            {t('cde.core-definition')}
          </div>
        )}
        <div className="cde-form-grid">
          <Form.Item
            required
            label={t('cde.term-code')}
            name="name"
            rules={[{ required: true, whitespace: true }]}>
            <Input data-testid="cde-term-code" />
          </Form.Item>
          <Form.Item label={t('cde.business-term-name')} name="displayName">
            <Input data-testid="cde-business-term-name" />
          </Form.Item>
          <Form.Item
            required
            label={t('cde.version')}
            name="cdeVersion"
            rules={[{ required: true, whitespace: true }]}>
            <Input data-testid="cde-version" placeholder="1.0" />
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
            />
          </Form.Item>
        </div>
      </section>

      <section className="cde-form-section">
        {editMode && (
          <div className="cde-form-section-title">
            {t('cde.business-context')}
          </div>
        )}
        <div className="cde-form-grid">
          <Form.Item
            label={t('cde.business-group')}
            name="domains">
            <DomainSelectableList
              hasPermission
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
              <Button
                className="cde-form-select-trigger"
                data-testid="cde-business-group">
                <span className="cde-form-select-trigger-value">
                  {domainLabel}
                </span>
                <DownOutlined />
              </Button>
            </DomainSelectableList>
          </Form.Item>
          {tagField(
            'dataSourceTags',
            t('cde.data-source'),
            CDE_TAG_CLASSIFICATIONS.dataSource,
            'source'
          )}
          <Form.Item label={t('cde.data-owner')} name="owners">
            <UserTeamSelectableListSearchInput
              hasPermission
              multiple={{
                user: entityRules.canAddMultipleUserOwners,
                team: entityRules.canAddMultipleTeamOwner,
              }}
              owner={owners}
              placeholder={t('label.select')}
              onUpdate={async (value) => form.setFieldValue('owners', value)}
            />
          </Form.Item>
          {tagField(
            'dataClassificationTags',
            t('cde.data-classification'),
            CDE_TAG_CLASSIFICATIONS.dataClassification,
            'classification'
          )}
          {tagField(
            'personalDataTags',
            t('cde.personal-data'),
            CDE_TAG_CLASSIFICATIONS.personalData,
            'personal'
          )}
          <Form.Item
            label={t('cde.data-quality-rules')}
            name="dataQualityRules">
            <Select
              allowClear
              options={[
                { label: t('label.yes'), value: 'true' },
                { label: t('label.no'), value: 'false' },
              ]}
            />
          </Form.Item>
        </div>
      </section>

      <section className="cde-form-section">
        {editMode && (
          <div className="cde-form-section-title">
            {t('label.governance')}
          </div>
        )}
        <div className="cde-form-grid">
          <Form.Item
            label={t('cde.entity-relationship')}
            name="entityRelationship">
            <Input data-testid="cde-entity-relationship" />
          </Form.Item>
          <Form.Item
            label={t('cde.related-regulatory-documents')}
            name="relatedRegulatoryDocuments">
            <Input data-testid="cde-related-regulatory-documents" />
          </Form.Item>
          <Form.Item
            className="cde-form-field-full"
            label={t('label.reviewer-plural')}
            name="reviewers">
            <UserTeamSelectableListSearchInput
              hasPermission
              multiple={{ user: true, team: true }}
              owner={reviewers}
              placeholder={t('label.select')}
              onUpdate={async (value) =>
                form.setFieldValue('reviewers', value)
              }
            />
          </Form.Item>
        </div>
      </section>
    </Form>
  );
};

export default CDEGlossaryTermForm;
