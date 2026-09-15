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

import { Tag, Tooltip } from 'antd';
import React, { useMemo } from 'react';
import { SurvivorshipRule } from './survivorship.interface';

interface SurvivorshipBadgeProps {
  rule?: SurvivorshipRule;
}

export const SurvivorshipBadge: React.FC<SurvivorshipBadgeProps> = ({
  rule,
}) => {
  const rank = rule?.rank;
  const note = rule?.note;

  const badgeInfo = useMemo(() => {
    if (!rank) {
      return null;
    }
    switch (rank) {
      case 1:
        return {
          icon: '🥇',
          label: 'Hạng 1 (Nguồn Vàng)',
          style: {
            backgroundColor: '#fffbe6',
            borderColor: '#ffe58f',
            color: '#d48806',
            fontWeight: 600,
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          },
        };
      case 2:
        return {
          icon: '🥈',
          label: 'Hạng 2',
          style: {
            backgroundColor: '#f5f5f5',
            borderColor: '#d9d9d9',
            color: '#595959',
            fontWeight: 600,
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          },
        };
      case 3:
        return {
          icon: '🥉',
          label: 'Hạng 3',
          style: {
            backgroundColor: '#fff7e6',
            borderColor: '#ffd591',
            color: '#d46b08',
            fontWeight: 600,
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          },
        };
      default:
        return {
          icon: '🏷️',
          label: `Hạng ${rank}`,
          style: {
            backgroundColor: '#fff0f2',
            borderColor: '#ffccd3',
            color: '#AE1C3F',
            fontWeight: 500,
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          },
        };
    }
  }, [rank]);

  if (!badgeInfo) {
    return null;
  }

  const { icon, label, style } = badgeInfo;

  const badgeContent = (
    <Tag className="survivorship-badge m-0" style={style}>
      <span>{icon}</span>
      <span>{label}</span>
    </Tag>
  );

  if (note) {
    return (
      <Tooltip title={`Quy tắc sinh tồn: ${note}`}>
        {badgeContent}
      </Tooltip>
    );
  }

  return badgeContent;
};

export default SurvivorshipBadge;
