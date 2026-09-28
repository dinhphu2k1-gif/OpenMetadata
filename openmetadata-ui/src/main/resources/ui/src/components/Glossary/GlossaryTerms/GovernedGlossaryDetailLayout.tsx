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

import { Typography } from 'antd';
import { ReactNode } from 'react';

interface GovernedGlossaryFieldProps {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
}

interface GovernedGlossarySectionProps {
  children: ReactNode;
  className?: string;
  title: string;
  variant: 'classification' | 'context' | 'management';
}

export const GovernedGlossarySection = ({
  children,
  className,
  title,
  variant,
}: GovernedGlossarySectionProps) => (
  <section
    className={`cde-detail-section cde-detail-section-${variant} ${className ?? ''}`}>
    <header className="cde-detail-section-header">
      <span aria-hidden="true" className="cde-detail-section-marker" />
      <Typography.Title className="cde-detail-section-title" level={5}>
        {title}
      </Typography.Title>
    </header>
    <div className="cde-detail-section-grid">{children}</div>
  </section>
);

export const GovernedGlossaryField = ({
  action,
  children,
  className,
  label,
}: GovernedGlossaryFieldProps) => (
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
