/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { DownOutlined } from '@ant-design/icons';
import { Dropdown, Space, Tag } from 'antd';
import React from 'react';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getCDEReleaseVersionTypeClassName } from '../../../utils/CDEReleaseVersionTypeUtils';
import { getEntityStatusClass } from '../../../utils/EntityStatusUtils';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';

export interface GovernedVersionMenuItem {
  key: string;
  label: React.ReactNode;
}

interface GovernedEntityHeaderBadgesProps {
  businessVersion: string;
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
  const statusClass = getEntityStatusClass(status);
  const versionBadge = (
    <button
      className={`status-badge cde-header-version-badge ${statusClass}`}
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
      <StatusBadge
        dataTestId={statusTestId ?? `${testIdPrefix}-status`}
        label={status}
        status={statusClass}
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
