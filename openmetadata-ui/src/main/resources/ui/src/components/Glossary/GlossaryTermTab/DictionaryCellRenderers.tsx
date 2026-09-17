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

import { LinkOutlined } from '@ant-design/icons';
import { Space, Tag, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { EntityReference, EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { EntityStatusClass } from '../../../utils/EntityStatusUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';

export const getDictionaryReferenceLabel = (reference: EntityReference): string =>
  getEntityName(reference) ||
  reference.fullyQualifiedName ||
  NO_DATA_PLACEHOLDER;

export const renderDictionaryReferences = (
  references: EntityReference[] = []
): string => {
  if (references.length === 0) {
    return NO_DATA_PLACEHOLDER;
  }

  return references.map(getDictionaryReferenceLabel).join(', ');
};

export const renderDictionaryOwnerList = (
  owners?: EntityReference[] | string,
  dataTestIdPrefix = 'cde-owner'
): React.ReactNode => {
  if (!owners || (Array.isArray(owners) && owners.length === 0)) {
    return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
  }

  if (typeof owners === 'string') {
    const trimmed = owners.trim();
    if (!trimmed) {
      return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
    }

    return (
      <div className="cde-owner-list">
        <div
          className="cde-owner-item"
          data-testid={`${dataTestIdPrefix}-${trimmed}`}
          title={trimmed}>
          <ProfilePicture
            className="cde-owner-avatar"
            displayName={trimmed}
            name={trimmed}
            width="24"
          />
          <span className="cde-owner-name">{trimmed}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cde-owner-list">
      {owners.map((owner, index) => {
        const ownerLabel = getDictionaryReferenceLabel(owner);
        const ownerKey =
          owner.id ?? owner.fullyQualifiedName ?? owner.name ?? String(index);

        return (
          <div
            className="cde-owner-item"
            data-testid={`${dataTestIdPrefix}-${ownerKey}`}
            key={ownerKey}
            title={ownerLabel}>
            <ProfilePicture
              className="cde-owner-avatar"
              displayName={owner.displayName}
              isTeam={owner.type === 'team'}
              name={owner.name ?? owner.fullyQualifiedName ?? ''}
              width="24"
            />
            <span className="cde-owner-name">{ownerLabel}</span>
          </div>
        );
      })}
    </div>
  );
};

export const stripHtmlAndMarkdown = (text: string): string =>
  text
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#*_~`[\]()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const renderDictionaryMarkdown = (
  value?: string,
  className?: string
): React.ReactNode => {
  if (!value?.trim()) {
    return NO_DATA_PLACEHOLDER;
  }
  const cleanText = stripHtmlAndMarkdown(value);

  return (
    <Typography.Paragraph
      className={className}
      ellipsis={{ rows: 2, tooltip: cleanText }}
      style={{ marginBottom: 0 }}>
      {cleanText}
    </Typography.Paragraph>
  );
};

export const getDictionaryTagLabel = (tag: TagLabel): string =>
  tag.displayName ??
  tag.name ??
  tag.tagFQN.split('.').at(-1)?.replaceAll('_', ' ') ??
  '';

export const renderDictionaryPastelTag = (
  label: string,
  variant:
    | 'source'
    | 'classification'
    | 'personal'
    | 'dimension'
    | 'quality'
    | 'method'
    | 'frequency'
    | 'atomic'
    | 'transformed'
    | 'neutral'
    | string = 'neutral',
  key?: string
): React.ReactNode => (
  <Tag
    className={classNames('cde-value-pill', `cde-value-pill-${variant}`)}
    key={key ?? label}>
    {label}
  </Tag>
);

export const renderDictionaryClassificationTags = (
  tags: TagLabel[] = [],
  classification: string,
  variant: 'source' | 'classification' | 'personal' | 'population' | 'method' | 'frequency' | 'neutral' = 'neutral'
): React.ReactNode => {
  const matchingTags = tags.filter(
    (tag) => tag.tagFQN.split('.')[0] === classification
  );

  if (matchingTags.length === 0) {
    return NO_DATA_PLACEHOLDER;
  }

  return (
    <Space wrap size={[4, 4]}>
      {matchingTags.map((tag) => (
        <Tag
          className={classNames('cde-value-pill', `cde-value-pill-${variant}`)}
          key={tag.tagFQN}>
          {getDictionaryTagLabel(tag)}
        </Tag>
      ))}
    </Space>
  );
};

export const parseDictionaryEntityStatus = (
  rawStatus?: string | EntityStatus
): EntityStatus => {
  if (!rawStatus) {
    return EntityStatus.Approved;
  }

  const s = String(rawStatus).trim();
  if (s === 'Draft' || s === EntityStatus.Draft) {
    return EntityStatus.Draft;
  }
  if (
    s === 'In Review' ||
    s === 'InReview' ||
    s === 'Pending' ||
    s === EntityStatus.InReview
  ) {
    return EntityStatus.InReview;
  }
  if (s === 'Rejected' || s === EntityStatus.Rejected) {
    return EntityStatus.Rejected;
  }
  if (s === 'Deprecated' || s === EntityStatus.Deprecated) {
    return EntityStatus.Deprecated;
  }

  return EntityStatus.Approved;
};

export const renderDictionaryStatusBadge = (
  status?: string | EntityStatus,
  dataTestId?: string
): React.ReactNode => {
  if (!status) {
    return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
  }

  const entityStatus = parseDictionaryEntityStatus(status);

  return (
    <StatusBadge
      dataTestId={dataTestId}
      label={entityStatus}
      status={EntityStatusClass[entityStatus]}
    />
  );
};

export const renderDictionaryCodeLink = (
  code: string,
  fqn?: string,
  dataTestId?: string,
  title?: string
): React.ReactNode => (
  <Link
    className="cde-code-link cursor-pointer"
    data-testid={dataTestId ?? `cde-code-${code}`}
    title={title ?? code}
    to={getGlossaryPath(fqn ?? code)}>
    {code}
  </Link>
);

export const renderDictionaryCDEPillLink = (
  cdeCode: string,
  cdeFqn?: string,
  cdeName?: string
): React.ReactNode => {
  if (!cdeCode) {
    return <span className="text-grey-muted">{NO_DATA_PLACEHOLDER}</span>;
  }

  const targetFqn = cdeFqn || `Data Dictionary.${cdeCode}`;

  return (
    <Link
      className="tech-cde-link"
      title={cdeName || cdeCode}
      to={getGlossaryPath(targetFqn)}>
      <Tag className="tech-cde-pill">
        <LinkOutlined style={{ fontSize: 11 }} />
        <span>{cdeCode}</span>
      </Tag>
    </Link>
  );
};
