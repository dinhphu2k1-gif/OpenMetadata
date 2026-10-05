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

import { StarFilled } from '@ant-design/icons';
import { Tooltip } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SurvivorshipRule } from './survivorship.interface';
import './survivorship-badge.less';

interface SurvivorshipBadgeProps {
  rule?: SurvivorshipRule;
}

/** Only rank 1 is emphasised with a star; other ranks stay plain text. */
export const SurvivorshipBadge: React.FC<SurvivorshipBadgeProps> = ({
  rule,
}) => {
  const { t } = useTranslation();
  const rank = rule?.rank;
  const note = rule?.note;

  if (!rank) {
    return null;
  }

  const isTop = rank === 1;
  const badgeContent = (
    <span
      className={classNames('survivorship-rank', {
        'survivorship-rank--top': isTop,
      })}
      data-testid="survivorship-rank">
      {isTop && (
        <StarFilled
          className="survivorship-rank-icon"
          data-testid="survivorship-rank-star"
        />
      )}
      {t('label.rank-number', { rank })}
    </span>
  );

  if (note) {
    return (
      <Tooltip title={`Quy tắc sinh tồn: ${note}`}>{badgeContent}</Tooltip>
    );
  }

  return badgeContent;
};

export default SurvivorshipBadge;
