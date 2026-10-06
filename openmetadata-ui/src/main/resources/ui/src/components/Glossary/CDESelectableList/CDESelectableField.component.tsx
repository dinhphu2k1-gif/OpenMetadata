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
import { Space, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityNameUtils';
import CDESelectableList from './CDESelectableList.component';

interface CDESelectableFieldProps {
  dataDictionaryVersion?: string;
  disabled?: boolean;
  selectedCde?: EntityReference;
  onChange: (cde?: EntityReference) => void;
}

/** Form-field trigger around CDESelectableList, so forms pick a CDE from the same popover as the detail pages. */
const CDESelectableField = ({
  dataDictionaryVersion,
  disabled,
  selectedCde,
  onChange,
}: CDESelectableFieldProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CDESelectableList
      dataDictionaryVersion={dataDictionaryVersion}
      isOpen={disabled ? false : isOpen}
      selectedCde={selectedCde}
      onOpenChange={(open) => setIsOpen(!disabled && open)}
      onSelect={async (cde) => {
        onChange(cde);
        setIsOpen(false);
      }}>
      <button
        className="cde-selectable-field ant-input"
        data-testid="cde-selectable-field"
        disabled={disabled}
        type="button">
        {selectedCde ? (
          <Space size={6}>
            <Typography.Text strong className="cde-select-code">
              {selectedCde.name}
            </Typography.Text>
            <Typography.Text type="secondary">
              · {getEntityName(selectedCde)}
            </Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">
            {t('label.search-for-type', { type: t('label.cde-code-ref') })}
          </Typography.Text>
        )}
      </button>
    </CDESelectableList>
  );
};

export default CDESelectableField;
