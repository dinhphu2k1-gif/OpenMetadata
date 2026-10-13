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
import {
  ArchiveReason,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';

/**
 * A governed record is "deleted" when a user deleted it. The list marks it with `recordType` and
 * the detail payload carries the archive reason recorded when the snapshot was archived.
 */
export const isDeletedRecord = (
  record: Pick<GlossaryTerm, 'archiveReason'> & { recordType?: string }
): boolean =>
  record.recordType === 'deleted' ||
  record.archiveReason === ArchiveReason.Deleted;
