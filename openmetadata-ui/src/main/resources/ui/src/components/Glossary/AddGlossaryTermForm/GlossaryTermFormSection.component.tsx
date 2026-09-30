/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import classNames from 'classnames';
import { ReactNode } from 'react';

interface GlossaryTermFormSectionProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description?: ReactNode;
  readOnly?: boolean;
  title: string;
}

const GlossaryTermFormSection = ({
  children,
  className = '',
  contentClassName,
  description,
  readOnly = false,
  title,
}: GlossaryTermFormSectionProps) => (
  <section
    className={classNames('cde-form-section', className, {
      'cde-form-section-has-description': Boolean(description),
      'governed-form-section-readonly': readOnly,
    })}>
    <header className="cde-form-section-header">
      <span aria-hidden="true" className="cde-form-section-marker" />
      <div>
        <h3 className="cde-form-section-title">{title}</h3>
        {description && (
          <p className="cde-form-section-description">{description}</p>
        )}
      </div>
    </header>
    <div className={classNames('cde-form-grid', contentClassName)}>
      {children}
    </div>
  </section>
);

export default GlossaryTermFormSection;
