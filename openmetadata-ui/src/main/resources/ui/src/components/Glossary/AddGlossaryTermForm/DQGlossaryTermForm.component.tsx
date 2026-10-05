/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Form, FormInstance, Input, Select } from 'antd';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DATA_DICTIONARY_GLOSSARY_NAME } from '../../../constants/Glossary.contant';
import {
  GlossaryTerm,
  TagLabel,
  TermRelation,
} from '../../../generated/entity/data/glossaryTerm';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import DatePicker from '../../common/DatePicker/DatePicker';
import CDESelector from '../CDESelector/CDESelector.component';
import { CDE_RELEASE_LEVEL_OPTIONS } from '../../../constants/CDEReleaseLevel.constants';
import { validateCDEDates } from '../../../utils/CDEDateUtils';
import { getCDEReleaseVersionType } from '../../../utils/CDEReleaseVersionTypeUtils';
import { DQ_TAG_CLASSIFICATIONS } from '../GlossaryTermTab/DQGlossaryTableColumns';
import {
  AddGlossaryTermFormProps,
  GlossaryTermForm,
} from './AddGlossaryTermForm.interface';
import { CDETagSelector } from './CDEGlossaryTermForm.component';
import GlossaryTermFormSection from './GlossaryTermFormSection.component';
import GovernedVersionFields from './GovernedVersionFields.component';

export interface DQGlossaryTermFormValues {
  name?: string;
  displayName?: string;
  description?: string;
  version?: string;
  cdeCode?: string;
  cdeName?: string;
  qualityThreshold?: string;
  ruleExplanation?: string;
  otherConstraints?: string;
  relatedRegulatoryDocuments?: string;
  dimensionTags?: TagLabel[];
  targetPopulationTags?: TagLabel[];
  methodTags?: TagLabel[];
  frequencyTags?: TagLabel[];
  releaseVersionType?: string;
  releaseLevel?: string;
  effectiveDate?: DateTime | null;
  expirationDate?: DateTime | null;
}

interface DQGlossaryTermFormProps extends AddGlossaryTermFormProps {
  parentBusinessVersion?: string;
}

const DQGlossaryTermForm = ({
  editMode,
  formRef,
  glossaryTerm,
  onSave,
  parentBusinessVersion,
}: DQGlossaryTermFormProps) => {
  const form = formRef as unknown as FormInstance<DQGlossaryTermFormValues>;
  const { t } = useTranslation();

  const existingCdeRelation = glossaryTerm?.relatedTerms?.find((relation) =>
    relation.term?.fullyQualifiedName?.includes(DATA_DICTIONARY_GLOSSARY_NAME)
  );
  const [selectedCde, setSelectedCde] = useState<GlossaryTerm | undefined>(
    existingCdeRelation?.term as GlossaryTerm | undefined
  );

  useEffect(() => {
    if (editMode && glossaryTerm) {
      const tags = glossaryTerm.tags ?? [];
      const extension = glossaryTerm.extension ?? {};
      const relatedCde = glossaryTerm.relatedTerms?.find((relation) =>
        relation.term?.fullyQualifiedName?.includes(
          DATA_DICTIONARY_GLOSSARY_NAME
        )
      )?.term;

      setSelectedCde(relatedCde as GlossaryTerm | undefined);

      form.setFieldsValue({
        name: glossaryTerm.name,
        displayName: glossaryTerm.displayName,
        description: glossaryTerm.description,
        version: glossaryTerm.businessVersion ?? '1.0',
        cdeCode: relatedCde?.name ?? extension.cdeCode,
        cdeName:
          relatedCde?.displayName ?? relatedCde?.name ?? extension.cdeName,
        qualityThreshold: extension.qualityThreshold,
        ruleExplanation: extension.ruleExplanation,
        otherConstraints: extension.otherConstraints,
        relatedRegulatoryDocuments:
          extension.relatedRegulatoryDocuments ??
          extension.van_ban_quy_dinh_lien_quan,
        releaseVersionType: getCDEReleaseVersionType(
          extension.releaseVersionType,
          glossaryTerm.businessVersion
        ),
        releaseLevel: Array.isArray(extension.releaseLevel)
          ? extension.releaseLevel[0]
          : extension.releaseLevel,
        effectiveDate: extension.effectiveDate
          ? DateTime.fromISO(extension.effectiveDate)
          : null,
        expirationDate: extension.expirationDate
          ? DateTime.fromISO(extension.expirationDate)
          : null,
        dimensionTags: tags.filter(
          (tag) => tag.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.dimension
        ),
        targetPopulationTags: tags.filter(
          (tag) =>
            tag.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.targetPopulation
        ),
        methodTags: tags.filter(
          (tag) => tag.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.method
        ),
        frequencyTags: tags.filter(
          (tag) => tag.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.frequency
        ),
      });
    }
  }, [editMode, form, glossaryTerm]);

  const onCdeSelectChange = (value?: string, cde?: GlossaryTerm) => {
    setSelectedCde(cde);
    if (!value || !cde) {
      form.setFieldsValue({ cdeCode: undefined, cdeName: undefined });

      return;
    }

    form.setFieldsValue({
      cdeCode: cde.name,
      cdeName: cde.displayName || cde.name,
    });
  };

  const onFinish = async (values: DQGlossaryTermFormValues) => {
    const formTags = [
      values.dimensionTags,
      values.targetPopulationTags,
      values.methodTags,
      values.frequencyTags,
    ].flatMap((tags) => tags ?? []);

    const existingNonDQTags = (glossaryTerm?.tags ?? []).filter(
      (tag) =>
        !Object.values(DQ_TAG_CLASSIFICATIONS).includes(
          tag.tagFQN.split('.')[0]
        )
    );

    const allTags = [...existingNonDQTags, ...formTags];

    const existingExtension = Object.fromEntries(
      Object.entries(glossaryTerm?.extension ?? {}).filter(
        ([key]) =>
          ![
            'ruleCode',
            'cdeCode',
            'cdeName',
            'releaseVersionType',
            'relatedRegulatoryDocuments',
            'van_ban_quy_dinh_lien_quan',
          ].includes(key)
      )
    );
    const extension: Record<string, unknown> = {
      ...existingExtension,
      ...(values.qualityThreshold?.trim()
        ? { qualityThreshold: values.qualityThreshold.trim() }
        : {}),
      ...(values.ruleExplanation?.trim()
        ? { ruleExplanation: values.ruleExplanation.trim() }
        : {}),
      ...(values.otherConstraints?.trim()
        ? { otherConstraints: values.otherConstraints.trim() }
        : {}),
      ...(values.relatedRegulatoryDocuments?.trim()
        ? {
            relatedRegulatoryDocuments:
              values.relatedRegulatoryDocuments.trim(),
          }
        : {}),
      ...(values.releaseLevel ? { releaseLevel: [values.releaseLevel] } : {}),
      ...(values.effectiveDate
        ? { effectiveDate: values.effectiveDate.toFormat('yyyy-MM-dd') }
        : {}),
      ...(values.expirationDate
        ? { expirationDate: values.expirationDate.toFormat('yyyy-MM-dd') }
        : {}),
    };
    const editableExtensionValues = {
      qualityThreshold: values.qualityThreshold,
      ruleExplanation: values.ruleExplanation,
      otherConstraints: values.otherConstraints,
      relatedRegulatoryDocuments: values.relatedRegulatoryDocuments,
      releaseLevel: values.releaseLevel,
      effectiveDate: values.effectiveDate,
      expirationDate: values.expirationDate,
    };
    Object.entries(editableExtensionValues).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        delete extension[key];
      }
    });

    // A DQ rule has one and only one governed relation: its canonical CDE.
    // Do not carry generic/legacy related-term values forward here. In
    // particular, a malformed self-reference would otherwise be submitted as
    // if the DQ rule itself were a CDE during workflow validation.
    const updatedRelatedTerms: TermRelation[] = [];

    if (selectedCde?.id) {
      updatedRelatedTerms.push({
        relationType: 'relatedTo',
        term: {
          id: selectedCde.id,
          type: 'glossaryTerm',
          name: selectedCde.name,
          displayName: selectedCde.displayName,
          fullyQualifiedName: selectedCde.fullyQualifiedName,
        },
      });
    }

    await onSave({
      businessVersion: values.version?.trim() || '1.0',
      name: String(values.name ?? '').trim(),
      displayName: String(values.displayName ?? '').trim(),
      description: String(values.description ?? ''),
      domains: undefined,
      owners: glossaryTerm?.owners ?? [],
      tags: allTags,
      synonyms: [],
      references: undefined,
      relatedTerms: undefined,
      versionedRelatedTerms: updatedRelatedTerms,
      mutuallyExclusive: false,
      style: undefined,
      extension: isEmpty(extension) ? undefined : extension,
    } as GlossaryTermForm);
  };

  const tagField = (
    name: string,
    label: string,
    classification: string,
    variant: 'classification' | 'personal' | 'source'
  ) => (
    <Form.Item label={label} name={name}>
      <CDETagSelector
        classification={classification}
        placeholder={t('label.select-field', { field: label })}
        searchPlaceholder={t('label.search-for-type', { type: label })}
        variant={variant}
      />
    </Form.Item>
  );

  return (
    <Form<DQGlossaryTermFormValues>
      className={`cde-glossary-term-form dq-glossary-term-form cde-glossary-term-form--${
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
        title={t('cde.basic-information', 'Thông tin cơ bản')}>
        <Form.Item
          required
          label={t('dq.rule-code', 'Mã quy tắc CLDL')}
          name="name"
          rules={[{ required: true, whitespace: true }]}>
          <Input
            data-testid="dq-rule-code"
            placeholder="Ví dụ: DQ1.1, DQ3.1..."
          />
        </Form.Item>
        <Form.Item
          label={t('dq.rule-name', 'Tên quy tắc CLDL')}
          name="displayName">
          <Input
            data-testid="dq-rule-name"
            placeholder="Ví dụ: DQ1.1 - Tính chính xác (Tên khách hàng)"
          />
        </Form.Item>
        <GovernedVersionFields
          versionRequired
          releaseVersionTypeLabel={t(
            'dq.release-version-type',
            'Loại phiên bản phát hành'
          )}
          releaseVersionTypeTestId="dq-release-version-type"
          versionLabel={t('cde.version', 'Phiên bản')}
          versionTestId="dq-version"
        />

        <Form.Item
          required
          className="cde-form-business-meaning cde-form-field-full"
          initialValue={glossaryTerm?.description ?? ''}
          label={t('dq.rule-statement', 'Quy tắc nghiệp vụ về CLDL')}
          name="description"
          rules={[{ required: true, whitespace: true }]}
          trigger="onTextChange">
          <RichTextEditor
            data-testid="dq-rule-statement"
            initialValue={glossaryTerm?.description ?? ''}
          />
        </Form.Item>
      </GlossaryTermFormSection>

      <GlossaryTermFormSection
        className="cde-form-section-management"
        title={t('cde.management-information', 'Thông tin quản lý')}>
        <Form.Item label={t('dq.cde-code', 'Mã CDE liên kết')}>
          <CDESelector
            parentBusinessVersion={
              glossaryTerm?.parentBusinessVersion ?? parentBusinessVersion
            }
            selectedCde={selectedCde}
            onChange={onCdeSelectChange}
          />
        </Form.Item>
        <Form.Item label={t('dq.cde-name', 'Tên thành tố CDE')} name="cdeName">
          <Input
            disabled
            data-testid="dq-cde-name"
            placeholder="Tên thành tố CDE tự động điền"
          />
        </Form.Item>
        <Form.Item
          className="dq-form-release-level cde-form-field-full"
          label={t('cde.release-level')}
          name="releaseLevel">
          <Select
            allowClear
            className="cde-form-enum-select"
            options={CDE_RELEASE_LEVEL_OPTIONS}
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

                  return error
                    ? Promise.reject(new Error(t(error)))
                    : Promise.resolve();
                },
              }),
            ]}>
            <DatePicker
              allowClear
              data-testid={`dq-${key}`}
              format="dd/MM/yyyy"
              placeholder={t('cde.select-date')}
            />
          </Form.Item>
        ))}
      </GlossaryTermFormSection>

      <GlossaryTermFormSection
        className="cde-form-section-classification"
        title={t('cde.classification-control', 'Phân loại và kiểm soát')}>
        {tagField(
          'dimensionTags',
          t('dq.dimension', 'Tiêu chí chất lượng dữ liệu'),
          DQ_TAG_CLASSIFICATIONS.dimension,
          'classification'
        )}
        {tagField(
          'targetPopulationTags',
          t('dq.target-population', 'Các tiêu chí cơ sở'),
          DQ_TAG_CLASSIFICATIONS.targetPopulation,
          'personal'
        )}
        {tagField(
          'methodTags',
          t('dq.method', 'Hình thức kiểm tra'),
          DQ_TAG_CLASSIFICATIONS.method,
          'source'
        )}
        {tagField(
          'frequencyTags',
          t('dq.frequency', 'Tần suất'),
          DQ_TAG_CLASSIFICATIONS.frequency,
          'source'
        )}
        <Form.Item
          label={t('dq.quality-threshold', 'Ngưỡng chất lượng dữ liệu')}
          name="qualityThreshold">
          <Input
            data-testid="dq-quality-threshold"
            placeholder="Ví dụ: >= 99.5%, = 100%, count = 0"
          />
        </Form.Item>
      </GlossaryTermFormSection>

      <GlossaryTermFormSection
        className="cde-form-section-context"
        title={t('cde.business-context', 'Ngữ cảnh nghiệp vụ')}>
        <Form.Item
          className="cde-form-markdown-editor cde-form-field-full"
          initialValue={glossaryTerm?.extension?.ruleExplanation ?? ''}
          label={t('dq.rule-explanation', 'Diễn giải quy tắc nghiệp vụ')}
          name="ruleExplanation"
          trigger="onTextChange">
          <RichTextEditor
            data-testid="dq-rule-explanation"
            initialValue={glossaryTerm?.extension?.ruleExplanation ?? ''}
            placeHolder="Diễn giải chi tiết quy tắc nghiệp vụ và ngữ cảnh áp dụng..."
          />
        </Form.Item>
        <Form.Item
          className="cde-form-markdown-editor cde-form-field-full"
          initialValue={glossaryTerm?.extension?.otherConstraints ?? ''}
          label={t('dq.other-constraints', 'Ràng buộc / Yêu cầu khác')}
          name="otherConstraints"
          trigger="onTextChange">
          <RichTextEditor
            data-testid="dq-other-constraints"
            initialValue={glossaryTerm?.extension?.otherConstraints ?? ''}
            placeHolder="Các ràng buộc kỹ thuật, kiểm tra Not Null, định dạng Date..."
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
            data-testid="dq-related-regulatory-documents"
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

export default DQGlossaryTermForm;
