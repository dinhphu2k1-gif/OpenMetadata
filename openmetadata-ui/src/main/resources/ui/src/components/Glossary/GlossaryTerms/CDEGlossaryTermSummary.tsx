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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Popover, Select, Typography } from 'antd';
import { DateTime } from 'luxon';
import DatePicker from '../../common/DatePicker/DatePicker';
import {
  CDEDateField,
  formatCDEDate,
  mergeCDEDates,
  validateCDEDates,
} from '../../../utils/CDEDateUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { EntityTags } from 'Models';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityStatus, GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import { TagSource } from '../../../generated/type/tagLabel';
import { createTagObject } from '../../../utils/TagsUtils';
import DomainSelectableList from '../../common/DomainSelectableList/DomainSelectableList.component';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import { TagSelectableList } from '../../common/TagSelectableList/TagSelectableList.component';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ModalWithMarkdownEditor } from '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsViewer from '../../Tag/TagsViewer/TagsViewer';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';
import {
  CDE_TAG_CLASSIFICATIONS,
  renderCDEOwners,
  renderCDEReferences,
} from '../GlossaryTermTab/CDEGlossaryTableColumns';
import CDEEnumField from './CDEEnumField';
import CDEReleaseLevelField from './CDEReleaseLevelField';

interface CDEGlossaryTermSummaryProps {
  glossaryTerm: GlossaryTerm;
}

interface CDEFieldProps {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
}

interface CDESectionProps {
  children: ReactNode;
  title: string;
  variant: 'classification' | 'context' | 'management';
}

const CDESection = ({ children, title, variant }: CDESectionProps) => (
  <section className={`cde-detail-section cde-detail-section-${variant}`}>
    <header className="cde-detail-section-header">
      <span aria-hidden="true" className="cde-detail-section-marker" />
      <Typography.Title className="cde-detail-section-title" level={5}>
        {title}
      </Typography.Title>
    </header>
    <div className="cde-detail-section-grid">
      {children}
    </div>
  </section>
);

const CDEField = ({ action, children, className, label }: CDEFieldProps) => (
  <div
    aria-label={label}
    className={`cde-detail-field ${className ?? ''}`}
    role="group">
    <div className="cde-detail-field-label d-flex items-center gap-2">
      <Typography.Text className="text-sm font-medium">{label}</Typography.Text>
      {action}
    </div>
    <div className="cde-detail-field-value">{children}</div>
  </div>
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
  const { t } = useTranslation();
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const selectedTags = (glossaryTerm.tags ?? []).filter(
    (tag) => tag.tagFQN.split('.')[0] === classification
  );
  const isDraft =
    !glossaryTerm.entityStatus ||
    glossaryTerm.entityStatus === EntityStatus.Draft;
  const hasEditAccess =
    isDraft &&
    !isVersionView &&
    Boolean(permissions?.EditTags || permissions?.EditAll);
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
    setIsEditorOpen(false);
  };

  return (
    <CDEField
      action={
        hasEditAccess ? (
          <TagSelectableList
            classificationFilter={classification}
            hasPermission={hasEditAccess}
            popoverProps={{
              open: isEditorOpen,
              overlayClassName: 'cde-tag-select-popover',
              placement: 'bottomLeft',
              onOpenChange: setIsEditorOpen,
            }}
            searchPlaceholder={t('label.search-for-type', { type: label })}
            selectedTags={selectedTags}
            onCancel={() => setIsEditorOpen(false)}
            onUpdate={handleTagUpdate}>
            <EditIconButton
              size="small"
              title={t('label.edit-entity', { entity: label })}
            />
          </TagSelectableList>
        ) : undefined
      }
      className={`cde-detail-field-${classification}`}
      label={label}>
      <TagsViewer
        displayType={DisplayType.READ_MORE}
        entityFqn={glossaryTerm.fullyQualifiedName ?? glossaryTerm.name}
        showNoDataPlaceholder
        tagType={TagSource.Classification}
        tags={selectedTags}
      />
    </CDEField>
  );
};

const CDEOwnersField = ({ glossaryTerm }: CDEGlossaryTermSummaryProps) => {
  const { data, entityRules, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
  const isDraft =
    !glossaryTerm.entityStatus ||
    glossaryTerm.entityStatus === EntityStatus.Draft;
  const hasEditAccess =
    isDraft &&
    !isVersionView &&
    Boolean(permissions?.EditOwners || permissions?.EditAll);

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
  const isDraft =
    !glossaryTerm.entityStatus ||
    glossaryTerm.entityStatus === EntityStatus.Draft;
  const hasEditAccess =
    isDraft && !isVersionView && Boolean(permissions?.EditAll);

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
  const currentTerm = data ?? glossaryTerm;
  const isDraft =
    !currentTerm.entityStatus ||
    currentTerm.entityStatus === EntityStatus.Draft;
  const hasEditAccess =
    isDraft &&
    !isVersionView &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);

  const rawValue =
    currentTerm.extension?.dataQualityRules ??
    currentTerm.extension?.quy_dinh_chat_luong_du_lieu;

  const qualityValue = (() => {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    if (
      values.some(
        (item) =>
          item === true || item === 'true' || item === 'Y' || item === 'yes'
      )
    ) {
      return 'true';
    }
    if (
      values.some(
        (item) =>
          item === false || item === 'false' || item === 'N' || item === 'no'
      )
    ) {
      return 'false';
    }

    return undefined;
  })();

  const handleSelect = async (val: string) => {
    const updatedExtension = {
      ...(currentTerm.extension ?? {}),
      dataQualityRules: val === 'true' ? ['Y'] : ['N'],
    };
    await onUpdate?.(
      {
        ...currentTerm,
        extension: updatedExtension,
      },
      'extension'
    );
  };

  return (
    <CDEEnumField
      canEdit={hasEditAccess}
      className="cde-detail-field-quality-rule"
      label={t('cde.data-quality-rules')}
      options={[
        { label: t('label.yes'), value: 'true' },
        { label: t('label.no'), value: 'false' },
      ]}
      placement="topRight"
      placeholder={t('cde.not-set')}
      value={qualityValue}
      valueClassName={
        qualityValue === 'true'
          ? 'cde-value-pill-quality'
          : 'cde-value-pill-neutral'
      }
      onChange={handleSelect}
    />
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
  const isDraft =
    !glossaryTerm.entityStatus ||
    glossaryTerm.entityStatus === EntityStatus.Draft;
  const hasEditAccess =
    isDraft &&
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
          <RichTextEditorPreviewerV1 enableSeeMoreVariant markdown={value} />
        ) : (
          <span className="text-grey-muted">{t('cde.no-information')}</span>
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

const CDEValidityFields = ({ glossaryTerm }: CDEGlossaryTermSummaryProps) => {
  const { t } = useTranslation();
  const { data, isVersionView, onUpdate, permissions } =
    useGenericContext<GlossaryTerm>();
  const [editingDate, setEditingDate] = useState<CDEDateField | null>(null);
  const [draftDate, setDraftDate] = useState<DateTime | null>(null);
  const [dateError, setDateError] = useState<string>();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentTerm = data ?? glossaryTerm;
  const extension = currentTerm.extension ?? {};
  const isDraft =
    !currentTerm.entityStatus ||
    currentTerm.entityStatus === EntityStatus.Draft;
  const canEdit =
    isDraft &&
    !isVersionView &&
    Boolean(permissions?.EditAll || permissions?.EditCustomFields);

  const openEditor = (key: CDEDateField) => {
    const currentValue = extension[key];
    setDraftDate(
      typeof currentValue === 'string' ? DateTime.fromISO(currentValue) : null
    );
    setDateError(undefined);
    setEditingDate(key);
    setIsPickerOpen(true);
  };

  const closeEditor = () => {
    setEditingDate(null);
    setDraftDate(null);
    setDateError(undefined);
    setIsPickerOpen(false);
  };

  const save = async (key: CDEDateField) => {
    try {
      const value = draftDate?.toFormat('yyyy-MM-dd') ?? '';
      const error = validateCDEDates({ ...extension, [key]: value });
      if (error) {
        setDateError(t(error));

        return;
      }
      setSaving(true);
      await onUpdate?.(
        {
          ...currentTerm,
          extension: mergeCDEDates(extension, { [key]: value }),
        },
        'extension'
      );
      closeEditor();
    } catch (error) {
      if (!(error && typeof error === 'object' && 'errorFields' in error)) {
        showErrorToast(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {(['effectiveDate', 'expirationDate'] as const).map((key) => (
        <CDEField
          action={
            canEdit && editingDate !== key ? (
              <EditIconButton
                size="small"
                title={t('label.edit')}
                onClick={() => openEditor(key)}
              />
            ) : undefined
          }
          key={key}
          label={t(
            key === 'effectiveDate'
              ? 'cde.effective-date'
              : 'cde.expiration-date'
          )}>
          {editingDate === key ? (
            <div className="cde-inline-date-editor">
              <DatePicker
                allowClear
                autoFocus
                disabled={saving}
                format="dd/MM/yyyy"
                open={isPickerOpen}
                status={dateError ? 'error' : undefined}
                value={draftDate}
                onChange={(value) => {
                  setDraftDate(value);
                  setDateError(undefined);
                }}
                onOpenChange={setIsPickerOpen}
              />
              <Button
                aria-label={t('label.save')}
                className="cde-inline-date-action"
                icon={<CheckOutlined />}
                loading={saving}
                size="small"
                type="primary"
                onClick={() => save(key)}
              />
              <Button
                aria-label={t('label.cancel')}
                className="cde-inline-date-action"
                disabled={saving}
                icon={<CloseOutlined />}
                size="small"
                onClick={closeEditor}
              />
              {dateError && (
                <Typography.Text className="cde-inline-date-error" type="danger">
                  {dateError}
                </Typography.Text>
              )}
            </div>
          ) : extension[key] ? (
            formatCDEDate(extension[key])
          ) : (
            <span className="text-grey-muted">{t('cde.not-set')}</span>
          )}
        </CDEField>
      ))}
    </>
  );
};

const CDEGlossaryTermSummary = ({
  glossaryTerm,
}: CDEGlossaryTermSummaryProps) => {
  const { t } = useTranslation();

  return (
    <div className="cde-detail-summary">
      <div
        className="cde-detail-summary-group-1"
        data-testid="cde-glossary-term-summary-group-1">
        <CDESection
          title={t('cde.management-information')}
          variant="management">
          <CDEDomainsField glossaryTerm={glossaryTerm} />
          <CDEOwnersField glossaryTerm={glossaryTerm} />
          <CDEReleaseLevelField glossaryTerm={glossaryTerm} />
          <CDEValidityFields glossaryTerm={glossaryTerm} />
        </CDESection>

        <CDESection
          title={t('cde.classification-control')}
          variant="classification">
          <CDETagField
            classification={CDE_TAG_CLASSIFICATIONS.dataSource}
            glossaryTerm={glossaryTerm}
            label={t('cde.data-source')}
          />
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
        </CDESection>
      </div>

      <div
        className="cde-detail-summary-group-2"
        data-testid="cde-glossary-term-summary-group-2">
        <CDESection
          title={t('cde.business-context')}
          variant="context">
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
        </CDESection>
      </div>
    </div>
  );
};

export default CDEGlossaryTermSummary;
