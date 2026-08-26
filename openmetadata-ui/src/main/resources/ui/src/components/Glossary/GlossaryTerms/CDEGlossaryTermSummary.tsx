/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { Col, Popover, Row, Select, Tag, Typography } from 'antd';
import { EntityTags } from 'Models';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { TagSource } from '../../../generated/type/tagLabel';
import { createTagObject } from '../../../utils/TagsUtils';
import DomainSelectableList from '../../common/DomainSelectableList/DomainSelectableList.component';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType, LayoutType } from '../../Tag/TagsViewer/TagsViewer.interface';
import {
  CDE_TAG_CLASSIFICATIONS,
  renderCDEOwners,
  renderCDEReferences,
} from '../GlossaryTermTab/CDEGlossaryTableColumns';

interface CDEGlossaryTermSummaryProps {
  glossaryTerm: GlossaryTerm;
}

interface CDEFieldProps {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
}

const CDEField = ({ action, children, className, label }: CDEFieldProps) => (
  <Col
    aria-label={label}
    className={`cde-detail-field ${className ?? ''}`}
    lg={12}
    md={12}
    role="group"
    sm={24}
    xs={24}>
    <div className="cde-detail-field-label d-flex items-center gap-2">
      <Typography.Text className="text-sm font-medium">{label}</Typography.Text>
      {action}
    </div>
    <div className="cde-detail-field-value">{children}</div>
  </Col>
);

interface CDETagFieldProps {
  classification: string;
  glossaryTerm: GlossaryTerm;
  label: string;
}

const CDETagField = ({
  classification,
  glossaryTerm,
  label,
}: CDETagFieldProps) => {
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const selectedTags = (glossaryTerm.tags ?? []).filter(
    (tag) => tag.tagFQN.split('.')[0] === classification
  );
  const hasEditAccess =
    !isVersionView && Boolean(permissions?.EditTags || permissions?.EditAll);

  const handleTagUpdate = async (updatedTags: EntityTags[]) => {
    const tags = createTagObject(updatedTags) ?? [];
    const currentTags = data?.tags ?? glossaryTerm.tags ?? [];
    const nonClassificationTags = currentTags.filter(
      (tag) => tag.tagFQN.split('.')[0] !== classification
    );

    await onUpdate?.({
      ...glossaryTerm,
      ...data,
      tags: [...nonClassificationTags, ...tags],
    });
  };

  return (
    <CDEField
      className={`cde-detail-field-${classification}`}
      label={label}>
      <TagsContainerV2
        showInlineEditButton
        classificationFilter={classification}
        columnData={{
          fqn: glossaryTerm.fullyQualifiedName ?? glossaryTerm.name,
          name: label,
        }}
        displayType={DisplayType.READ_MORE}
        entityFqn={glossaryTerm.fullyQualifiedName}
        entityType={EntityType.GLOSSARY_TERM}
        layoutType={LayoutType.HORIZONTAL}
        permission={hasEditAccess}
        selectedTags={selectedTags}
        showTaskHandler={false}
        tagType={TagSource.Classification}
        onSelectionChange={handleTagUpdate}
      />
    </CDEField>
  );
};

const CDEOwnersField = ({ glossaryTerm }: CDEGlossaryTermSummaryProps) => {
  const { data, entityRules, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const hasEditAccess =
    !isVersionView && Boolean(permissions?.EditOwners || permissions?.EditAll);

  const handleOwnerUpdate = async (owners?: EntityReference[]) => {
    await onUpdate?.({
      ...glossaryTerm,
      ...data,
      owners,
    });
  };

  const editAction = hasEditAccess ? (
    <UserTeamSelectableList
      hasPermission={hasEditAccess}
      listHeight={200}
      multiple={{
        team: entityRules?.canAddMultipleTeamOwner ?? false,
        user: entityRules?.canAddMultipleUserOwners ?? false,
      }}
      owner={glossaryTerm.owners}
      onUpdate={handleOwnerUpdate}>
      <EditIconButton
        size="small"
        title={t('label.edit-entity', { entity: t('label.owner-plural') })}
      />
    </UserTeamSelectableList>
  ) : undefined;

  return (
    <CDEField action={editAction} label={t('cde.data-owner')}>
      <div className="cde-owner-field-value">
        {renderCDEOwners(glossaryTerm.owners as EntityReference[])}
      </div>
    </CDEField>
  );
};

const CDEDomainsField = ({ glossaryTerm }: CDEGlossaryTermSummaryProps) => {
  const { data, entityRules, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const hasEditAccess = !isVersionView && Boolean(permissions?.EditAll);

  const handleDomainUpdate = async (
    selectedDomain: EntityReference | EntityReference[]
  ) => {
    const domains = Array.isArray(selectedDomain)
      ? selectedDomain
      : selectedDomain
        ? [selectedDomain]
        : [];

    await onUpdate?.({
      ...glossaryTerm,
      ...data,
      domains,
    });
  };

  const editAction = hasEditAccess ? (
    <DomainSelectableList
      isClearable
      showAllDomains
      hasPermission={hasEditAccess}
      multiple={entityRules?.canAddMultipleDomains ?? true}
      selectedDomain={glossaryTerm.domains}
      wrapInButton={false}
      onUpdate={handleDomainUpdate}>
      <EditIconButton
        size="small"
        title={t('label.edit-entity', { entity: t('label.domain-plural') })}
      />
    </DomainSelectableList>
  ) : undefined;

  return (
    <CDEField action={editAction} label={t('cde.business-group')}>
      <div className="cde-domain-field-value">
        {renderCDEReferences(glossaryTerm.domains as EntityReference[])}
      </div>
    </CDEField>
  );
};

const CDEQualityRuleField = ({ glossaryTerm }: CDEGlossaryTermSummaryProps) => {
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const hasEditAccess =
    !isVersionView &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);

  const rawValue =
    glossaryTerm.extension?.dataQualityRules ??
    glossaryTerm.extension?.quy_dinh_chat_luong_du_lieu;

  const isEnabled =
    rawValue === true ||
    rawValue === 'true' ||
    rawValue === 'Y' ||
    rawValue === 'yes' ||
    (Array.isArray(rawValue) &&
      (rawValue.includes('Y') ||
        rawValue.includes('yes') ||
        rawValue.includes('true')));

  const handleSelect = async (val: string) => {
    const updatedExtension = {
      ...(glossaryTerm.extension ?? {}),
      ...(data?.extension ?? {}),
      dataQualityRules: val === 'true' ? ['Y'] : ['N'],
    };
    await onUpdate?.(
      {
        ...glossaryTerm,
        ...data,
        extension: updatedExtension,
      },
      'extension'
    );
    setIsEditing(false);
  };

  const editAction = hasEditAccess ? (
    <Popover
      content={
        <div style={{ width: 120 }}>
          <Select
            defaultValue={isEnabled ? 'true' : 'false'}
            options={[
              { label: t('label.yes'), value: 'true' },
              { label: t('label.no'), value: 'false' },
            ]}
            style={{ width: '100%' }}
            onChange={handleSelect}
          />
        </div>
      }
      open={isEditing}
      placement="bottomLeft"
      trigger="click"
      onOpenChange={setIsEditing}>
      <EditIconButton
        size="small"
        title={t('label.edit-entity', { entity: t('cde.data-quality-rules') })}
      />
    </Popover>
  ) : undefined;

  return (
    <CDEField
      action={editAction}
      className="cde-detail-field-quality-rule"
      label={t('cde.data-quality-rules')}>
      <div className="d-flex items-center gap-2">
        <Tag className="enum-key-tag">{isEnabled ? 'Y' : 'N'}</Tag>
      </div>
    </CDEField>
  );
};

interface CDETextCustomFieldProps {
  fallbackName?: string;
  glossaryTerm: GlossaryTerm;
  label: string;
  propertyName: string;
}

const CDETextCustomField = ({
  fallbackName,
  glossaryTerm,
  label,
  propertyName,
}: CDETextCustomFieldProps) => {
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const hasEditAccess =
    !isVersionView &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);

  const value =
    (glossaryTerm.extension?.[propertyName] as string) ??
    (fallbackName ? (glossaryTerm.extension?.[fallbackName] as string) : '') ??
    '';

  const handleSave = async (markdown: string) => {
    const updatedExtension = {
      ...(glossaryTerm.extension ?? {}),
      ...(data?.extension ?? {}),
      [propertyName]: markdown,
    };
    await onUpdate?.(
      {
        ...glossaryTerm,
        ...data,
        extension: updatedExtension,
      },
      'extension'
    );
    setIsEditing(false);
  };

  const editAction = hasEditAccess ? (
    <EditIconButton
      size="small"
      title={t('label.edit-entity', { entity: label })}
      onClick={() => setIsEditing(true)}
    />
  ) : undefined;

  return (
    <CDEField
      action={editAction}
      className={`cde-detail-field-${propertyName}`}
      label={label}>
      <div className="cde-detail-field-markdown-content">
        {value ? (
          <RichTextEditorPreviewerV1
            enableSeeMoreVariant
            markdown={value}
          />
        ) : (
          <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>
        )}
      </div>
      {isEditing && (
        <ModalWithMarkdownEditor
          header={t('label.edit-entity-name', {
            entityType: t('label.property'),
            entityName: label,
          })}
          placeholder={t('label.enter-property-value')}
          value={value}
          visible={isEditing}
          onCancel={() => setIsEditing(false)}
          onSave={handleSave}
        />
      )}
    </CDEField>
  );
};

const CDEGlossaryTermSummary = ({
  glossaryTerm,
}: CDEGlossaryTermSummaryProps) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Group 1: Nhóm theo nghiệp vụ, Nguồn dữ liệu, Chủ sở hữu dữ liệu, Phân loại dữ liệu, Dữ liệu cá nhân, Quy định về chất lượng dữ liệu */}
      <div
        className="cde-detail-summary cde-detail-summary-group-1"
        data-testid="cde-glossary-term-summary-group-1">
        <Row gutter={[0, 0]}>
          <CDEDomainsField glossaryTerm={glossaryTerm} />
          <CDETagField
            classification={CDE_TAG_CLASSIFICATIONS.dataSource}
            glossaryTerm={glossaryTerm}
            label={t('cde.data-source')}
          />
          <CDEOwnersField glossaryTerm={glossaryTerm} />
          <CDETagField
            classification={CDE_TAG_CLASSIFICATIONS.dataClassification}
            glossaryTerm={glossaryTerm}
            label={t('cde.data-classification')}
          />
          <CDETagField
            classification={CDE_TAG_CLASSIFICATIONS.personalData}
            glossaryTerm={glossaryTerm}
            label={t('cde.personal-data')}
          />
          <CDEQualityRuleField glossaryTerm={glossaryTerm} />
        </Row>
      </div>

      {/* Group 2: Mối quan hệ với thực thể (trái) và Văn bản quy định liên quan (phải) trên cùng 1 hàng */}
      <div
        className="cde-detail-summary cde-detail-summary-group-2"
        data-testid="cde-glossary-term-summary-group-2">
        <Row gutter={[0, 0]}>
          <CDETextCustomField
            fallbackName="moi_quan_he_voi_thuc_the"
            glossaryTerm={glossaryTerm}
            label={t('cde.entity-relationship')}
            propertyName="entityRelationship"
          />
          <CDETextCustomField
            fallbackName="van_ban_quy_dinh_lien_quan"
            glossaryTerm={glossaryTerm}
            label={t('cde.related-regulatory-documents')}
            propertyName="relatedRegulatoryDocuments"
          />
        </Row>
      </div>
    </>
  );
};

export default CDEGlossaryTermSummary;
