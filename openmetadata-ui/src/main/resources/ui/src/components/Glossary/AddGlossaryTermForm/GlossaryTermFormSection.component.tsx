/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { ReactNode } from 'react';

interface GlossaryTermFormSectionProps {
  children: ReactNode;
  className?: string;
  title: string;
}

const GlossaryTermFormSection = ({
  children,
  className = '',
  title,
}: GlossaryTermFormSectionProps) => (
  <section className={`cde-form-section ${className}`}>
    <header className="cde-form-section-header">
      <span aria-hidden="true" className="cde-form-section-marker" />
      <h3 className="cde-form-section-title">{title}</h3>
    </header>
    <div className="cde-form-grid">{children}</div>
  </section>
);

export default GlossaryTermFormSection;
