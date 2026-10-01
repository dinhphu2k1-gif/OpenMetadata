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
import { Input, Popover, Space, Tag, Typography } from 'antd';
import { EntityTags } from 'Models';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { DATA_DICTIONARY_GLOSSARY_NAME } from '../../../constants/Glossary.contant';
import {
  EntityStatus,
  GlossaryTerm,
  TermRelation,
} from '../../../generated/entity/data/glossaryTerm';
import { getLatestPublishedGlossaryTerm } from '../../../rest/glossaryAPI';
import { TagSource } from '../../../generated/type/tagLabel';
import { createTagObject } from '../../../utils/TagsUtils';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import CDESelector from '../CDESelector/CDESelector.component';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { TagSelectableList } from '../../common/TagSelectableList/TagSelectableList.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsViewer from '../../Tag/TagsViewer/TagsViewer';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';
import {
  DQExtension,
  DQ_TAG_CLASSIFICATIONS,
  renderDQQualityThreshold,
} from '../GlossaryTermTab/DQGlossaryTableColumns';
import {
  GovernedGlossaryField,
  GovernedGlossarySection,
} from './GovernedGlossaryDetailLayout';
import CDEReleaseLevelField from './CDEReleaseLevelField';
import { CDEValidityFields } from './CDEGlossaryTermSummary';

interface SummaryProps {
  glossaryTerm: GlossaryTerm;
}

const DQCdeRelationFields = ({ glossaryTerm }: SummaryProps) => {
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const currentTerm = data ?? glossaryTerm;
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSavingCde, setIsSavingCde] = useState(false);
  const [resolvedCde, setResolvedCde] = useState<GlossaryTerm>();
  const relation = currentTerm.relatedTerms?.find((item) =>
    item.term?.fullyQualifiedName?.includes(DATA_DICTIONARY_GLOSSARY_NAME)
  );
  const selectedCde = relation?.term;
  const displayedCde = resolvedCde ?? selectedCde;
  const isHistoricalCde =
    resolvedCde?.entityStatus &&
    resolvedCde.entityStatus !== EntityStatus.Approved;
  const canEdit =
    !isVersionView &&
    currentTerm.entityStatus === EntityStatus.Draft &&
    Boolean(permissions?.EditAll || permissions?.EditGlossaryTerms);

  useEffect(() => {
    if (!selectedCde?.id) {
      setResolvedCde(undefined);

      return;
    }
    getLatestPublishedGlossaryTerm(selectedCde.id)
      .then(setResolvedCde)
      .catch(() => setResolvedCde(undefined));
  }, [selectedCde?.id]);

  const handleSelect = async (_id?: string, selected?: GlossaryTerm) => {
    if (isSavingCde) {
      return;
    }
    if (selected?.id === selectedCde?.id) {
      setIsEditorOpen(false);

      return;
    }
    const nonCdeRelations = (currentTerm.relatedTerms ?? []).filter(
      (item) =>
        !item.term?.fullyQualifiedName?.includes(DATA_DICTIONARY_GLOSSARY_NAME)
    );
    const updatedRelation: TermRelation[] = selected?.id
      ? [
          {
            relationType: 'relatedTo',
            term: {
              id: selected.id,
              type: 'glossaryTerm',
              name: selected.name,
              displayName: selected.displayName,
              fullyQualifiedName: selected.fullyQualifiedName,
            },
          },
        ]
      : [];
    setIsSavingCde(true);
    try {
      await onUpdate?.({
        ...glossaryTerm,
        ...data,
        relatedTerms: [...nonCdeRelations, ...updatedRelation],
      });
      setResolvedCde(selected);
      setIsEditorOpen(false);
    } finally {
      setIsSavingCde(false);
    }
  };

  return (
    <GovernedGlossarySection
      className="dq-detail-section-cde-relation"
      title={t('dq.cde-link', 'Liên kết CDE')}
      variant="management">
      <GovernedGlossaryField
        action={
          canEdit ? (
            <Popover
              content={
                <CDESelector
                  disabled={isSavingCde}
                  parentBusinessVersion={currentTerm.parentBusinessVersion}
                  selectedCde={resolvedCde ?? selectedCde}
                  width={520}
                  onChange={handleSelect}
                />
              }
              open={isEditorOpen}
              placement="bottomLeft"
              trigger="click"
              onOpenChange={setIsEditorOpen}>
              <EditIconButton
                size="small"
                title={t('label.edit-entity', { entity: t('dq.cde-code') })}
              />
            </Popover>
          ) : undefined
      }
      label={t('dq.cde-code')}>
        {displayedCde ? (
          <Space size={6}>
            <Typography.Text>{displayedCde.name}</Typography.Text>
            {isHistoricalCde && <Tag>Archived</Tag>}
          </Space>
        ) : (
          NO_DATA_PLACEHOLDER
        )}
      </GovernedGlossaryField>
      <GovernedGlossaryField label={t('dq.cde-name')}>
        {resolvedCde?.displayName ??
          selectedCde?.displayName ??
          NO_DATA_PLACEHOLDER}
      </GovernedGlossaryField>
    </GovernedGlossarySection>
  );
};

const DQTagField = ({
  classification,
  glossaryTerm,
  label,
}: SummaryProps & { classification: string; label: string }) => {
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const selectedTags = (glossaryTerm.tags ?? []).filter(
    (tag) => tag.tagFQN.split('.')[0] === classification
  );
  const canEdit =
    !isVersionView &&
    (data?.entityStatus ?? glossaryTerm.entityStatus) === EntityStatus.Draft &&
    Boolean(permissions?.EditTags || permissions?.EditAll);

  return (
    <GovernedGlossaryField
      action={
        canEdit ? (
          <TagSelectableList
            classificationFilter={classification}
            hasPermission={canEdit}
            popoverProps={{
              open: isEditorOpen,
              overlayClassName: 'cde-tag-select-popover',
              placement: 'bottomLeft',
              onOpenChange: setIsEditorOpen,
            }}
            searchPlaceholder={t('label.search-for-type', { type: label })}
            selectedTags={selectedTags}
            onCancel={() => setIsEditorOpen(false)}
            onUpdate={async (updatedTags: EntityTags[]) => {
              const currentTags = data?.tags ?? glossaryTerm.tags ?? [];
              const otherTags = currentTags.filter(
                (tag) => tag.tagFQN.split('.')[0] !== classification
              );
              await onUpdate?.({
                ...glossaryTerm,
                ...data,
                tags: [...otherTags, ...(createTagObject(updatedTags) ?? [])],
              });
              setIsEditorOpen(false);
            }}>
            <EditIconButton
              size="small"
              title={t('label.edit-entity', { entity: label })}
            />
          </TagSelectableList>
        ) : undefined
      }
      label={label}>
      <TagsViewer
        showNoDataPlaceholder
        displayType={DisplayType.READ_MORE}
        entityFqn={glossaryTerm.fullyQualifiedName ?? glossaryTerm.name}
        tagType={TagSource.Classification}
        tags={selectedTags}
      />
    </GovernedGlossaryField>
  );
};

const DQQualityThresholdField = ({ glossaryTerm }: SummaryProps) => {
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const value =
    (glossaryTerm.extension as DQExtension | undefined)?.qualityThreshold ?? '';
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const canEdit =
    !isVersionView &&
    (data?.entityStatus ?? glossaryTerm.entityStatus) === EntityStatus.Draft &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);

  const save = async () => {
    await onUpdate?.(
      {
        ...glossaryTerm,
        ...data,
        extension: {
          ...(glossaryTerm.extension ?? {}),
          ...(data?.extension ?? {}),
          qualityThreshold: draftValue,
        },
      },
      'extension'
    );
    setIsEditing(false);
  };

  return (
    <GovernedGlossaryField
      action={
        canEdit ? (
          <Popover
            content={
              <div className="d-flex flex-column gap-2" style={{ width: 180 }}>
                <Input
                  placeholder={t('dq.quality-threshold-example')}
                  size="small"
                  value={draftValue}
                  onChange={(event) => setDraftValue(event.target.value)}
                  onPressEnter={save}
                />
                <button
                  className="ant-btn ant-btn-primary ant-btn-sm"
                  onClick={save}>
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
              title={t('label.edit-entity', {
                entity: t('dq.quality-threshold'),
              })}
            />
          </Popover>
        ) : undefined
      }
      className="dq-detail-field-threshold"
      label={t('dq.quality-threshold')}>
      {value ? renderDQQualityThreshold(value) : NO_DATA_PLACEHOLDER}
    </GovernedGlossaryField>
  );
};

const DQTextField = ({
  glossaryTerm,
  label,
  propertyName,
}: SummaryProps & { label: string; propertyName: string }) => {
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const value = (glossaryTerm.extension?.[propertyName] as string) ?? '';
  const canEdit =
    !isVersionView &&
    (data?.entityStatus ?? glossaryTerm.entityStatus) === EntityStatus.Draft &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);

  return (
    <GovernedGlossaryField
      action={
        canEdit ? (
          <EditIconButton
            size="small"
            title={t('label.edit-entity', { entity: label })}
            onClick={() => setIsEditing(true)}
          />
        ) : undefined
      }
      className={`dq-detail-field-${propertyName}`}
      label={label}>
      <div className="dq-detail-field-markdown-content">
        {value ? (
          <RichTextEditorPreviewerV1 enableSeeMoreVariant markdown={value} />
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
          onSave={async (markdown) => {
            await onUpdate?.(
              {
                ...glossaryTerm,
                ...data,
                extension: {
                  ...(glossaryTerm.extension ?? {}),
                  ...(data?.extension ?? {}),
                  [propertyName]: markdown,
                },
              },
              'extension'
            );
            setIsEditing(false);
          }}
        />
      )}
    </GovernedGlossaryField>
  );
};

const DQGlossaryTermSummary = ({ glossaryTerm }: SummaryProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="cde-detail-summary dq-detail-summary"
      data-testid="dq-glossary-term-summary">
      <DQCdeRelationFields glossaryTerm={glossaryTerm} />

      <GovernedGlossarySection
        className="dq-detail-section-management"
        title={t('cde.management-information')}
        variant="management">
        <CDEReleaseLevelField glossaryTerm={glossaryTerm} />
        <CDEValidityFields glossaryTerm={glossaryTerm} />
      </GovernedGlossarySection>

      <GovernedGlossarySection
        className="dq-detail-section-classification"
        title={t('cde.classification-control')}
        variant="classification">
        <DQTagField
          classification={DQ_TAG_CLASSIFICATIONS.dimension}
          glossaryTerm={glossaryTerm}
          label={t('dq.dimension')}
        />
        <DQTagField
          classification={DQ_TAG_CLASSIFICATIONS.targetPopulation}
          glossaryTerm={glossaryTerm}
          label={t('dq.target-population')}
        />
        <DQTagField
          classification={DQ_TAG_CLASSIFICATIONS.method}
          glossaryTerm={glossaryTerm}
          label={t('dq.method')}
        />
        <DQTagField
          classification={DQ_TAG_CLASSIFICATIONS.frequency}
          glossaryTerm={glossaryTerm}
          label={t('dq.frequency')}
        />
        <DQQualityThresholdField glossaryTerm={glossaryTerm} />
      </GovernedGlossarySection>

      <GovernedGlossarySection
        title={t('cde.business-context')}
        variant="context">
        <DQTextField
          glossaryTerm={glossaryTerm}
          label={t('dq.rule-explanation')}
          propertyName="ruleExplanation"
        />
        <DQTextField
          glossaryTerm={glossaryTerm}
          label={t('dq.other-constraints')}
          propertyName="otherConstraints"
        />
        <DQTextField
          glossaryTerm={glossaryTerm}
          label={t('cde.related-regulatory-documents')}
          propertyName="relatedRegulatoryDocuments"
        />
      </GovernedGlossarySection>
    </div>
  );
};

export default DQGlossaryTermSummary;
