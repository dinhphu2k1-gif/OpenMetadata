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
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import PendingRequestsTab from '../../common/PendingRequestsTab/PendingRequestsTab.component';
import {
  PendingRequestAction,
  PendingRequestsActionResult,
  PendingRequestsAdapter,
} from '../../common/PendingRequestsTab/PendingRequestsTab.interface';

export interface GlossaryPendingRequestsProps {
  adapter: PendingRequestsAdapter;
  scopeKey: string;
  refreshKey?: number;
  canDecide: boolean;
  onDecided?: (
    result: PendingRequestsActionResult,
    action: PendingRequestAction
  ) => void;
}

/** The pending requests tab of a governed glossary such as the shared Data Dictionary. */
const GlossaryPendingRequests: FC<GlossaryPendingRequestsProps> = ({
  adapter,
  scopeKey,
  refreshKey,
  canDecide,
  onDecided,
}) => {
  const { t } = useTranslation();

  return (
    <PendingRequestsTab
      adapter={adapter}
      canDecide={canDecide}
      refreshKey={refreshKey}
      scopeKey={scopeKey}
      searchPlaceholder={t('cde.search-placeholder')}
      testId="glossary-pending-requests"
      onDecided={onDecided}
    />
  );
};

export default GlossaryPendingRequests;
