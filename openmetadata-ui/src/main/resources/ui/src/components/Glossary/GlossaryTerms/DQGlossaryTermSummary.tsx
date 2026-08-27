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

import { Col, Input, Popover, Row, Select, Spin, Typography } from 'antd';
import { EntityTags } from 'Models';
import { ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { DATA_DICTIONARY_GLOSSARY_NAME } from '../../../constants/Glossary.contant';
import { EntityType } from '../../../enums/entity.enum';
import {
  GlossaryTerm,
  TermRelation,
} from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { TagSource } from '../../../generated/type/tagLabel';
import {
  getFirstLevelGlossaryTermsPaginated,
  searchGlossaryTermsPaginated,
} from '../../../rest/glossaryAPI';
import { createTagObject } from '../../../utils/TagsUtils';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType, LayoutType } from '../../Tag/TagsViewer/TagsViewer.interface';
import {
  DQ_TAG_CLASSIFICATIONS,
  DQExtension,
  renderDQCdeCode,
  renderDQOwners,
  renderDQQualityThreshold,
} from '../GlossaryTermTab/DQGlossaryTableColumns';

interface DQGlossaryTermSummaryProps {
  glossaryTerm: GlossaryTerm;
}

interface DQFieldProps {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  isLastRow?: boolean;
  isLeft?: boolean;
  label: string;
  span?: number;
}

const DQField = ({
  action,
  children,
  className,
  isLastRow,
  isLeft,
  label,
  span = 12,
}: DQFieldProps) => {
  const isFullWidth = span === 24;
  const leftClass = isLeft ? 'dq-detail-field-left' : '';
  const fullClass = isFullWidth ? 'dq-detail-field-full' : '';
  const lastRowClass = isLastRow ? 'dq-detail-field-last-row' : '';

  return (
    <Col
      aria-label={label}
      className={`dq-detail-field ${leftClass} ${fullClass} ${lastRowClass} ${className ?? ''}`}
      lg={span}
      md={span}
      role="group"
      sm={24}
      xs={24}>
      <div className="dq-detail-field-label d-flex items-center gap-2">
        <Typography.Text className="text-sm font-medium">{label}</Typography.Text>
        {action}
      </div>
      <div className="dq-detail-field-value">{children}</div>
    </Col>
  );
};

interface DQCdeCodeFieldProps extends DQGlossaryTermSummaryProps {
  isLastRow?: boolean;
  isLeft?: boolean;
  span?: number;
}

const DQCdeCodeField = ({
  glossaryTerm,
  isLastRow,
  isLeft = true,
  span = 12,
}: DQCdeCodeFieldProps) => {
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cdeOptions, setCdeOptions] = useState<GlossaryTerm[]>([]);
  const ext = (data?.extension ?? glossaryTerm.extension) as DQExtension | undefined;
  const [selectedValue, setSelectedValue] = useState<string | undefined>(
    ext?.cdeCode || undefined
  );

  const hasEditAccess =
    !isVersionView &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);

  const fetchCdeTerms = async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCdeTerms();
  }, []);

  const handleOpenChange = (visible: boolean) => {
    setIsEditing(visible);
    if (visible) {
      setSelectedValue(ext?.cdeCode || undefined);
      if (cdeOptions.length === 0) {
        fetchCdeTerms();
      }
    }
  };

  const handleSave = async () => {
    const matchedTerm = cdeOptions.find(
      (term) =>
        term.name?.toLowerCase() === selectedValue?.toLowerCase() ||
        term.fullyQualifiedName?.toLowerCase() === selectedValue?.toLowerCase()
    );

    const currentExtension = {
      ...(glossaryTerm.extension ?? {}),
      ...(data?.extension ?? {}),
    };

    const updatedExtension: DQExtension = {
      ...currentExtension,
      cdeCode: matchedTerm ? matchedTerm.name : (selectedValue ?? ''),
      cdeName: matchedTerm
        ? (matchedTerm.displayName || matchedTerm.name)
        : '',
    };

    const currentRelatedTerms = (data?.relatedTerms ??
      glossaryTerm.relatedTerms ??
      []) as TermRelation[];
    const nonCdeRelatedTerms = currentRelatedTerms.filter((rel) => {
      const term = rel.term ?? (rel as unknown as EntityReference);

      return !term?.fullyQualifiedName?.includes(DATA_DICTIONARY_GLOSSARY_NAME);
    });

    const updatedRelatedTerms: TermRelation[] = [...nonCdeRelatedTerms];
    if (matchedTerm) {
      updatedRelatedTerms.push({
        relationType: 'relatedTo',
        term: {
          id: matchedTerm.id,
          type: EntityType.GLOSSARY_TERM,
          name: matchedTerm.name,
          displayName: matchedTerm.displayName,
          fullyQualifiedName: matchedTerm.fullyQualifiedName,
        },
      });
    }

    await onUpdate?.({
      ...glossaryTerm,
      ...data,
      extension: updatedExtension,
      relatedTerms: updatedRelatedTerms,
    });
    setIsEditing(false);
  };

  const editAction = hasEditAccess ? (
    <Popover
      content={
        <div className="d-flex flex-column gap-2" style={{ width: 320 }}>
          <Select
            allowClear
            showSearch
            filterOption={(input, option) => {
              const label = String(option?.label ?? '').toLowerCase();
              const val = String(option?.value ?? '').toLowerCase();
              const q = input.toLowerCase();

              return label.includes(q) || val.includes(q);
            }}
            loading={isLoading}
            notFoundContent={isLoading ? <Spin size="small" /> : undefined}
            options={cdeOptions.map((term) => ({
              label: `${term.name}${term.displayName ? ` - ${term.displayName}` : ''}`,
              value: term.name,
            }))}
            placeholder={t('label.select-field', { field: t('dq.cde-code') })}
            size="small"
            style={{ width: '100%' }}
            value={selectedValue}
            onChange={(val) => setSelectedValue(val)}
          />
          <div className="d-flex justify-end gap-2">
            <button
              className="ant-btn ant-btn-default ant-btn-sm"
              onClick={() => setIsEditing(false)}>
              {t('label.cancel')}
            </button>
            <button
              className="ant-btn ant-btn-primary ant-btn-sm"
              onClick={handleSave}>
              {t('label.save')}
            </button>
          </div>
        </div>
      }
      open={isEditing}
      placement="bottomLeft"
      trigger="click"
      onOpenChange={handleOpenChange}>
      <EditIconButton
        size="small"
        title={t('label.edit-entity', { entity: t('dq.cde-code') })}
      />
    </Popover>
  ) : undefined;

  return (
    <DQField
      action={editAction}
      isLastRow={isLastRow}
      isLeft={isLeft}
      label={t('dq.cde-code')}
      span={span}>
      {renderDQCdeCode(glossaryTerm, ext)}
    </DQField>
  );
};

interface DQTagFieldProps {
  classification: string;
  glossaryTerm: GlossaryTerm;
  isLastRow?: boolean;
  isLeft?: boolean;
  label: string;
  span?: number;
}

const DQTagField = ({
  classification,
  glossaryTerm,
  isLastRow,
  isLeft,
  label,
  span = 12,
}: DQTagFieldProps) => {
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
    <DQField
      className={`dq-detail-field-${classification}`}
      isLastRow={isLastRow}
      isLeft={isLeft}
      label={label}
      span={span}>
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
    </DQField>
  );
};

interface DQOwnersFieldProps extends DQGlossaryTermSummaryProps {
  isLastRow?: boolean;
  isLeft?: boolean;
  span?: number;
}

const DQOwnersField = ({
  glossaryTerm,
  isLastRow,
  isLeft,
  span = 12,
}: DQOwnersFieldProps) => {
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
    <DQField
      action={editAction}
      isLastRow={isLastRow}
      isLeft={isLeft}
      label={t('dq.owners')}
      span={span}>
      <div className="dq-owner-field-value">
        {renderDQOwners(glossaryTerm.owners as EntityReference[])}
      </div>
    </DQField>
  );
};

interface DQQualityThresholdFieldProps extends DQGlossaryTermSummaryProps {
  isLastRow?: boolean;
  isLeft?: boolean;
  span?: number;
}

const DQQualityThresholdField = ({
  glossaryTerm,
  isLastRow,
  isLeft,
  span = 24,
}: DQQualityThresholdFieldProps) => {
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [thresholdValue, setThresholdValue] = useState(
    (glossaryTerm.extension as DQExtension | undefined)?.qualityThreshold ?? ''
  );
  const hasEditAccess =
    !isVersionView &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);

  const handleSave = async () => {
    const updatedExtension = {
      ...(glossaryTerm.extension ?? {}),
      ...(data?.extension ?? {}),
      qualityThreshold: thresholdValue,
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
        <div className="d-flex flex-column gap-2" style={{ width: 180 }}>
          <Input
            placeholder="Ví dụ: 100%, 99%..."
            size="small"
            value={thresholdValue}
            onChange={(e) => setThresholdValue(e.target.value)}
            onPressEnter={handleSave}
          />
          <button
            className="ant-btn ant-btn-primary ant-btn-sm"
            onClick={handleSave}>
            {t('label.save')}
          </button>
        </div>
      }
      open={isEditing}
      placement="bottomLeft"
      trigger="click"
      onOpenChange={setIsEditing}>
      <EditIconButton
        size="small"
        title={t('label.edit-entity', { entity: t('dq.quality-threshold') })}
      />
    </Popover>
  ) : undefined;

  return (
    <DQField
      action={editAction}
      className="dq-detail-field-threshold"
      isLastRow={isLastRow}
      isLeft={isLeft}
      label={t('dq.quality-threshold')}
      span={span}>
      <div className="d-flex items-center gap-2">
        {renderDQQualityThreshold(
          (glossaryTerm.extension as DQExtension | undefined)?.qualityThreshold
        )}
      </div>
    </DQField>
  );
};

interface DQTextCustomFieldProps {
  glossaryTerm: GlossaryTerm;
  isLastRow?: boolean;
  isLeft?: boolean;
  label: string;
  propertyName: string;
  span?: number;
}

const DQTextCustomField = ({
  glossaryTerm,
  isLastRow,
  isLeft,
  label,
  propertyName,
  span = 12,
}: DQTextCustomFieldProps) => {
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const hasEditAccess =
    !isVersionView &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);

  const value =
    (glossaryTerm.extension?.[propertyName] as string) ?? '';

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
    <DQField
      action={editAction}
      className={`dq-detail-field-${propertyName}`}
      isLastRow={isLastRow}
      isLeft={isLeft}
      label={label}
      span={span}>
      <div className="dq-detail-field-markdown-content">
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
    </DQField>
  );
};

const DQGlossaryTermSummary = ({
  glossaryTerm,
}: DQGlossaryTermSummaryProps) => {
  const { t } = useTranslation();
  const ext = glossaryTerm.extension as DQExtension | undefined;

  return (
    <div
      className="dq-detail-summary"
      data-testid="dq-glossary-term-summary">
      <Row gutter={[0, 0]}>
        <DQCdeCodeField isLeft glossaryTerm={glossaryTerm} />
        <DQField label={t('dq.cde-name')}>
          <span className="font-medium text-grey-muted">
            {ext?.cdeName || NO_DATA_PLACEHOLDER}
          </span>
        </DQField>
        <DQTagField
          isLeft
          classification={DQ_TAG_CLASSIFICATIONS.dimension}
          glossaryTerm={glossaryTerm}
          label={t('dq.dimension')}
        />
        <DQOwnersField glossaryTerm={glossaryTerm} />
        <DQTextCustomField
          glossaryTerm={glossaryTerm}
          label={t('dq.rule-explanation')}
          propertyName="ruleExplanation"
          span={24}
        />
        <DQTextCustomField
          isLeft
          glossaryTerm={glossaryTerm}
          label={t('dq.other-constraints')}
          propertyName="otherConstraints"
          span={12}
        />
        <DQTextCustomField
          glossaryTerm={glossaryTerm}
          label={t('dq.exceptions')}
          propertyName="exceptions"
          span={12}
        />
        <DQTagField
          isLeft
          classification={DQ_TAG_CLASSIFICATIONS.dataSource}
          glossaryTerm={glossaryTerm}
          label={t('dq.data-source')}
        />
        <DQTagField
          classification={DQ_TAG_CLASSIFICATIONS.targetPopulation}
          glossaryTerm={glossaryTerm}
          label={t('dq.target-population')}
        />
        <DQTagField
          isLeft
          classification={DQ_TAG_CLASSIFICATIONS.method}
          glossaryTerm={glossaryTerm}
          label={t('dq.method')}
        />
        <DQTagField
          classification={DQ_TAG_CLASSIFICATIONS.frequency}
          glossaryTerm={glossaryTerm}
          label={t('dq.frequency')}
        />
        <DQQualityThresholdField isLastRow glossaryTerm={glossaryTerm} span={24} />
      </Row>
    </div>
  );
};

export default DQGlossaryTermSummary;


