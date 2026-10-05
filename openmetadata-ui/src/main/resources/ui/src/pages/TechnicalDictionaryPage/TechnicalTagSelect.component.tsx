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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SingleClassificationSelect from '../../components/common/ClassificationSelect/SingleClassificationSelect.component';
import { tagsToClassificationOptions } from '../../components/common/ClassificationSelect/useClassificationOptions';
import { Tag } from '../../generated/entity/classification/tag';

interface TechnicalTagSelectProps {
  tags: Tag[];
  /** Field label, reused for the placeholder and the search hint. */
  label: string;
  /** Suffix of the `cde-value-pill-*` class, matching the column in the table. */
  variant: string;
  loading?: boolean;
  disabled?: boolean;
  dataTestId?: string;
  value?: string;
  onChange?: (value?: string) => void;
}

/** Technical dictionary field: Tag[] from the options hook, a single FQN as the value. */
const TechnicalTagSelect = ({
  tags,
  label,
  variant,
  loading,
  disabled,
  dataTestId,
  value,
  onChange,
}: TechnicalTagSelectProps) => {
  const { t } = useTranslation();
  const options = useMemo(() => tagsToClassificationOptions(tags), [tags]);

  return (
    <SingleClassificationSelect
      dataTestId={dataTestId}
      disabled={disabled}
      loading={loading}
      options={options}
      placeholder={t('label.select-field', { field: label.toLowerCase() })}
      searchPlaceholder={t('label.search-for-type', { type: label })}
      value={value}
      variant={variant}
      onChange={onChange}
    />
  );
};

export default TechnicalTagSelect;
