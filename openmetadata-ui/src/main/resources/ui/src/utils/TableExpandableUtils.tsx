/*
 *  Copyright 2022 Collate.
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

import Icon from '@ant-design/icons';
import { ExpandableConfig } from 'antd/lib/table/interface';
import classNames from 'classnames';
import { ReactComponent as IconDrag } from '../assets/svg/drag.svg';
import { ReactComponent as IconDown } from '../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../assets/svg/ic-arrow-right.svg';

export function getTableExpandableConfig<T>(
  isDraggable?: boolean,
  expandIconClass?: string
): ExpandableConfig<T> {
  const expandableConfig: ExpandableConfig<T> = {
    expandIcon: ({ expanded, onExpand, expandable, record }) =>
      expandable ? (
        <>
          {isDraggable && <IconDrag className="drag-icon" />}
          <Icon
            className={classNames(
              'table-expand-icon vertical-baseline',
              expandIconClass
            )}
            component={expanded ? IconDown : IconRight}
            data-testid="expand-icon"
            onClick={(e) => onExpand(record, e)}
          />
        </>
      ) : (
        isDraggable && (
          <>
            <IconDrag className="drag-icon" />
            <span className="expand-cell-empty-icon-container" />
          </>
        )
      ),
  };

  return expandableConfig;
}
