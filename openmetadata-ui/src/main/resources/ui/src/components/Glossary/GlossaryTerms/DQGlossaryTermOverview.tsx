/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { GlossaryTermDetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getGlossaryTermWidgetFromKey } from '../../../utils/GlossaryTerm/GlossaryTermUtil';
import DQTestSpecsCard from '../DQRuleTests/DQTestSpecsCard.component';
import DQGlossaryTermSummary from './DQGlossaryTermSummary';

interface DQGlossaryTermOverviewProps {
  glossaryTerm: GlossaryTerm;
}

const DQ_BUSINESS_MEANING_WIDGET = {
  i: GlossaryTermDetailPageWidgetKeys.DESCRIPTION,
} as WidgetConfig;

const DQGlossaryTermOverview = ({
  glossaryTerm,
}: DQGlossaryTermOverviewProps) => {
  const { t } = useTranslation();

  return (
    <section
      className="cde-glossary-term-overview dq-glossary-term-overview"
      data-testid="dq-glossary-term-overview">
      <div
        className={classNames(
          'cde-glossary-term-description dq-glossary-term-description',
          {
            'cde-glossary-term-description-empty': !glossaryTerm.description,
          }
        )}>
        {getGlossaryTermWidgetFromKey(
          DQ_BUSINESS_MEANING_WIDGET,
          t('dq.business-rule')
        )}
      </div>
      <div className="cde-glossary-term-overview-summary dq-glossary-term-overview-summary">
        <DQGlossaryTermSummary glossaryTerm={glossaryTerm} />
        <DQTestSpecsCard
          ruleThreshold={glossaryTerm.extension?.qualityThreshold}
          specs={glossaryTerm.dataQualityTestSpecs}
        />
      </div>
    </section>
  );
};

export default DQGlossaryTermOverview;
