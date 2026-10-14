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
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { getEntityStatusLabel } from '../../../utils/EntityStatusUtils';
import i18n from '../../../utils/i18next/LocalUtil';

/** What a version entry is besides its approval status. */
export enum GovernedVersionKind {
  Deleted = 'deleted',
  DeletionRequest = 'deletionRequest',
  CorrectionDraft = 'correctionDraft',
}

const KIND_LABEL_KEYS: Record<GovernedVersionKind, string> = {
  [GovernedVersionKind.Deleted]: 'cde.deleted-record',
  [GovernedVersionKind.DeletionRequest]: 'cde.deletion-request-tag',
  [GovernedVersionKind.CorrectionDraft]: 'label.correction-draft',
};

/** One label for every governed version dropdown: `Version: 1.1 — Approved`. */
export const getGovernedVersionLabel = (
  version: string,
  status: EntityStatus,
  kind?: GovernedVersionKind
): string =>
  `${i18n.t('label.version')}: ${version} — ${
    kind ? i18n.t(KIND_LABEL_KEYS[kind]) : getEntityStatusLabel(status)
  }`;
