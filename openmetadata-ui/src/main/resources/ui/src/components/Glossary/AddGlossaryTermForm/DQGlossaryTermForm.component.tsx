/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Form, FormInstance, Input, Select } from 'antd';
import { isEmpty } from 'lodash';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DATA_DICTIONARY_GLOSSARY_NAME } from '../../../constants/Glossary.contant';
import { EntityType } from '../../../enums/entity.enum';
import { GlossaryTerm, TagLabel, TermRelation } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useEntityRules } from '../../../hooks/useEntityRules';
import TagSuggestion from '../../../pages/TasksPage/shared/TagSuggestion';
import {
  getFirstLevelGlossaryTermsPaginated,
  searchGlossaryTermsPaginated,
} from '../../../rest/glossaryAPI';
import RichTextEditor from '../../common/RichTextEditor/RichTextEditor';
import UserTeamSelectableListSearchInput from '../../common/UserTeamSelectableListSearchInput/UserTeamSelectableListSearchInput.component';
import { DQ_TAG_CLASSIFICATIONS } from '../GlossaryTermTab/DQGlossaryTableColumns';
import {
  AddGlossaryTermFormProps,
  GlossaryTermForm,
} from './AddGlossaryTermForm.interface';

export interface DQGlossaryTermFormValues {
  name?: string;
  displayName?: string;
  description?: string;
  cdeVersion?: string;
  cdeCode?: string;
  cdeName?: string;
  qualityThreshold?: string;
  ruleExplanation?: string;
  otherConstraints?: string;
  exceptions?: string;
  dimensionTags?: TagLabel[];
  dataSourceTags?: TagLabel[];
  targetPopulationTags?: TagLabel[];
  methodTags?: TagLabel[];
  frequencyTags?: TagLabel[];
  owners?: EntityReference[];
  reviewers?: EntityReference[];
}

const DQGlossaryTermForm = ({
  editMode,
  formRef,
  glossaryTerm,
  onSave,
}: AddGlossaryTermFormProps) => {
  const form = formRef as unknown as FormInstance<DQGlossaryTermFormValues>;
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const { entityRules } = useEntityRules(EntityType.GLOSSARY_TERM);
  const owners = Form.useWatch<EntityReference[]>('owners', form) ?? [];
  const reviewers = Form.useWatch<EntityReference[]>('reviewers', form) ?? [];

  const [cdeOptions, setCdeOptions] = useState<GlossaryTerm[]>([]);
  const [isCdeLoading, setIsCdeLoading] = useState(false);

  useEffect(() => {
    const fetchCdeTerms = async () => {
      setIsCdeLoading(true);
      try {
        const response = await getFirstLevelGlossaryTermsPaginated(
          DATA_DICTIONARY_GLOSSARY_NAME,
          1000,
          undefined,
          undefined,
          ['displayName', 'name', 'fullyQualifiedName', 'id', 'description']
        );
        if (response.data && response.data.length > 0) {
          setCdeOptions(response.data as GlossaryTerm[]);
        } else {
          const fallback = await searchGlossaryTermsPaginated({
            glossaryFqn: DATA_DICTIONARY_GLOSSARY_NAME,
            limit: 1000,
          });
          setCdeOptions(fallback.data ?? []);
        }
      } catch {
        try {
          const fallback = await searchGlossaryTermsPaginated({
            glossaryFqn: DATA_DICTIONARY_GLOSSARY_NAME,
            limit: 1000,
          });
          setCdeOptions(fallback.data ?? []);
        } catch {
          setCdeOptions([]);
        }
      } finally {
        setIsCdeLoading(false);
      }
    };

    fetchCdeTerms();
  }, []);

  useEffect(() => {
    if (editMode && glossaryTerm) {
      const tags = glossaryTerm.tags ?? [];
      const extension = glossaryTerm.extension ?? {};

      form.setFieldsValue({
        name: glossaryTerm.name,
        displayName: glossaryTerm.displayName,
        description: glossaryTerm.description,
        owners: glossaryTerm.owners,
        reviewers: glossaryTerm.reviewers,
        cdeVersion:
          extension.cdeVersion ??
          extension.version ??
          extension.phien_ban ??
          '1.0',
        cdeCode: extension.cdeCode,
        cdeName: extension.cdeName,
        qualityThreshold: extension.qualityThreshold,
        ruleExplanation: extension.ruleExplanation,
        otherConstraints: extension.otherConstraints,
        exceptions: extension.exceptions,
        dimensionTags: tags.filter(
          (tag) => tag.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.dimension
        ),
        dataSourceTags: tags.filter(
          (tag) => tag.tagFQN.split('.')[0] === DQ_TAG_CLASSIFICATIONS.dataSource
        ),
        targetPopulationTags: tags.filter(
          (tag) =>
            tag.tagFQN.split('.')[0] ===
            DQ_TAG_CLASSIFICATIONS.targetPopulation
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

  const onCdeSelectChange = (value?: string) => {
    if (!value) {
      form.setFieldsValue({ cdeCode: undefined, cdeName: undefined });

      return;
    }

    const matched = cdeOptions.find(
      (term) =>
        term.name?.toLowerCase() === value.toLowerCase() ||
        term.fullyQualifiedName?.toLowerCase() === value.toLowerCase()
    );

    if (matched) {
      form.setFieldsValue({
        cdeCode: matched.name,
        cdeName: matched.displayName || matched.name,
      });
    } else {
      form.setFieldsValue({
        cdeCode: value,
      });
    }
  };

  const onFinish = async (values: DQGlossaryTermFormValues) => {
    const currentOwners = (owners ?? []).filter(Boolean);
    const currentReviewers = (reviewers ?? []).filter(Boolean);

    const formTags = [
      values.dimensionTags,
      values.dataSourceTags,
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

    const matchedCdeTerm = cdeOptions.find(
      (term) =>
        term.name?.toLowerCase() === values.cdeCode?.toLowerCase() ||
        term.fullyQualifiedName?.toLowerCase() === values.cdeCode?.toLowerCase()
    );

    const extension = {
      ...(values.cdeCode?.trim()
        ? { cdeCode: values.cdeCode.trim() }
        : {}),
      ...(values.cdeName?.trim() || matchedCdeTerm
        ? {
            cdeName:
              values.cdeName?.trim() ||
              matchedCdeTerm?.displayName ||
              matchedCdeTerm?.name ||
              '',
          }
        : {}),
      ...(values.cdeVersion?.trim()
        ? { cdeVersion: values.cdeVersion.trim() }
        : { cdeVersion: '1.0' }),
      ...(values.qualityThreshold?.trim()
        ? { qualityThreshold: values.qualityThreshold.trim() }
        : {}),
      ...(values.ruleExplanation?.trim()
        ? { ruleExplanation: values.ruleExplanation.trim() }
        : {}),
      ...(values.otherConstraints?.trim()
        ? { otherConstraints: values.otherConstraints.trim() }
        : {}),
      ...(values.exceptions?.trim()
        ? { exceptions: values.exceptions.trim() }
        : {}),
    };

    const currentRelatedTerms = (glossaryTerm?.relatedTerms ??
      []) as Array<TermRelation | EntityReference>;
    const nonCdeRelatedTerms = currentRelatedTerms.filter((rel) => {
      const term = (rel as TermRelation)?.term ?? (rel as EntityReference);

      return !term?.fullyQualifiedName?.includes(DATA_DICTIONARY_GLOSSARY_NAME);
    });

    const updatedRelatedTerms: string[] = nonCdeRelatedTerms
      .map((rel) => {
        const term = (rel as TermRelation)?.term ?? (rel as EntityReference);

        return term?.id;
      })
      .filter(Boolean) as string[];

    if (matchedCdeTerm?.id) {
      updatedRelatedTerms.push(matchedCdeTerm.id);
    }

    await onSave({
      name: String(values.name ?? '').trim(),
      displayName: String(values.displayName ?? '').trim(),
      description: String(values.description ?? ''),
      domains: undefined,
      owners: currentOwners.length
        ? currentOwners
        : [{ id: currentUser?.id ?? '', type: 'user' }],
      reviewers: currentReviewers,
      tags: allTags,
      synonyms: [],
      references: undefined,
      relatedTerms: updatedRelatedTerms,
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
    <Form<DQGlossaryTermFormValues>
      className={`cde-glossary-term-form dq-glossary-term-form cde-glossary-term-form--${
        editMode ? 'edit' : 'add'
      }`}
      form={form}
      initialValues={{ cdeVersion: '1.0' }}
      layout="vertical"
      onFinish={onFinish}>
      {/* Khối 1: Thông tin quy tắc nghiệp vụ */}
      <section className="cde-form-section">
        <div className="cde-form-section-title">
          {t('dq.section.business-rule-info', 'Thông tin quy tắc nghiệp vụ')}
        </div>
        <div className="cde-form-grid">
          <Form.Item
            required
            label={t('dq.rule-code', 'Mã quy tắc CLDL')}
            name="name"
            rules={[{ required: true, whitespace: true }]}>
            <Input data-testid="dq-rule-code" placeholder="Ví dụ: DQ1.1, DQ3.1..." />
          </Form.Item>
          <Form.Item
            label={t('dq.rule-name', 'Tên quy tắc CLDL')}
            name="displayName">
            <Input
              data-testid="dq-rule-name"
              placeholder="Ví dụ: DQ1.1 - Tính chính xác (Tên khách hàng)"
            />
          </Form.Item>
          <Form.Item
            required
            label={t('cde.version', 'Phiên bản')}
            name="cdeVersion"
            rules={[{ required: true, whitespace: true }]}>
            <Input data-testid="dq-version" placeholder="1.0" />
          </Form.Item>

          <Form.Item
            label={t('dq.cde-code', 'Mã CDE liên kết')}
            name="cdeCode">
            <Select
              allowClear
              showSearch
              data-testid="dq-cde-select"
              loading={isCdeLoading}
              optionFilterProp="label"
              options={cdeOptions.map((cde) => ({
                label: `${cde.name} - ${cde.displayName || cde.name}`,
                value: cde.name,
              }))}
              placeholder="Chọn CDE từ Từ điển dữ liệu dùng chung"
              onChange={onCdeSelectChange}
            />
          </Form.Item>

          <Form.Item
            label={t('dq.cde-name', 'Tên thành tố CDE')}
            name="cdeName">
            <Input
              data-testid="dq-cde-name"
              placeholder="Tên thành tố CDE tự động điền"
            />
          </Form.Item>

          {tagField(
            'dimensionTags',
            t('dq.dimension', 'Tiêu chí đánh giá CLDL'),
            DQ_TAG_CLASSIFICATIONS.dimension,
            'classification'
          )}

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
        </div>
      </section>

      {/* Khối 2: Điều kiện & Phạm vi đánh giá */}
      <section className="cde-form-section">
        <div className="cde-form-section-title">
          {t('dq.section.assessment-scope', 'Điều kiện & Phạm vi đánh giá')}
        </div>
        <div className="cde-form-grid">
          <Form.Item
            label={t('dq.quality-threshold', 'Ngưỡng chất lượng dữ liệu')}
            name="qualityThreshold">
            <Input
              data-testid="dq-quality-threshold"
              placeholder="Ví dụ: 100%, 99.0%, 95%..."
            />
          </Form.Item>
          {tagField(
            'dataSourceTags',
            t('cde.data-source', 'Hệ thống nguồn'),
            DQ_TAG_CLASSIFICATIONS.dataSource,
            'source'
          )}
          {tagField(
            'frequencyTags',
            t('dq.frequency', 'Tần suất kiểm tra CLDL'),
            DQ_TAG_CLASSIFICATIONS.frequency,
            'neutral'
          )}
          {tagField(
            'targetPopulationTags',
            t('dq.target-population', 'Tiêu chí cơ sở (Tập dữ liệu)'),
            DQ_TAG_CLASSIFICATIONS.targetPopulation,
            'personal'
          )}
          {tagField(
            'methodTags',
            t('dq.method', 'Hình thức kiểm tra CLDL'),
            DQ_TAG_CLASSIFICATIONS.method,
            'neutral'
          )}
        </div>
      </section>

      {/* Khối 3: Diễn giải & Ràng buộc */}
      <section className="cde-form-section">
        <div className="cde-form-section-title">
          {t('dq.section.explanation-and-constraints', 'Diễn giải & Ràng buộc')}
        </div>
        <div className="cde-form-grid">
          <Form.Item
            className="cde-form-field-full"
            label={t('dq.rule-explanation', 'Diễn giải quy tắc nghiệp vụ')}
            name="ruleExplanation">
            <Input.TextArea
              data-testid="dq-rule-explanation"
              placeholder="Diễn giải chi tiết quy tắc nghiệp vụ và ngữ cảnh áp dụng..."
              rows={3}
            />
          </Form.Item>
          <Form.Item
            className="cde-form-field-full"
            label={t('dq.other-constraints', 'Ràng buộc / Yêu cầu khác')}
            name="otherConstraints">
            <Input.TextArea
              data-testid="dq-other-constraints"
              placeholder="Các ràng buộc kỹ thuật, kiểm tra Not Null, định dạng Date..."
              rows={2}
            />
          </Form.Item>
          <Form.Item
            className="cde-form-field-full"
            label={t('dq.exceptions', 'Dấu hiệu ngoại lệ')}
            name="exceptions">
            <Input.TextArea
              data-testid="dq-exceptions"
              placeholder="Dấu hiệu nhận biết các trường hợp ngoại lệ không vi phạm..."
              rows={2}
            />
          </Form.Item>
        </div>
      </section>

      {/* Khối 4: Quản trị & Phê duyệt */}
      <section className="cde-form-section">
        <div className="cde-form-section-title">
          {t('label.governance', 'Quản trị & Phê duyệt')}
        </div>
        <div className="cde-form-grid">
          <Form.Item label={t('cde.data-owner', 'Chủ sở hữu dữ liệu')} name="owners">
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
          <Form.Item
            className="cde-form-field-full"
            label={t('label.reviewer-plural', 'Người kiểm duyệt')}
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

export default DQGlossaryTermForm;
