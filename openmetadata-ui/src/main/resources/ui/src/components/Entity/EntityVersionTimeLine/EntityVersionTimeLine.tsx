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
import { Button, Col, Divider, Drawer, Row, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty, toString } from 'lodash';
import { forwardRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { isDataDictionaryGlossary } from '../../../constants/Glossary.contant';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  getSummary,
  renderVersionButton,
} from '../../../utils/EntityVersionUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import CloseIcon from '../../Modals/CloseIcon.component';
import './entity-version-timeline.less';
import {
  EntityVersionButtonProps,
  EntityVersionTimelineProps,
} from './EntityVersionTimeline.interface';

export const VersionButton = forwardRef<
  HTMLDivElement,
  EntityVersionButtonProps
>(({ version, onVersionSelect, selected, isMajorVersion, className }, ref) => {
  const { t } = useTranslation();

  const {
    updatedBy,
    version: versionNumber,
    changeDescription,
    updatedAt,
    glossary,
  } = version;
  const [, , user] = useUserProfile({
    permission: true,
    name: updatedBy,
  });

  const isCDE = Boolean(
    isDataDictionaryGlossary(
      version?.fullyQualifiedName,
      typeof glossary === 'string' ? glossary : glossary?.name,
      typeof glossary === 'string' ? undefined : glossary?.displayName
    ) || version?.extension?.cdeVersion != null
  );

  const cdeVersionNumber = useMemo(() => {
    if (!isCDE) {
      return null;
    }
    const raw = String(
      version?.extension?.cdeVersion ??
      version?.extension?.phien_ban ??
      '1.0'
    ).trim();

    return raw.replace(/^(version:?\s*|v)/i, '') || '1.0';
  }, [isCDE, version?.extension]);

  const versionText = cdeVersionNumber
    ? `v${cdeVersionNumber}`
    : `v${parseFloat(versionNumber).toFixed(1)}`;

  return (
    <div
      className={classNames(
        'timeline-content p-b-md cursor-pointer',
        className
      )}
      data-testid={`version-entry-${versionText}`}
      ref={ref}
      onClick={() => onVersionSelect(cdeVersionNumber ?? toString(versionNumber))}>
      <div className="timeline-wrapper">
        <span
          className={classNames(
            'timeline-rounder',
            {
              selected,
            },
            {
              major: isMajorVersion,
            }
          )}
          data-testid={`version-selector-${versionText}`}
        />
        <span className={classNames('timeline-line')} />
      </div>
      <div>
        <Typography.Text
          className={classNames('d-flex font-medium', {
            'text-primary': selected,
          })}>
          <span>{versionText}</span>
          {isMajorVersion ? (
            <span
              className="m-l-xs text-xs font-medium text-grey-body tw-bg-tag p-x-xs p-y-xss bg-grey rounded-4"
              style={{ backgroundColor: '#EEEAF8' }}>
              {t('label.major')}
            </span>
          ) : null}
        </Typography.Text>
        <div
          className={classNames('text-xs font-normal break-all', {
            'diff-description': selected,
          })}
          data-testid="version-change-description">
          {getSummary({
            changeDescription: changeDescription,
            isGlossaryTerm: !isEmpty(glossary),
          })}
        </div>
        <div className="text-xs d-flex gap-1 items-center flex-wrap">
          <UserPopOverCard
            className="font-italic"
            profileWidth={16}
            userName={updatedBy}>
            <Link className="thread-author m-r-xss" to={getUserPath(updatedBy)}>
              {getEntityName(user)}
            </Link>
          </UserPopOverCard>
          <span className="font-medium font-italic version-timestamp">
            {formatDateTime(updatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
});

const EntityVersionTimeLine: React.FC<EntityVersionTimelineProps> = ({
  versionList = {} as EntityHistory,
  currentVersion,
  versionHandler,
  onBack,
  entityType,
  isCDE: isCDEProp,
  currentCdeVersion: currentCdeVersionProp,
}) => {
  const { t } = useTranslation();

  const { resourceLimit, getResourceLimit } = useLimitStore();

  useEffect(() => {
    entityType && getResourceLimit(entityType);
  }, [entityType]);

  const { configuredLimit: { maxVersions } = { maxVersions: -1 } } =
    resourceLimit[entityType ?? ''] ?? {};

  const { isCDE, filteredVersions, activeCdeVersion } = useMemo(() => {
    const rawList = versionList.versions ?? [];
    if (!rawList.length) {
      return { isCDE: false, filteredVersions: [], activeCdeVersion: null };
    }

    const firstParsed =
      typeof rawList[0] === 'string' ? JSON.parse(rawList[0]) : rawList[0];

    const detectedCDE =
      isCDEProp ??
      Boolean(
        isDataDictionaryGlossary(
          firstParsed?.fullyQualifiedName,
          typeof firstParsed?.glossary === 'string'
            ? firstParsed.glossary
            : firstParsed?.glossary?.name,
          typeof firstParsed?.glossary === 'string'
            ? undefined
            : firstParsed?.glossary?.displayName
        ) || firstParsed?.extension?.cdeVersion != null
      );

    if (!detectedCDE) {
      return {
        isCDE: false,
        filteredVersions: rawList,
        activeCdeVersion: null,
      };
    }

    // Helper to check if a snapshot has been approved
    const isApprovedSnapshot = (p: any): boolean => {
      const status = p?.entityStatus ?? p?.status ?? EntityStatus.Approved;

      return String(status).toLowerCase() === 'approved';
    };

    // Filter to unique CDE versions (retaining the latest snapshot for each unique CDE version that was approved)
    const seenCdeVersions = new Set<string>();
    const uniqueList: any[] = [];

    for (const v of rawList) {
      const p = typeof v === 'string' ? JSON.parse(v) : v;
      if (!isApprovedSnapshot(p)) {
        continue;
      }
      const raw = String(
        p?.extension?.cdeVersion ?? p?.extension?.phien_ban ?? '1.0'
      ).trim();
      const clean = raw.replace(/^(version:?\s*|v)/i, '') || '1.0';

      if (!seenCdeVersions.has(clean)) {
        seenCdeVersions.add(clean);
        uniqueList.push(v);
      }
    }

    let activeCde: string | null = currentCdeVersionProp ?? null;
    if (!activeCde) {
      const currentParsed = uniqueList.find((v) => {
        const p = typeof v === 'string' ? JSON.parse(v) : v;

        return toString(p.version) === currentVersion;
      });

      if (currentParsed) {
        const p =
          typeof currentParsed === 'string'
            ? JSON.parse(currentParsed)
            : currentParsed;
        const raw = String(
          p?.extension?.cdeVersion ?? p?.extension?.phien_ban ?? '1.0'
        ).trim();
        activeCde = raw.replace(/^(version:?\s*|v)/i, '') || '1.0';
      } else if (uniqueList.length > 0) {
        const firstApproved =
          typeof uniqueList[0] === 'string'
            ? JSON.parse(uniqueList[0])
            : uniqueList[0];
        const raw = String(
          firstApproved?.extension?.cdeVersion ??
            firstApproved?.extension?.phien_ban ??
            '1.0'
        ).trim();
        activeCde = raw.replace(/^(version:?\s*|v)/i, '') || '1.0';
      }
    }

    return {
      isCDE: true,
      filteredVersions: uniqueList,
      activeCdeVersion: activeCde,
    };
  }, [
    versionList.versions,
    currentVersion,
    isCDEProp,
    currentCdeVersionProp,
  ]);

  const versions = useMemo(() => {
    const maxAllowed = maxVersions ?? -1;
    let versionsList = filteredVersions;

    let hiddenVersions: any[] = [];

    if (maxAllowed > 0) {
      versionsList = filteredVersions.slice(0, maxAllowed);
      hiddenVersions = filteredVersions.slice(maxAllowed);
    }

    const renderButton = (v: any) => {
      const parsed = typeof v === 'string' ? JSON.parse(v) : v;
      let isSelected = toString(parsed.version) === currentVersion;
      if (isCDE && activeCdeVersion) {
        const raw = String(
          parsed?.extension?.cdeVersion ??
          parsed?.extension?.phien_ban ??
          '1.0'
        ).trim();
        const clean = raw.replace(/^(version:?\s*|v)/i, '') || '1.0';
        isSelected = clean === activeCdeVersion;
      }

      return renderVersionButton(
        v,
        currentVersion,
        versionHandler,
        undefined,
        isSelected
      );
    };

    return (
      <div className="relative h-full">
        {versionsList.length ? (
          <div className="timeline-content cursor-pointer">
            <div className="timeline-wrapper">
              <span className="timeline-line-se" />
            </div>
          </div>
        ) : (
          <div
            className="p-md text-center text-grey-muted"
            data-testid="no-approved-versions">
            {t('message.no-approved-versions-available', {
              defaultValue: 'Chưa có phiên bản nào được phê duyệt',
            })}
          </div>
        )}

        {versionsList?.map(renderButton)}
        {hiddenVersions?.length > 0 ? (
          <>
            <Tooltip title={`+${hiddenVersions.length} more versions`}>
              <div className="version-hidden">
                {hiddenVersions.map(renderButton)}
              </div>
            </Tooltip>
            <div className="version-pricing-reached">
              <Typography.Title className="font-medium" level={4}>
                Unlock all of your version history
              </Typography.Title>
              <Typography.Text className="text-grey-muted font-normal">
                Upgrade to paid plan for access to all of your version history.
              </Typography.Text>

              <Button
                block
                className="m-t-lg"
                href="/settings/billing/plans"
                type="primary">
                See Upgrade Options
              </Button>
            </div>
          </>
        ) : null}
      </div>
    );
  }, [
    filteredVersions,
    currentVersion,
    versionHandler,
    maxVersions,
    isCDE,
    activeCdeVersion,
  ]);

  return (
    <Drawer
      destroyOnClose
      open
      className="versions-list-container"
      closable={false}
      getContainer={false}
      mask={false}
      maskClosable={false}
      title={
        <>
          <Row className="p-b-xss" justify="space-between">
            <Col>
              <Typography.Text className="font-medium">
                {t('label.version-plural-history')}
              </Typography.Text>
            </Col>
            <Col>
              <CloseIcon handleCancel={onBack} />
            </Col>
          </Row>
          <Divider className="m-0" />
        </>
      }
      width={330}>
      {versions}
    </Drawer>
  );
};

export default EntityVersionTimeLine;
