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

import { render, screen } from '@testing-library/react';
import { GlossaryTermDetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { getGlossaryTermWidgetFromKey } from '../../../utils/GlossaryTerm/GlossaryTermUtil';
import CDEGlossaryTermOverview from './CDEGlossaryTermOverview';

jest.mock('./CDEGlossaryTermSummary', () =>
  jest.fn().mockImplementation(() => <div>CDEGlossaryTermSummary</div>)
);

jest.mock('../../../utils/GlossaryTerm/GlossaryTermUtil', () => ({
  getGlossaryTermWidgetFromKey: jest
    .fn()
    .mockImplementation((widgetConfig) => <div>{widgetConfig.i}</div>),
}));

describe('CDEGlossaryTermOverview', () => {
  it('renders a focused full-width description and the CDE summary', () => {
    render(
      <CDEGlossaryTermOverview
        glossaryTerm={{ name: 'CDE1' } as GlossaryTerm}
      />
    );

    expect(screen.getByText('CDEGlossaryTermSummary')).toBeInTheDocument();
    expect(
      screen.getByText(GlossaryTermDetailPageWidgetKeys.DESCRIPTION)
    ).toBeInTheDocument();

    expect(
      screen.queryByText(GlossaryTermDetailPageWidgetKeys.REVIEWER)
    ).not.toBeInTheDocument();

    expect(getGlossaryTermWidgetFromKey).toHaveBeenCalledWith(
      expect.objectContaining({
        i: GlossaryTermDetailPageWidgetKeys.DESCRIPTION,
      })
    );
    expect(
      screen.queryByText(GlossaryTermDetailPageWidgetKeys.WORKFLOW_HISTORY)
    ).not.toBeInTheDocument();
    expect(getGlossaryTermWidgetFromKey).toHaveBeenCalledTimes(1);
  });
});
