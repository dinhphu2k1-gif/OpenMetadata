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
import { useTranslation } from 'react-i18next';
import StatusBadge from '../../components/common/StatusBadge/StatusBadge.component';
import { EntityStatus } from '../../generated/entity/data/glossaryTerm';
import { TechnicalRecordStatus } from '../../rest/technicalDictionaryAPI';
import { getEntityStatusClass } from '../../utils/EntityStatusUtils';

const TECHNICAL_STATUS_TO_ENTITY_STATUS: Record<
  TechnicalRecordStatus,
  EntityStatus
> = {
  Draft: EntityStatus.Draft,
  Approved: EntityStatus.Approved,
  Rejected: EntityStatus.Rejected,
  Archived: EntityStatus.Archived,
  'In Review': EntityStatus.InReview,
};

const DISPLAY_LABEL_KEYS: Partial<Record<TechnicalRecordStatus, string>> = {
  Draft: 'label.technical-draft',
  'In Review': 'label.technical-in-review',
};

interface TechnicalStatusBadgeProps {
  status: TechnicalRecordStatus;
  dataTestId?: string;
}

/** The approval status of a record, as shown in the table and in the record modal. */
const TechnicalStatusBadge = ({
  status,
  dataTestId,
}: TechnicalStatusBadgeProps) => {
  const { t } = useTranslation();
  const entityStatus = TECHNICAL_STATUS_TO_ENTITY_STATUS[status];
  const labelKey = DISPLAY_LABEL_KEYS[status];

  return (
    <StatusBadge
      dataTestId={dataTestId}
      displayLabel={labelKey ? t(labelKey) : undefined}
      label={entityStatus}
      status={getEntityStatusClass(entityStatus)}
    />
  );
};

export default TechnicalStatusBadge;
