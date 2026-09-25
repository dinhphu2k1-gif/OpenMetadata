/*
 *  Copyright 2023 Collate.
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

import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty, omit } from 'lodash';
import { RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { DeleteType } from '../../../components/common/DeleteWidget/DeleteWidget.interface';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../../components/common/Loader/Loader';
import ResizableLeftPanels from '../../../components/common/ResizablePanels/ResizableLeftPanels';
import { VotingDataProps } from '../../../components/Entity/Voting/voting.interface';
import { EntityDetailsObjectInterface } from '../../../components/Explore/ExplorePage.interface';
import GlossaryV1 from '../../../components/Glossary/GlossaryV1.component';
import {
  ModifiedGlossary,
  useGlossaryStore,
} from '../../../components/Glossary/useGlossary.store';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import {
  PAGE_SIZE_LARGE,
  pagingObject,
  ROUTES,
} from '../../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { observerOptions } from '../../../constants/Mydata.constants';
import { useAsyncDeleteProvider } from '../../../context/AsyncDeleteProvider/AsyncDeleteProvider';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import {
  EntityAction,
  EntityType,
  TabSpecificField,
} from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { Operation } from '../../../generated/entity/policies/policy';
import { Paging } from '../../../generated/type/paging';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { useElementInView } from '../../../hooks/useElementInView';
import { useFqn } from '../../../hooks/useFqn';
import {
  getGlossariesList,
  getLatestPublishedGlossary,
  getGlossaryVersion,
  getGlossaryVersionPermissions,
  getGlossaryWorkingVersion,
  getPublishedGlossaryTerm,
  getGlossaryTermByFQN,
  getGlossaryTermsById,
  getGlossaryTermWorkingVersion,
  updateGlossaryTermWorkingVersion,
  updateGlossaryWorkingVersion,
  updateGlossaryTermVotes,
  updateGlossaryVotes,
} from '../../../rest/glossaryAPI';
import {
  compareBusinessVersions,
  getBusinessVersion,
} from '../../../utils/BusinessVersionUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import Fqn from '../../../utils/Fqn';
import { checkPermission } from '../../../utils/PermissionsUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import {
  getCdeDetailPath,
  parseCdeRoute,
} from '../../../utils/routing/cdeRoutingHelper';
import GlossaryLeftPanel from '../GlossaryLeftPanel/GlossaryLeftPanel.component';

const GlossaryPage = () => {
  const { permissions } = usePermissionProvider();
  const { fqn: glossaryFqn } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { handleOnAsyncEntityDeleteConfirm } = useAsyncDeleteProvider();
  const { action } = useRequiredParams<{ action: EntityAction }>();
  const [initialised, setInitialised] = useState(false);
  const cdeRoute = useMemo(
    () =>
      parseCdeRoute({
        fqn: glossaryFqn,
        pathname: location.pathname,
        search: location.search,
      }),
    [glossaryFqn, location.pathname, location.search]
  );
  const { businessVersion, parentBusinessVersion, termId } = cdeRoute;
  const [isGlossaryHistorical, setIsGlossaryHistorical] = useState(false);
  const [isTermHistorical, setIsTermHistorical] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isMoreGlossaryLoading, setIsMoreGlossaryLoading] =
    useState<boolean>(false);
  const [elementRef, isInView] = useElementInView({
    ...observerOptions,
    root: document.querySelector('#panel-container'),
    rootMargin: '0px 0px 2px 0px',
  });
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const handlePagingChange = setPaging;

  const [isRightPanelLoading, setIsRightPanelLoading] = useState(true);
  const [previewAsset, setPreviewAsset] =
    useState<EntityDetailsObjectInterface>();

  const {
    glossaries,
    setGlossaries,
    activeGlossary,
    setActiveGlossary,
    updateActiveGlossary,
  } = useGlossaryStore();

  // Entity updates replace the glossary object in the list. Keep route/data
  // resolution tied to list membership and identity only, so inline metadata
  // edits do not refetch the working version and flash the full-page loader.
  const glossaryNavigationKey = useMemo(
    () =>
      glossaries
        .map(({ id, fullyQualifiedName }) => `${id}:${fullyQualifiedName ?? ''}`)
        .join('|'),
    [glossaries]
  );

  const isImportAction = useMemo(
    () => action === EntityAction.IMPORT,
    [action]
  );

  const isGlossaryActive = useMemo(() => {
    if (glossaryFqn) {
      return Fqn.split(glossaryFqn).length === 1;
    }

    return true;
  }, [glossaryFqn]);

  const isHistoricalView = isGlossaryActive
    ? isGlossaryHistorical
    : isTermHistorical;

  const { viewBasicGlossaryPermission, viewAllGlossaryPermission } =
    useMemo(() => {
      const resourceType = isGlossaryActive
        ? ResourceEntity.GLOSSARY
        : ResourceEntity.GLOSSARY_TERM;

      return {
        viewBasicGlossaryPermission: checkPermission(
          Operation.ViewBasic,
          resourceType,
          permissions
        ),
        viewAllGlossaryPermission: checkPermission(
          Operation.ViewAll,
          resourceType,
          permissions
        ),
      };
    }, [permissions, isGlossaryActive]);

  const fetchGlossaryList = useCallback(async () => {
    try {
      let allGlossaries: Glossary[] = [];
      let nextPage = paging.after;
      let isGlossaryFound = false;
      setInitialised(false);
      setIsLoading(true);

      do {
        const { data, paging: glossaryPaging } = await getGlossariesList({
          fields: [
            TabSpecificField.OWNERS,
            TabSpecificField.TAGS,
            TabSpecificField.REVIEWERS,
            TabSpecificField.VOTES,
            TabSpecificField.DOMAINS,
            TabSpecificField.TERM_COUNT,
            TabSpecificField.EXTENSION,
          ],
          limit: PAGE_SIZE_LARGE,
          ...(nextPage && { after: nextPage }),
        });

        allGlossaries = [...allGlossaries, ...data];

        if (glossaryFqn) {
          isGlossaryFound = allGlossaries.some(
            (item) => item.fullyQualifiedName === glossaryFqn
          );
        } else {
          isGlossaryFound = true; // limit to first 50 records only if no glossaryFqn
        }

        nextPage = glossaryPaging?.after;

        handlePagingChange(glossaryPaging);
      } while (nextPage && !isGlossaryFound);

      setGlossaries(allGlossaries);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
      setInitialised(true);
    }
  }, [paging.after, glossaryFqn]);

  const fetchNextGlossaryItems = async (after?: string) => {
    try {
      let allGlossaries: Glossary[] = glossaries;

      setIsMoreGlossaryLoading(true);

      const { data, paging: glossaryPaging } = await getGlossariesList({
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.REVIEWERS,
          TabSpecificField.VOTES,
          TabSpecificField.DOMAINS,
          TabSpecificField.TERM_COUNT,
          TabSpecificField.EXTENSION,
        ],
        limit: PAGE_SIZE_LARGE,
        after: after,
      });

      allGlossaries = [...allGlossaries, ...data];
      handlePagingChange(glossaryPaging);

      setGlossaries(allGlossaries);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsMoreGlossaryLoading(false);
    }
  };

  useEffect(() => {
    if (!initialised) {
      fetchGlossaryList();
    }
  }, [initialised]);

  useEffect(() => {
    if (paging?.after && isInView && !isMoreGlossaryLoading) {
      fetchNextGlossaryItems(paging.after);
    }
  }, [paging, isInView, isMoreGlossaryLoading]);

  const fetchGlossaryTermDetails = useCallback(async () => {
    setIsRightPanelLoading(true);
    if (!businessVersion || !parentBusinessVersion) {
      // Explore's legacy glossary index can return the scoped CDE FQN without
      // the F12 route metadata. Resolve that stable identity once and replace
      // the incomplete URL with the canonical versioned CDE URL.
      const scopedParentVersion = glossaryFqn.match(/@v([1-9]\d*)$/)?.[1];
      if (scopedParentVersion) {
        try {
          const current = await getGlossaryTermByFQN(glossaryFqn);
          if (current.businessVersion && current.parentBusinessVersion) {
            navigate(
              getCdeDetailPath({
                fqn: current.fullyQualifiedName ?? glossaryFqn,
                businessVersion: current.businessVersion,
                parentBusinessVersion: current.parentBusinessVersion,
                termId: current.id,
                isWorkingDraft: current.entityStatus !== EntityStatus.Approved,
              }),
              { replace: true }
            );

            return;
          }
        } catch (error) {
          const status = (error as AxiosError)?.response?.status;
          navigate(
            status === ClientErrors.FORBIDDEN
              ? ROUTES.FORBIDDEN
              : ROUTES.NOT_FOUND,
            { replace: true }
          );

          return;
        } finally {
          setIsRightPanelLoading(false);
        }
      }

      navigate(ROUTES.NOT_FOUND, { replace: true });
      setIsRightPanelLoading(false);

      return;
    }
    try {
      const termFields = [
        TabSpecificField.RELATED_TERMS,
        TabSpecificField.REVIEWERS,
        TabSpecificField.TAGS,
        TabSpecificField.OWNERS,
        TabSpecificField.CHILDREN,
        TabSpecificField.VOTES,
        TabSpecificField.DOMAINS,
        TabSpecificField.EXTENSION,
        TabSpecificField.CHILDREN_COUNT,
      ];
      // Search results already carry the stable term id. Prefer it because a
      // working CDE may be visible in the search index before the generic FQN
      // endpoint can resolve that working identity for the current user.
      const current = termId
        ? await getGlossaryTermsById(termId, { fields: termFields })
        : await getGlossaryTermByFQN(glossaryFqn, {
            fields: termFields,
          });

      const parentGlossaryId = current.glossary?.id;
      if (!parentGlossaryId) {
        navigate(ROUTES.NOT_FOUND, { replace: true });

        return;
      }

      let liveGlossary: Glossary | null = null;
      try {
        const capabilities = await getGlossaryVersionPermissions(parentGlossaryId);
        if (capabilities.canViewWorking) {
          try {
            liveGlossary = await getGlossaryWorkingVersion(parentGlossaryId);
          } catch (error) {
            if ((error as AxiosError)?.response?.status === ClientErrors.NOT_FOUND) {
              liveGlossary = await getLatestPublishedGlossary(parentGlossaryId);
            } else {
              throw error;
            }
          }
        } else {
          liveGlossary = await getLatestPublishedGlossary(parentGlossaryId);
        }
      } catch {
        const found = glossaries.find((g) => g.id === parentGlossaryId);
        if (found) {
          liveGlossary = found;
        }
      }

      const liveParentVer = liveGlossary?.businessVersion
        ? getBusinessVersion(liveGlossary.businessVersion, '')
        : '';
      const reqParentVer = getBusinessVersion(parentBusinessVersion, '');
      const reqCdeVer = getBusinessVersion(businessVersion, '');

      if (
        liveParentVer &&
        compareBusinessVersions(liveParentVer, reqParentVer) === 0
      ) {
        try {
          // The FQN endpoint resolves the stable term identity. It must not be
          // used as the scoped working representation because a CDE can have
          // independent working rows in different Data Dictionary versions.
          const working = await getGlossaryTermWorkingVersion(
            current.id,
            reqParentVer
          );
          const workingVersion = getBusinessVersion(
            working.businessVersion,
            ''
          );
          if (compareBusinessVersions(workingVersion, reqCdeVer) === 0) {
            setIsTermHistorical(false);
            setActiveGlossary(working as ModifiedGlossary);

            return;
          }
        } catch (error) {
          const status = (error as AxiosError)?.response?.status;
          // A Consumer cannot read a working version, and a published-only CDE
          // has no working row. Both cases should continue to snapshot lookup.
          if (
            status !== ClientErrors.FORBIDDEN &&
            status !== ClientErrors.NOT_FOUND
          ) {
            throw error;
          }
        }
      }

      try {
        const response = await getPublishedGlossaryTerm(
          current.id,
          reqCdeVer,
          reqParentVer
        );
        if (
          compareBusinessVersions(
            getBusinessVersion(response.businessVersion, ''),
            reqCdeVer
          ) !== 0
        ) {
          navigate(ROUTES.NOT_FOUND, { replace: true });

          return;
        }
        // A published response is not necessarily a historical view. The
        // current Approved head is still the live CDE page and must expose
        // actions such as "Create new version". Only an archived snapshot is
        // read-only historical content.
        setIsTermHistorical(response.entityStatus === EntityStatus.Archived);
        setActiveGlossary(response as ModifiedGlossary);
      } catch {
        navigate(ROUTES.NOT_FOUND, { replace: true });
      }
    } catch (error) {
      const status = (error as AxiosError)?.response?.status;
      if (status === ClientErrors.FORBIDDEN) {
        navigate(ROUTES.FORBIDDEN, { replace: true });
      } else {
        navigate(ROUTES.NOT_FOUND, { replace: true });
      }
    } finally {
      setIsRightPanelLoading(false);
    }
  }, [businessVersion, glossaryFqn, parentBusinessVersion, termId, glossaries]);

  useEffect(() => {
    setIsRightPanelLoading(true);
    if (glossaries.length) {
      if (!isGlossaryActive) {
        fetchGlossaryTermDetails();
      } else {
        const foundGlossary = glossaries.find(
          (glossary) => glossary.fullyQualifiedName === glossaryFqn
        );
        if (!foundGlossary && glossaryFqn) {
          setIsRightPanelLoading(false);
          navigate(ROUTES.FORBIDDEN, { replace: true });

          return;
        }

        const current = foundGlossary || glossaries[0];
        if (businessVersion && current) {
          setIsRightPanelLoading(true);
          getGlossaryVersionPermissions(current.id)
            .then(async (capabilities) => {
              if (capabilities.canViewWorking) {
                try {
                  const working = await getGlossaryWorkingVersion(current.id);
                  if (
                    compareBusinessVersions(
                      getBusinessVersion(working.businessVersion, ''),
                      getBusinessVersion(businessVersion, '')
                    ) === 0
                  ) {
                    setIsGlossaryHistorical(false);
                    setActiveGlossary(working);

                    return;
                  }
                } catch (error) {
                  if (
                    (error as AxiosError)?.response?.status !==
                    ClientErrors.NOT_FOUND
                  ) {
                    throw error;
                  }
                }
              }

              const snapshot = await getGlossaryVersion(
                current.id,
                businessVersion
              );
              // Authorization for the exact published business version is enforced by
              // GET /glossaries/{id}/published/{businessVersion}. Consumers are allowed
              // to read Archived snapshots, so mutation capabilities such as
              // canViewWorking/canArchive must not be used as a second read gate here.
              // A business-version deep link can still point at the current
              // Approved head. Only an Archived Dictionary is historical and
              // must suppress live workflow actions such as Create New Version.
              setIsGlossaryHistorical(
                snapshot.entityStatus === EntityStatus.Archived
              );
              setActiveGlossary(snapshot);
            })
            .catch(() => navigate(ROUTES.NOT_FOUND, { replace: true }))
            .finally(() => setIsRightPanelLoading(false));

          return;
        }

        setIsGlossaryHistorical(false);
        setIsRightPanelLoading(true);
        getGlossaryVersionPermissions(current.id)
          .then(async (capabilities) => {
            if (!capabilities.canViewWorking) {
              return current;
            }

            try {
              return await getGlossaryWorkingVersion(current.id);
            } catch (error) {
              // Approving a Data Dictionary consumes its working record. The
              // default route must then resolve the published head instead of
              // treating the expected working 404 as a missing dictionary.
              if (
                (error as AxiosError)?.response?.status ===
                ClientErrors.NOT_FOUND
              ) {
                return getLatestPublishedGlossary(current.id);
              }

              throw error;
            }
          })
          .then((resolved) => setActiveGlossary(resolved))
          .catch(() => navigate(ROUTES.NOT_FOUND, { replace: true }))
          .finally(() => setIsRightPanelLoading(false));

        if (isEmpty(glossaryFqn) && glossaries[0].fullyQualifiedName) {
          navigate(getGlossaryPath(glossaries[0].fullyQualifiedName), {
            replace: true,
          });
        }
      }
    } else {
      setIsRightPanelLoading(false);
    }
  }, [
    businessVersion,
    isGlossaryActive,
    glossaryFqn,
    glossaryNavigationKey,
  ]);

  const updateGlossary = useCallback(
    async (updatedData: Glossary) => {
      const jsonPatch = compare(activeGlossary as Glossary, updatedData);
      if (isEmpty(jsonPatch)) {
        return;
      }

      try {
        const working =
          activeGlossary?.workingRevision != null
            ? (activeGlossary as Glossary)
            : await getGlossaryWorkingVersion(activeGlossary?.id);
        const response = await updateGlossaryWorkingVersion(
          activeGlossary?.id,
          working.workingRevision as number,
          updatedData
        );

        updateActiveGlossary(response);
        setGlossaries(
          glossaries.map((item) =>
            item.id === response.id
              ? {
                  ...item,
                  ...response,
                  extension:
                    updatedData.extension ??
                    response.extension ??
                    item.extension,
                }
              : item
          )
        );

        // Attribute editors can send a partial entity without `name`. Detect an
        // actual rename from the authoritative response instead, otherwise a
        // normal inline update would navigate and reload the whole page.
        if (
          activeGlossary?.fullyQualifiedName &&
          response.fullyQualifiedName &&
          activeGlossary.fullyQualifiedName !== response.fullyQualifiedName
        ) {
          navigate(getGlossaryPath(response.fullyQualifiedName));
          fetchGlossaryList();
        }
      } catch (error) {
        showErrorToast(error as AxiosError);

        throw error;
      }
    },
    [
      activeGlossary,
      updateActiveGlossary,
      navigate,
      fetchGlossaryList,
      glossaries,
      setGlossaries,
    ]
  );

  const updateVote = useCallback(
    async (data: VotingDataProps) => {
      try {
        const isGlossaryEntity =
          Fqn.split(activeGlossary?.fullyQualifiedName ?? '').length <= 1;

        if (isGlossaryEntity) {
          const {
            entity: { votes },
          } = await updateGlossaryVotes(activeGlossary?.id ?? '', data);
          updateActiveGlossary({ votes });
        } else {
          const {
            entity: { votes },
          } = await updateGlossaryTermVotes(activeGlossary?.id ?? '', data);
          updateActiveGlossary({ votes });
        }
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [updateActiveGlossary, activeGlossary]
  );

  const handleGlossaryDelete = useCallback(
    async (id: string) => {
      try {
        await handleOnAsyncEntityDeleteConfirm({
          entityName: activeGlossary?.name,
          entityId: id,
          entityType: EntityType.GLOSSARY,
          deleteType: DeleteType.HARD_DELETE,
          prepareType: true,
          isRecursiveDelete: true,
          onDeleteFailure: fetchGlossaryList,
        });

        // check updated glossary list after deletion
        const updatedGlossaries = glossaries.filter((item) => item.id !== id);
        setGlossaries(updatedGlossaries);
        const glossaryPath =
          updatedGlossaries.length > 0
            ? getGlossaryPath(updatedGlossaries[0].fullyQualifiedName)
            : getGlossaryPath();

        navigate(glossaryPath);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.delete-entity-error', {
            entity: t('label.glossary'),
          })
        );
      }
    },
    [glossaries, activeGlossary, fetchGlossaryList]
  );

  const handleGlossaryTermUpdate = useCallback(
    async (updatedData: GlossaryTerm) => {
      const normalizedUpdatedData = updatedData;

      // Version/audit snapshots do not contain the same server-computed fields as the
      // canonical entity. Exclude those fields so restoring a business version never emits
      // invalid remove operations such as `/childrenCount`.
      const readOnlyFields: Array<keyof GlossaryTerm> = [
        'changeDescription',
        'children',
        'childrenCount',
        'href',
        'incrementalChangeDescription',
        'updatedAt',
        'updatedBy',
        'usageCount',
        'version',
        'votes',
      ];
      const jsonPatch = compare(
        omit(activeGlossary as GlossaryTerm, readOnlyFields),
        omit(normalizedUpdatedData, readOnlyFields)
      );
      if (isEmpty(jsonPatch)) {
        return;
      }

      try {
        const working =
          activeGlossary?.workingRevision != null
            ? (activeGlossary as GlossaryTerm)
            : await getGlossaryTermWorkingVersion(
                activeGlossary?.id,
                parentBusinessVersion
              );
        const response = await updateGlossaryTermWorkingVersion(
          activeGlossary?.id,
          working.workingRevision as number,
          normalizedUpdatedData
        );
        if (response) {
          setActiveGlossary(response as ModifiedGlossary);
        } else {
          throw t('server.entity-updating-error', {
            entity: t('label.glossary-term'),
          });
        }
      } catch (error) {
        showErrorToast(error as AxiosError);

        throw error;
      }
    },
    [activeGlossary]
  );

  const handleGlossaryTermDelete = useCallback(
    async (id: string) => {
      try {
        await handleOnAsyncEntityDeleteConfirm({
          entityName: activeGlossary?.name,
          entityId: id,
          entityType: EntityType.GLOSSARY_TERM,
          deleteType: DeleteType.HARD_DELETE,
          prepareType: true,
          isRecursiveDelete: true,
          onDeleteFailure: fetchGlossaryList,
        });

        let fqn;
        if (glossaryFqn) {
          const fqnArr = Fqn.split(glossaryFqn);
          fqnArr.pop();
          fqn = fqnArr.join(FQN_SEPARATOR_CHAR);
        }
        navigate(getGlossaryPath(fqn));
        // Refresh glossary list to update term count after deletion
        fetchGlossaryList();
      } catch (err) {
        showErrorToast(
          err as AxiosError,
          t('server.delete-entity-error', {
            entity: t('label.glossary-term'),
          })
        );
      }
    },
    [glossaryFqn, activeGlossary, fetchGlossaryList]
  );

  const handleAssetClick = useCallback(
    (asset?: EntityDetailsObjectInterface) => {
      setPreviewAsset(asset);
    },
    []
  );

  if (isLoading) {
    return <Loader />;
  }

  if (!(viewBasicGlossaryPermission || viewAllGlossaryPermission)) {
    return (
      <div className="d-flex justify-center items-center">
        <ErrorPlaceHolder
          className="mt-0-important border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.glossary'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      </div>
    );
  }

  if (glossaries.length === 0 && !isLoading) {
    return (
      <div className="full-height">
        <ErrorPlaceHolder
          className="mt-0-important border-none"
          heading={t('label.glossary')}
          permission={false}
          permissionValue=""
          size={SIZE.X_LARGE}
          type={ERROR_PLACEHOLDER_TYPE.NO_DATA}
        />
      </div>
    );
  }

  const glossaryElement = isRightPanelLoading ? (
    <Loader />
  ) : (
    <GlossaryV1
      isGlossaryActive={isGlossaryActive}
      isSummaryPanelOpen={Boolean(previewAsset)}
      isVersionsView={isHistoricalView}
      refreshActiveGlossaryTerm={fetchGlossaryTermDetails}
      refreshGlossaryList={fetchGlossaryList}
      selectedData={activeGlossary as Glossary}
      updateGlossary={updateGlossary}
      updateVote={updateVote}
      onAssetClick={handleAssetClick}
      onGlossaryDelete={handleGlossaryDelete}
      onGlossaryTermDelete={handleGlossaryTermDelete}
      onGlossaryTermUpdate={handleGlossaryTermUpdate}
    />
  );

  const resizableLayout = isGlossaryActive ? (
    <ResizableLeftPanels
      collapsibleFirstPanel
      showLearningIcon
      className="content-height-with-resizable-panel"
      firstPanel={{
        className:
          'content-resizable-panel-container' + (previewAsset ? ' m-r-lg' : ''),
        minWidth: 280,
        flex: 0.13,
        title: t('label.glossary'),
        children: (
          <>
            <GlossaryLeftPanel glossaries={glossaries} />
            <div
              className="w-full"
              data-testid="glossary-left-panel-scroller"
              id="observer-element"
              ref={elementRef as RefObject<HTMLDivElement>}
            />
            {isMoreGlossaryLoading && <Loader />}
          </>
        ),
      }}
      hideFirstPanel={isImportAction}
      learningPageId={LEARNING_PAGE_IDS.GLOSSARY}
      learningTitle={t('label.glossary')}
      pageTitle={getEntityName(activeGlossary)}
      secondPanel={{
        children: glossaryElement,
        className: 'content-resizable-panel-container',
        minWidth: 800,
        flex: 0.87,
      }}
    />
  ) : (
    glossaryElement
  );

  return <div>{resizableLayout}</div>;
};

export default withPageLayout(GlossaryPage);
