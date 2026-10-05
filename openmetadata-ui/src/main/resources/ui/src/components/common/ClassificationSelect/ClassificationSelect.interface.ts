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

export interface ClassificationOption {
  /** Tag fully qualified name. */
  value: string;
  label: string;
  /** Overrides the select-level pill colour for this option. */
  variant?: string;
}

export interface ClassificationSelectProps {
  /** `single` replaces the staged pick; `multiple` toggles it. Both commit on Update. */
  mode?: 'single' | 'multiple';
  options: ClassificationOption[];
  /** Selected tag FQNs; at most one entry in `single` mode. */
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  /** Suffix of the `cde-value-pill-*` class that colours the selected pills. */
  variant?: string;
  loading?: boolean;
  disabled?: boolean;
  dataTestId?: string;
}
