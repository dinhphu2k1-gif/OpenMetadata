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
import { Alert, Col, Row, Tabs } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { FEED_COUNT_INITIAL_DATA } from '../../../constants/entity.constants';
import { EntityField } from '../../../constants/Feeds.constants';
import {
  isDataDictionaryGlossary,
  isDataQualityGlossary,
} from '../../../constants/Glossary.contant';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import {
  ChangeDescription,
  Glossary,
} from '../../../generated/entity/data/glossary';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { Operation } from '../../../generated/entity/policies/policy';
import { PageType } from '../../../generated/system/ui/page';
import { useCustomPages } from '../../../hooks/useCustomPages';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useFqn } from '../../../hooks/useFqn';
import { FeedCounts } from '../../../interface/feed.interface';
import { MOCK_GLOSSARY_NO_PERMISSIONS } from '../../../mocks/Glossary.mock';
import { searchQuery } from '../../../rest/searchAPI';
import { getFeedCounts } from '../../../utils/CommonUtils';
import { getGlossaryTermsVersionsList } from '../../../rest/glossaryAPI';
import {
  compareBusinessVersions,
  getBusinessVersion,
} from '../../../utils/BusinessVersionUtils';
import {
  checkIfExpandViewSupported,
  getDetailsTabWithNewLabel,
  getTabLabelMapFromTabs,
} from '../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import { getEntityVersionByField } from '../../../utils/EntityVersionUtils';
import glossaryTermClassBase from '../../../utils/Glossary/GlossaryTermClassBase';
import { getQueryFilterToExcludeTerm } from '../../../utils/GlossaryUtils';
import { getPrioritizedViewPermission } from '../../../utils/PermissionsUtils';
import {
  getGlossaryTermDetailsPath,
  getGlossaryTermsVersionsPath,
} from '../../../utils/RouterUtils';
import { getTermQuery } from '../../../utils/SearchUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import {
  getCdeDetailPath,
  parseCdeRoute,
} from '../../../utils/routing/cdeRoutingHelper';
import { AlignRightIconButton } from '../../common/IconButtons/EditIconButton';
import Loader from '../../common/Loader/Loader';
import {
  GenericProvider,
  useGenericContext,
} from '../../Customization/GenericProvider/GenericProvider';
import { AssetSelectionModal } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import GlossaryHeader from '../GlossaryHeader/GlossaryHeader.component';
import { useGlossaryStore } from '../useGlossary.store';
import CDEGlossaryTermOverview from './CDEGlossaryTermOverview';
import DQGlossaryTermOverview from './DQGlossaryTermOverview';
import { GlossaryTermsV1Props } from './GlossaryTermsV1.interface';
import { AssetsTabRef } from './tabs/AssetsTabs.component';
import { AssetsOfEntity } from './tabs/AssetsTabs.interface';

export const CDE_RESTRICTED_TABS = new Set([
  EntityTabs.GLOSSARY_TERMS,
  EntityTabs.ACTIVITY_FEED,
  EntityTabs.CUSTOM_PROPERTIES,
  EntityTabs.DATA_OBSERVABILITY,
]);

const GlossaryTermsV1 = ({
  glossaryTerm: currentGlossaryTerm,
  handleGlossaryTermUpdate,
  handleGlossaryTermDelete,
  onAssetClick,
  isSummaryPanelOpen,
  updateVote,
  refreshActiveGlossaryTerm,
  isVersionView,
  isTabExpanded,
  toggleTabExpanded,
}: GlossaryTermsV1Props) => {
  const { tab: activeTab, version } = useRequiredParams<{
    tab: EntityTabs;
    version: string;
  }>();
  const { fqn: glossaryFqn } = useFqn();
  const navigate = useNavigate();
  const location = useLocation();
  const cdeRoute = useMemo(
    () =>
      parseCdeRoute({
        fqn: glossaryFqn,
        pathname: location.pathname,
        search: location.search,
      }),
    [glossaryFqn, location.pathname, location.search],
  );
  const { businessVersion, parentBusinessVersion } = cdeRoute;
  const { currentUser } = useApplicationStore();
  const isAdmin = Boolean(currentUser?.isAdmin);
  const assetTabRef = useRef<AssetsTabRef>(null);
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [feedCount, setFeedCount] = useState<FeedCounts>(
    FEED_COUNT_INITIAL_DATA,
  );
  const [assetCount, setAssetCount] = useState<number>(0);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();
  const { onAddGlossaryTerm } = useGlossaryStore();
  const { permissions } = useGenericContext<GlossaryTerm>();
  const { customizedPage, isLoading } = useCustomPages(PageType.GlossaryTerm);
  const customizedTabs = useMemo(() => {
    const tabs = customizedPage?.tabs?.filter(
      (tab) => tab.id !== EntityTabs.RELATIONS_GRAPH,
    );

    return tabs?.length ? tabs : undefined;
  }, [customizedPage?.tabs]);
  const [viewedVersion, setViewedVersion] = useState<GlossaryTerm | null>(null);
  const [transitionedWorking, setTransitionedWorking] =
    useState<GlossaryTerm | null>(null);
  const glossaryTerm = useMemo(
    () =>
      viewedVersion
        ? { ...viewedVersion, changeDescription: undefined }
        : (transitionedWorking ?? currentGlossaryTerm),
    [viewedVersion, transitionedWorking, currentGlossaryTerm],
  );
  useEffect(() => {
    if (
      transitionedWorking &&
      (transitionedWorking.id !== currentGlossaryTerm.id ||
        Number(currentGlossaryTerm.workingRevision) >=
          Number(transitionedWorking.workingRevision))
    ) {
      setTransitionedWorking(null);
    }
  }, [currentGlossaryTerm, transitionedWorking]);
  const isViewingVersion = Boolean(viewedVersion) || Boolean(isVersionView);

  const handleVersionSelect = useCallback(
    (snapshot: GlossaryTerm) => {
      const snapshotBusinessVersion = getBusinessVersion(
        snapshot.businessVersion,
      );
      const currentBusinessVersion = getBusinessVersion(
        currentGlossaryTerm.businessVersion,
      );
      const isLatestVersion =
        snapshot.id === currentGlossaryTerm.id &&
        snapshot.version === currentGlossaryTerm.version &&
        compareBusinessVersions(
          snapshotBusinessVersion,
          currentBusinessVersion,
        ) === 0;
      if (isLatestVersion) {
        setViewedVersion(null);
      } else {
        setViewedVersion(snapshot);
      }

      if (parentBusinessVersion) {
        navigate(
          getCdeDetailPath({
            fqn:
              snapshot.fullyQualifiedName ??
              currentGlossaryTerm.fullyQualifiedName ??
              glossaryFqn,
            businessVersion: snapshotBusinessVersion,
            parentBusinessVersion,
            isWorkingDraft:
              snapshot.entityStatus !== EntityStatus.Approved,
          }),
        );
      } else {
        const searchParams = new URLSearchParams(location.search);
        searchParams.set('businessVersion', snapshotBusinessVersion);
        navigate({
          pathname: location.pathname,
          search: searchParams.toString(),
        });
      }
    },
    [
      currentGlossaryTerm,
      glossaryFqn,
      location.pathname,
      location.search,
      navigate,
      parentBusinessVersion,
    ],
  );

  useEffect(() => {
    let cancelled = false;
    setViewedVersion(null);
    if (businessVersion) {
      const currentVer = getBusinessVersion(
        currentGlossaryTerm.businessVersion,
      );

      if (compareBusinessVersions(currentVer, businessVersion) === 0) {
        return;
      }

      getGlossaryTermsVersionsList(
        currentGlossaryTerm.id,
        parentBusinessVersion ?? currentGlossaryTerm.parentBusinessVersion
      )
        .then((history) => {
          if (cancelled) {
            return;
          }

          const getSnapshotVer = (term?: GlossaryTerm | null): string => {
            const raw = term
              ? getBusinessVersion(term.businessVersion, '')
              : '';

            return raw ? raw.replace(/^(version:?\s*|v)/i, '') : '1.0';
          };

          let candidate1_0: GlossaryTerm | null = null;
          let historyMatch: GlossaryTerm | undefined;
          const versions = (history.versions ?? [])
            .map((v) => {
              try {
                return (
                  typeof v === 'string' ? JSON.parse(v) : v
                ) as GlossaryTerm;
              } catch {
                return undefined;
              }
            })
            .filter((v): v is GlossaryTerm => Boolean(v))
            .sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0));

          for (const p of versions) {
            if (
              String(p.entityStatus ?? 'Approved').toLowerCase() !== 'approved'
            ) {
              continue;
            }
            const ver = getSnapshotVer(p);
            if (ver === businessVersion) {
              historyMatch = p;
            }
          }

          const approvedVersions = versions.filter(
            (item) =>
              String(item.entityStatus ?? 'Approved').toLowerCase() ===
              'approved',
          );
          if (approvedVersions.length > 0) {
            candidate1_0 = approvedVersions[approvedVersions.length - 1];
          }

          if (historyMatch) {
            setViewedVersion(historyMatch);

            return;
          }

          if (businessVersion === '1.0' && candidate1_0) {
            setViewedVersion(candidate1_0);

            return;
          }

          setViewedVersion(null);
        })
        .catch(() => {
          if (!cancelled) {
            setViewedVersion(null);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [currentGlossaryTerm.id, businessVersion]);

  const { t } = useTranslation();

  const assetPermissions = useMemo(() => {
    const glossaryTermStatus =
      glossaryTerm.entityStatus ?? EntityStatus.Approved;

    return glossaryTermStatus === EntityStatus.Approved
      ? permissions
      : MOCK_GLOSSARY_NO_PERMISSIONS;
  }, [glossaryTerm, permissions]);

  const activeTabHandler = useCallback(
    (tab: string) => {
      navigate(
        {
          pathname: version
            ? getGlossaryTermsVersionsPath(glossaryFqn, version, tab)
            : getGlossaryTermDetailsPath(glossaryFqn, tab),
          ...(location.search ? { search: location.search } : {}),
        },
        { replace: true },
      );
    },
    [glossaryFqn, location.search, navigate, version],
  );

  const isCDEGlossaryTerm = useMemo(
    () =>
      isDataDictionaryGlossary(
        glossaryTerm.fullyQualifiedName,
        glossaryTerm.glossary?.name,
        glossaryTerm.glossary?.displayName,
      ),
    [glossaryTerm],
  );

  const isDQGlossaryTerm = useMemo(
    () =>
      isDataQualityGlossary(
        glossaryTerm.fullyQualifiedName,
        glossaryTerm.glossary?.name,
        glossaryTerm.glossary?.displayName,
      ),
    [glossaryTerm],
  );

  useEffect(() => {
    if (activeTab === EntityTabs.RELATIONS_GRAPH) {
      activeTabHandler(EntityTabs.OVERVIEW);
    }
  }, [activeTab, activeTabHandler]);

  useEffect(() => {
    if (
      (isCDEGlossaryTerm || isDQGlossaryTerm) &&
      !isAdmin &&
      activeTab &&
      CDE_RESTRICTED_TABS.has(activeTab)
    ) {
      activeTabHandler(EntityTabs.OVERVIEW);
    }
  }, [
    isCDEGlossaryTerm,
    isDQGlossaryTerm,
    isAdmin,
    activeTab,
    activeTabHandler,
  ]);

  const handleFeedCount = useCallback((data: FeedCounts) => {
    setFeedCount(data);
  }, []);

  const getEntityFeedCount = () => {
    getFeedCounts(
      EntityType.GLOSSARY_TERM,
      glossaryTerm.fullyQualifiedName ?? '',
      handleFeedCount,
    );
  };

  const fetchGlossaryTermAssets = async () => {
    if (glossaryTerm) {
      try {
        const res = await searchQuery({
          query: '',
          pageNumber: 1,
          pageSize: 0,
          queryFilter: getTermQuery({
            'tags.tagFQN': glossaryTerm.fullyQualifiedName ?? '',
          }),
          searchIndex: SearchIndex.ALL,
        });

        setAssetCount(res.hits.total.value ?? 0);
      } catch {
        setAssetCount(0);
      }
    }
  };

  const handleAssetSave = useCallback(() => {
    fetchGlossaryTermAssets();
    assetTabRef.current?.refreshAssets();
    activeTab !== EntityTabs.ASSETS && activeTabHandler(EntityTabs.ASSETS);
  }, [assetTabRef, activeTab, activeTabHandler]);

  const onTermUpdate = async (data: GlossaryTerm | Glossary) => {
    await handleGlossaryTermUpdate(data as GlossaryTerm);
    setViewedVersion(null);
  };

  const handleAssetClick = useCallback(
    (asset?: EntityDetailsObjectInterface) => {
      setPreviewAsset(asset);
      onAssetClick?.(asset);
    },
    [onAssetClick],
  );

  const viewCustomPropertiesPermission = useMemo(
    () => getPrioritizedViewPermission(permissions, Operation.ViewCustomFields),
    [permissions],
  );

  const tabItems = useMemo(() => {
    const tabLabelMap = getTabLabelMapFromTabs(customizedTabs);

    const items = glossaryTermClassBase.getGlossaryTermDetailPageTabs({
      glossaryTerm,
      activeTab,
      isVersionView: isViewingVersion,
      assetCount,
      feedCount,
      permissions,
      assetPermissions,
      viewCustomPropertiesPermission,
      previewAsset,
      assetTabRef,
      tabLabelMap,
      handleAssetClick,
      handleAssetSave,
      getEntityFeedCount,
      refreshActiveGlossaryTerm,
      setAssetModalVisible,
      setPreviewAsset,
    });

    const detailTabs = getDetailsTabWithNewLabel(
      items,
      customizedTabs,
      EntityTabs.OVERVIEW,
      isViewingVersion,
    );

    if (isDQGlossaryTerm) {
      const dqTabs = detailTabs.map((tab) =>
        tab.key === EntityTabs.OVERVIEW
          ? {
              ...tab,
              children: <DQGlossaryTermOverview glossaryTerm={glossaryTerm} />,
            }
          : tab,
      );

      if (!isAdmin) {
        return dqTabs.filter(
          (tab) => !CDE_RESTRICTED_TABS.has(tab.key as EntityTabs),
        );
      }

      return dqTabs;
    }

    if (isCDEGlossaryTerm) {
      const cdeTabs = detailTabs.map((tab) =>
        tab.key === EntityTabs.OVERVIEW
          ? {
              ...tab,
              children: <CDEGlossaryTermOverview glossaryTerm={glossaryTerm} />,
            }
          : tab,
      );

      return cdeTabs.filter(
        (tab) => !CDE_RESTRICTED_TABS.has(tab.key as EntityTabs),
      );
    }

    return detailTabs;
  }, [
    customizedTabs,
    glossaryTerm,
    viewCustomPropertiesPermission,
    activeTab,
    assetCount,
    feedCount.conversationCount,
    feedCount.totalTasksCount,
    isSummaryPanelOpen,
    isViewingVersion,
    assetPermissions,
    handleAssetSave,
    previewAsset,
    handleAssetClick,
    isCDEGlossaryTerm,
    isDQGlossaryTerm,
    isAdmin,
  ]);

  useEffect(() => {
    // Adding manual wait for ES to update assets when glossary term is renamed
    setTimeout(() => {
      fetchGlossaryTermAssets();
    }, 500);
    if (!isVersionView) {
      getEntityFeedCount();
    }
  }, [glossaryFqn, isVersionView]);

  const updatedGlossaryTerm = useMemo(() => {
    const name = isViewingVersion
      ? getEntityVersionByField(
          glossaryTerm.changeDescription as ChangeDescription,
          EntityField.NAME,
          glossaryTerm.name,
        )
      : glossaryTerm.name;

    const displayName = isViewingVersion
      ? getEntityVersionByField(
          glossaryTerm.changeDescription as ChangeDescription,
          EntityField.DISPLAYNAME,
          glossaryTerm.displayName,
        )
      : glossaryTerm.displayName;

    return {
      ...glossaryTerm,
      name,
      displayName,
    };
  }, [glossaryTerm, isViewingVersion]);

  const effectivePermissions = useMemo(() => {
    if (
      glossaryTerm.entityStatus !== EntityStatus.InReview &&
      glossaryTerm.entityStatus !== EntityStatus.Rejected
    ) {
      return permissions;
    }

    return {
      ...permissions,
      EditAll: false,
      EditCustomFields: false,
      EditOwners: false,
      EditTags: false,
    };
  }, [glossaryTerm.entityStatus, permissions]);

  const isExpandViewSupported = useMemo(
    () =>
      checkIfExpandViewSupported(tabItems[0], activeTab, PageType.GlossaryTerm),
    [tabItems[0], activeTab],
  );

  if (isLoading) {
    return <Loader />;
  }

  return (
    <GenericProvider
      customizedPage={customizedPage}
      data={updatedGlossaryTerm}
      isTabExpanded={isTabExpanded}
      isVersionView={isViewingVersion}
      permissions={effectivePermissions}
      type={EntityType.GLOSSARY_TERM}
      onUpdate={onTermUpdate}>
      <Row data-testid="glossary-term" gutter={[0, 12]}>
        {isCDEGlossaryTerm &&
          glossaryTerm.entityStatus === EntityStatus.Draft &&
          !parentBusinessVersion && (
            <Col span={24}>
              <Alert
                message="Draft — Chưa được thêm vào gói phát hành Data Dictionary"
                type="info"
              />
            </Col>
          )}
        {isCDEGlossaryTerm &&
          glossaryTerm.entityStatus === EntityStatus.Approved &&
          !parentBusinessVersion && (
            <Col span={24}>
              <Alert
                message="Approved — Chưa được thêm vào gói phát hành Data Dictionary"
                type="info"
              />
            </Col>
          )}
        <Col span={24}>
          <GlossaryHeader
            latestData={currentGlossaryTerm}
            updateVote={updateVote}
            onAddGlossaryTerm={onAddGlossaryTerm}
            onAssetAdd={() => setAssetModalVisible(true)}
            onDelete={handleGlossaryTermDelete}
            onVersionSelect={(snapshot) =>
              handleVersionSelect(snapshot as GlossaryTerm)
            }
            onWorkflowTransition={async (updated, action) => {
              const updatedTerm = updated as GlossaryTerm;
              setViewedVersion(null);
              setTransitionedWorking(updatedTerm);
              if (parentBusinessVersion && action !== 'createDraft') {
                navigate(
                  getCdeDetailPath({
                    fqn:
                      updatedTerm.fullyQualifiedName ??
                      glossaryTerm.fullyQualifiedName ??
                      glossaryFqn,
                    businessVersion: getBusinessVersion(
                      updatedTerm.businessVersion,
                    ),
                    parentBusinessVersion,
                    isWorkingDraft: ![
                      EntityStatus.Approved,
                      EntityStatus.Archived,
                    ].includes(updatedTerm.entityStatus as EntityStatus),
                  }),
                  { replace: true },
                );
              }
              if (action !== 'createDraft') {
                await refreshActiveGlossaryTerm?.();
              }
            }}
          />
        </Col>

        <Col className="glossary-term-page-tabs" span={24}>
          <Tabs
            destroyInactiveTabPane
            activeKey={activeTab}
            className="tabs-new"
            items={tabItems}
            tabBarExtraContent={
              isExpandViewSupported && (
                <AlignRightIconButton
                  aria-label={
                    isTabExpanded ? t('label.expand') : t('label.collapse')
                  }
                  className={isTabExpanded ? '' : 'rotate-180'}
                  title={
                    isTabExpanded ? t('label.expand') : t('label.collapse')
                  }
                  onClick={toggleTabExpanded}
                />
              )
            }
            onChange={activeTabHandler}
          />
        </Col>
      </Row>
      {glossaryTerm.fullyQualifiedName && assetModalVisible && (
        <AssetSelectionModal
          entityFqn={glossaryTerm.fullyQualifiedName}
          open={assetModalVisible}
          queryFilter={getQueryFilterToExcludeTerm(
            glossaryTerm.fullyQualifiedName,
          )}
          type={AssetsOfEntity.GLOSSARY}
          onCancel={() => setAssetModalVisible(false)}
          onSave={handleAssetSave}
        />
      )}
    </GenericProvider>
  );
};

export default GlossaryTermsV1;
