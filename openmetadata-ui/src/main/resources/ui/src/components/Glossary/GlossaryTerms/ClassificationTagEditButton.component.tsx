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
import { Popover } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TagLabel } from '../../../generated/type/tagLabel';
import ClassificationSelectPanel from '../../common/ClassificationSelect/ClassificationSelectPanel.component';
import {
  toClassificationTagLabels,
  useClassificationOptions,
} from '../../common/ClassificationSelect/useClassificationOptions';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';

interface ClassificationTagEditButtonProps {
  classification: string;
  label: string;
  value: TagLabel[];
  onUpdate: (tags: TagLabel[]) => Promise<void>;
}

/**
 * Edit button of a detail-page field holding the tags of one classification.
 * The options load once with the field, so the popover opens at its final size.
 */
const ClassificationTagEditButton = ({
  classification,
  label,
  value,
  onUpdate,
}: ClassificationTagEditButtonProps) => {
  const { t } = useTranslation();
  const { options, isLoading } = useClassificationOptions(classification);
  const [isOpen, setIsOpen] = useState(false);

  const handleUpdate = async (fqns: string[]) => {
    await onUpdate(toClassificationTagLabels(fqns, options, value));
    setIsOpen(false);
  };

  return (
    <Popover
      destroyTooltipOnHide
      content={
        <ClassificationSelectPanel
          dataTestId={`cde-tag-editor-${classification}`}
          mode="multiple"
          options={options}
          searchPlaceholder={t('label.search-for-type', { type: label })}
          value={value.map((tag) => tag.tagFQN)}
          onCancel={() => setIsOpen(false)}
          onUpdate={handleUpdate}
        />
      }
      open={isOpen}
      overlayClassName="classification-select-popover cde-enum-field-popover"
      placement="bottomLeft"
      showArrow={false}
      trigger="click"
      onOpenChange={(open) => setIsOpen(open && !isLoading)}>
      <EditIconButton
        aria-busy={isLoading}
        size="small"
        title={t('label.edit-entity', { entity: label })}
      />
    </Popover>
  );
};

export default ClassificationTagEditButton;
