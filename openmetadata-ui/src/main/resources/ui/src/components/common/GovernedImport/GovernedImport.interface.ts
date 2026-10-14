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
import { ReactNode } from 'react';
import { TitleBreadcrumbProps } from '../TitleBreadcrumb/TitleBreadcrumb.interface';

export type GovernedImportStatusFilter = 'all' | 'failure' | 'success';

export interface GovernedImportLayoutProps {
  pageTitle: string;
  breadcrumb: TitleBreadcrumbProps['titleLinks'];
  steps: Array<{ name: string; step: number }>;
  activeStep: number;
  testId?: string;
  children: ReactNode;
}

export interface GovernedImportUploadStepProps {
  /** Shown above the drop area, e.g. the version the file is imported into. */
  notice?: ReactNode;
  /** Choices under the drop area, e.g. what to do with an existing code. */
  options?: ReactNode;
  accept?: string;
  isDisabled?: boolean;
  isParsing?: boolean;
  testId?: string;
  templateTestId?: string;
  onFileSelect: (file: File) => boolean | Promise<boolean>;
  onDownloadTemplate: () => void;
  onCancel?: () => void;
}

export interface GovernedImportValidationHeaderProps {
  failed: number;
  passed: number;
  total: number;
  filter: GovernedImportStatusFilter;
  onFilterChange: (filter: GovernedImportStatusFilter) => void;
}

export interface GovernedImportProgressProps {
  title: string;
  percent: number;
  currentName?: string;
}

export interface GovernedImportFooterAction {
  label: string;
  testId: string;
  isDisabled?: boolean;
  isLoading?: boolean;
  onClick: () => void;
}

export interface GovernedImportFooterProps {
  /** Offered while the rows are edited. */
  onAddRow?: () => void;
  isBackDisabled?: boolean;
  primary: GovernedImportFooterAction;
  onBack: () => void;
}
