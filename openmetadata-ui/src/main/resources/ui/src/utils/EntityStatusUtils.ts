/*
 *  Copyright 2025 Collate.
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

import { isNil } from 'lodash';
import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { EntityStatus } from '../generated/entity/data/glossaryTerm';
import i18n from './i18next/LocalUtil';

export const EntityStatusClass: Record<EntityStatus, StatusType> = {
  [EntityStatus.Approved]: StatusType.Success,
  [EntityStatus.Draft]: StatusType.Pending,
  [EntityStatus.Rejected]: StatusType.Failure,
  [EntityStatus.Deprecated]: StatusType.Deprecated,
  [EntityStatus.InReview]: StatusType.InReview,
  [EntityStatus.Unprocessed]: StatusType.Pending,
  [EntityStatus.Archived]: StatusType.Archived,
};

export const ENTITY_STATUS_TRANSLATION_KEYS: Record<EntityStatus, string> = {
  [EntityStatus.Approved]: 'label.approved',
  [EntityStatus.Draft]: 'label.draft',
  [EntityStatus.Rejected]: 'label.rejected',
  [EntityStatus.Deprecated]: 'label.deprecated',
  [EntityStatus.InReview]: 'label.in-review',
  [EntityStatus.Unprocessed]: 'label.unprocessed',
  [EntityStatus.Archived]: 'label.archived',
};

export const isEntityStatus = (status: unknown): status is EntityStatus => {
  return (
    typeof status === 'string' &&
    Object.values(EntityStatus).includes(status as EntityStatus)
  );
};

export const getEntityStatusLabel = (
  status?: EntityStatus | string
): string => {
  if (!status) {
    return '';
  }
  const key = ENTITY_STATUS_TRANSLATION_KEYS[status as EntityStatus];

  return key ? i18n.t(key) : String(status);
};

export const getEntityStatusClass = (status: EntityStatus): StatusType => {
  return EntityStatusClass[status] ?? StatusType.Pending;
};

export const isDeleted = (deleted: unknown): boolean => {
  return (deleted as string) === 'false' || deleted === false || isNil(deleted)
    ? false
    : true;
};

