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
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { getEntityStatusClass } from '../../../utils/EntityStatusUtils';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../common/StatusBadge/StatusBadge.interface';
import { GovernedStatusBadgeProps } from './GovernedStatusBadge.interface';

/** Single status presentation for governed terms, shared by the list and the detail header. */
const GovernedStatusBadge = ({
  dataTestId,
  deletedBy,
  isDeleted = false,
  status,
}: GovernedStatusBadgeProps) => {
  const { t } = useTranslation();

  if (!isDeleted) {
    return (
      <StatusBadge
        dataTestId={dataTestId}
        label={status}
        status={getEntityStatusClass(status)}
      />
    );
  }

  const deletedBadge = (
    <StatusBadge
      dataTestId={dataTestId}
      displayLabel={t('cde.deleted-record')}
      label={t('cde.deleted-record')}
      status={StatusType.Failure}
    />
  );

  return deletedBy ? (
    <Tooltip title={deletedBy}>{deletedBadge}</Tooltip>
  ) : (
    deletedBadge
  );
};

export default GovernedStatusBadge;
