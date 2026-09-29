/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { Form, Input } from 'antd';
import React from 'react';

interface GovernedVersionFieldsProps {
  bindToForm?: boolean;
  releaseVersionType?: string;
  releaseVersionTypeLabel: string;
  releaseVersionTypeTestId?: string;
  version?: string;
  versionLabel: string;
  versionRequired?: boolean;
  versionTestId?: string;
}

/** Shared immutable release fields used by CDE, DQ and Technical Dictionary forms. */
const GovernedVersionFields = ({
  bindToForm = true,
  releaseVersionType,
  releaseVersionTypeLabel,
  releaseVersionTypeTestId,
  version,
  versionLabel,
  versionRequired = false,
  versionTestId,
}: GovernedVersionFieldsProps) => (
  <>
    <Form.Item
      required={versionRequired}
      className="governed-form-version"
      label={versionLabel}
      name={bindToForm ? 'version' : undefined}
      rules={
        bindToForm && versionRequired
          ? [{ required: true, whitespace: true }]
          : undefined
      }>
      <Input
        disabled
        data-testid={versionTestId}
        placeholder="1.0"
        {...(!bindToForm ? { value: version ?? '--' } : {})}
      />
    </Form.Item>
    <Form.Item
      className="governed-form-release-version-type"
      label={releaseVersionTypeLabel}
      name={bindToForm ? 'releaseVersionType' : undefined}>
      <Input
        disabled
        data-testid={releaseVersionTypeTestId}
        {...(!bindToForm ? { value: releaseVersionType ?? '--' } : {})}
      />
    </Form.Item>
  </>
);

export default GovernedVersionFields;
