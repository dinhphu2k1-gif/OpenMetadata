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

import { GlossaryTermDetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import classNames from 'classnames';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getGlossaryTermWidgetFromKey } from '../../../utils/GlossaryTerm/GlossaryTermUtil';
import CDEGlossaryTermSummary from './CDEGlossaryTermSummary';

interface CDEGlossaryTermOverviewProps {
  glossaryTerm: GlossaryTerm;
}

const CDE_BUSINESS_MEANING_WIDGET = {
  i: GlossaryTermDetailPageWidgetKeys.DESCRIPTION,
} as WidgetConfig;

const CDEGlossaryTermOverview = ({
  glossaryTerm,
}: CDEGlossaryTermOverviewProps) => (
  <section
    className="cde-glossary-term-overview"
    data-testid="cde-glossary-term-overview">
    <div
      className={classNames(
        'cde-glossary-term-overview-panel cde-glossary-term-description',
        {
          'cde-glossary-term-description-empty': !glossaryTerm.description,
        }
      )}>
      {getGlossaryTermWidgetFromKey(CDE_BUSINESS_MEANING_WIDGET)}
    </div>
    <div className="cde-glossary-term-overview-summary">
      <CDEGlossaryTermSummary glossaryTerm={glossaryTerm} />
    </div>
  </section>
);

export default CDEGlossaryTermOverview;
