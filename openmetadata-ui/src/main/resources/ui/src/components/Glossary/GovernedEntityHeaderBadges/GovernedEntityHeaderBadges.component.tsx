/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { DownOutlined } from '@ant-design/icons';
import { Dropdown, Space, Tag } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getCDEReleaseVersionTypeClassName } from '../../../utils/CDEReleaseVersionTypeUtils';
import { getEntityStatusClass } from '../../../utils/EntityStatusUtils';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import GovernedStatusBadge from '../GovernedStatusBadge/GovernedStatusBadge.component';

export interface GovernedVersionMenuItem {
  key: string;
  label: React.ReactNode;
}

interface GovernedEntityHeaderBadgesProps {
  businessVersion: string;
  deletedBy?: string;
  isDeleted?: boolean;
  isLoadingVersions?: boolean;
  loadingLabel?: string;
  onVersionMenuOpen?: (open: boolean) => void;
  onVersionSelect?: (version: string) => void;
  releaseVersionType?: string;
  releaseVersionTypeTestId?: string;
  status: EntityStatus;
  statusTestId?: string;
  testIdPrefix?: string;
  versionButtonTestId?: string;
  versionItems?: GovernedVersionMenuItem[];
  versionLabel: string;
  versionSelectionDisabled?: boolean;
}

/** Shared governed header status/version presentation for CDE, DQ and Technical Dictionary. */
const GovernedEntityHeaderBadges = ({
  businessVersion,
  deletedBy,
  isDeleted = false,
  isLoadingVersions = false,
  loadingLabel = 'Loading',
  onVersionMenuOpen,
  onVersionSelect,
  releaseVersionType,
  releaseVersionTypeTestId,
  status,
  statusTestId,
  testIdPrefix = 'governed-entity',
  versionButtonTestId,
  versionItems = [],
  versionLabel,
  versionSelectionDisabled = false,
}: GovernedEntityHeaderBadgesProps) => {
  // The version badge always carries the same color as the status badge next to it.
  const statusClass = isDeleted
    ? StatusType.Failure
    : getEntityStatusClass(status);
  const versionBadge = (
    <button
      className={classNames(
        'status-badge cde-header-version-badge',
        statusClass
      )}
      data-testid={versionButtonTestId ?? `${testIdPrefix}-version-button`}
      type="button">
      <span className={`status-badge-label ${statusClass}`}>
        {`${versionLabel}: ${businessVersion}`}
      </span>
      {!versionSelectionDisabled && <DownOutlined />}
    </button>
  );

  return (
    <Space align="center" size={8}>
      <GovernedStatusBadge
        dataTestId={statusTestId ?? `${testIdPrefix}-status`}
        deletedBy={deletedBy}
        isDeleted={isDeleted}
        status={status}
      />
      {versionSelectionDisabled ? (
        versionBadge
      ) : (
        <Dropdown
          menu={{
            items: isLoadingVersions
              ? [{ key: 'loading', label: loadingLabel, disabled: true }]
              : versionItems,
            onClick: ({ key }) => onVersionSelect?.(key),
          }}
          trigger={['click']}
          onOpenChange={onVersionMenuOpen}>
          {versionBadge}
        </Dropdown>
      )}
      {releaseVersionType && (
        <Tag
          className={`cde-value-pill cde-header-release-version-type ${getCDEReleaseVersionTypeClassName(
            releaseVersionType
          )}`}
          data-testid={
            releaseVersionTypeTestId ?? `${testIdPrefix}-release-version-type`
          }>
          {releaseVersionType}
        </Tag>
      )}
    </Space>
  );
};

export default GovernedEntityHeaderBadges;
