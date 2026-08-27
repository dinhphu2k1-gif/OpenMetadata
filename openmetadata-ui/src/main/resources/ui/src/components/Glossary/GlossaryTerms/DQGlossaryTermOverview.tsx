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

import { Col, Row } from 'antd';
import { GlossaryTermDetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { WidgetConfig } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { getGlossaryTermWidgetFromKey } from '../../../utils/GlossaryTerm/GlossaryTermUtil';
import DQGlossaryTermSummary from './DQGlossaryTermSummary';

interface DQGlossaryTermOverviewProps {
  glossaryTerm: GlossaryTerm;
}

const DQ_RIGHT_PANEL_WIDGETS = [
  GlossaryTermDetailPageWidgetKeys.REVIEWER,
] as const;

const DQ_BUSINESS_MEANING_WIDGET = {
  i: GlossaryTermDetailPageWidgetKeys.DESCRIPTION,
} as WidgetConfig;

const DQGlossaryTermOverview = ({
  glossaryTerm,
}: DQGlossaryTermOverviewProps) => (
  <section
    className="dq-glossary-term-overview"
    data-testid="dq-glossary-term-overview">
    <Row gutter={[16, 16]}>
      <Col lg={14} md={14} sm={24} xs={24}>
        <div className="dq-glossary-term-overview-panel dq-glossary-term-description">
          {getGlossaryTermWidgetFromKey(DQ_BUSINESS_MEANING_WIDGET)}
        </div>
      </Col>
      <Col lg={10} md={10} sm={24} xs={24}>
        <aside
          className="dq-glossary-term-overview-panel dq-glossary-term-overview-reviewers"
          data-testid="dq-overview-reviewers">
          {DQ_RIGHT_PANEL_WIDGETS.map((widgetKey) => (
            <div data-testid={`dq-overview-${widgetKey}`} key={widgetKey}>
              {getGlossaryTermWidgetFromKey({
                i: widgetKey,
              } as WidgetConfig)}
            </div>
          ))}
        </aside>
      </Col>
    </Row>
    <div className="dq-glossary-term-overview-summary">
      <DQGlossaryTermSummary glossaryTerm={glossaryTerm} />
    </div>
  </section>
);

export default DQGlossaryTermOverview;
