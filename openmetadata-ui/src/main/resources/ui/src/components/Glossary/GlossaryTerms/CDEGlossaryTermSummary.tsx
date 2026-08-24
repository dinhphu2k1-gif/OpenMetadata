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

import { Col, Row } from 'antd';
import { EntityTags } from 'Models';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { TagSource } from '../../../generated/type/tagLabel';
import { createTagObject } from '../../../utils/TagsUtils';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import DomainSelectableList from '../../common/DomainSelectableList/DomainSelectableList.component';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
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
      <span>{label}</span>
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
    <CDEField label="Chủ sở hữu dữ liệu">
      <div className="cde-owner-field-value">
        {renderCDEOwners(glossaryTerm.owners as EntityReference[])}
        {editAction}
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
    <CDEField label="Nhóm theo nghiệp vụ">
      <div className="cde-domain-field-value">
        {renderCDEReferences(glossaryTerm.domains as EntityReference[])}
        {editAction}
      </div>
    </CDEField>
  );
};

const CDEGlossaryTermSummary = ({
  glossaryTerm,
}: CDEGlossaryTermSummaryProps) => {
  const { permissions, isVersionView } = useGenericContext<GlossaryTerm>();
  const canEditCustomFields =
    !isVersionView &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);
  const canViewCustomFields = Boolean(
    permissions?.ViewAll || permissions?.ViewCustomFields
  );

  return (
    <section
      className="cde-detail-summary"
      data-testid="cde-glossary-term-summary">
      <Row gutter={[0, 0]}>
        <CDEDomainsField glossaryTerm={glossaryTerm} />
        <CDETagField
          classification={CDE_TAG_CLASSIFICATIONS.dataSource}
          glossaryTerm={glossaryTerm}
          label="Nguồn dữ liệu"
        />
        <CDEOwnersField glossaryTerm={glossaryTerm} />
        <CDETagField
          classification={CDE_TAG_CLASSIFICATIONS.dataClassification}
          glossaryTerm={glossaryTerm}
          label="Phân loại dữ liệu"
        />
        <CDETagField
          classification={CDE_TAG_CLASSIFICATIONS.qtdlReview}
          glossaryTerm={glossaryTerm}
          label="QTDL rà soát"
        />
        <CDETagField
          classification={CDE_TAG_CLASSIFICATIONS.personalData}
          glossaryTerm={glossaryTerm}
          label="Dữ liệu cá nhân"
        />
        <Col className="cde-custom-properties" span={24}>
          <CustomPropertyTable<EntityType.GLOSSARY_TERM>
            entityType={EntityType.GLOSSARY_TERM}
            hasEditAccess={canEditCustomFields}
            hasPermission={canViewCustomFields}
            isVersionView={isVersionView}
            layout="two-column-last-full-width"
          />
        </Col>
      </Row>
    </section>
  );
};

export default CDEGlossaryTermSummary;
