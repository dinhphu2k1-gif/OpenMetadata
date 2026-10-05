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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { previewDqRuleTests } from '../../../rest/dqRuleTestAPI';
import { DQPreview } from './DQRuleTests.interface';

interface DQApprovePreviewProps {
  rule: GlossaryTerm;
}

/** Tells the approver how many testcases approving the Rule will create. */
const DQApprovePreview = ({ rule }: DQApprovePreviewProps) => {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<DQPreview>();
  const specs = rule.dataQualityTestSpecs;
  const cdeTermId = rule.relatedTerms?.find((relation) => relation.term?.id)
    ?.term?.id;

  useEffect(() => {
    if (specs?.items?.length && cdeTermId) {
      previewDqRuleTests(cdeTermId, specs)
        .then(setPreview)
        .catch(() => setPreview(undefined));
    }
  }, [specs, cdeTermId]);

  if (!preview) {
    return null;
  }

  return (
    <div data-testid="dq-approve-preview">
      {t('dq.test.approve-summary', {
        specs: preview.totals.specs,
        columns: preview.totals.columns,
        testCases: preview.totals.testCases,
        notApplicable: preview.totals.notApplicable,
      })}
    </div>
  );
};

export default DQApprovePreview;
