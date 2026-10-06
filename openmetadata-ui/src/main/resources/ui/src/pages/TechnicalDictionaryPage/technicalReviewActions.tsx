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
  approveTechnicalChangeRequest,
  approveTechnicalRecord,
  rejectTechnicalChangeRequest,
  rejectTechnicalRecord,
  submitTechnicalChangeRequest,
  submitTechnicalRecord,
} from '../../rest/technicalDictionaryAPI';

/** What can be done to the records of the table: send drafts, then approve or reject them. */
export type TechnicalReviewAction = 'submit' | 'approve' | 'reject';

interface TechnicalReviewActionConfig {
  resultTitleKey: string;
  resultDescriptionKey: string;
  succeededKey: string;
  recordToastKey: string;
  bulkToastKey: string;
}

export const TECHNICAL_REVIEW_ACTIONS: Record<
  TechnicalReviewAction,
  TechnicalReviewActionConfig
> = {
  submit: {
    resultTitleKey: 'label.technical-bulk-submit-result',
    resultDescriptionKey: 'message.technical-bulk-submit-result-description',
    succeededKey: 'label.technical-result-submitted',
    recordToastKey: 'message.technical-record-submitted',
    bulkToastKey: 'message.technical-bulk-submitted',
  },
  approve: {
    resultTitleKey: 'label.technical-bulk-approve-result',
    resultDescriptionKey: 'message.technical-bulk-result-description',
    succeededKey: 'label.approved',
    recordToastKey: 'message.technical-record-approved',
    bulkToastKey: 'message.technical-bulk-approved',
  },
  reject: {
    resultTitleKey: 'label.technical-bulk-reject-result',
    resultDescriptionKey: 'message.technical-bulk-result-description',
    succeededKey: 'label.rejected',
    recordToastKey: 'message.technical-record-rejected',
    bulkToastKey: 'message.technical-bulk-rejected',
  },
};

/** The single-record API of each review action, for a record and for its pending change. */
export const RECORD_ACTIONS = {
  submit: submitTechnicalRecord,
  approve: approveTechnicalRecord,
  reject: rejectTechnicalRecord,
};

export const CHANGE_ACTIONS = {
  submit: submitTechnicalChangeRequest,
  approve: approveTechnicalChangeRequest,
  reject: rejectTechnicalChangeRequest,
};
