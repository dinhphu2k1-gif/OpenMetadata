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

import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { withActivityFeed } from '../../components/AppRouter/withActivityFeed';
import { PAGE_SIZE_LARGE } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../enums/common.enum';
import { EntityAction, EntityTabs, EntityType } from '../../enums/entity.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../generated/entity/data/glossaryTerm';
import { PageType } from '../../generated/system/ui/page';
import { useCustomPages } from '../../hooks/useCustomPages';
import { VERSION_VIEW_GLOSSARY_PERMISSION } from '../../mocks/Glossary.mock';
import {
  addGlossaryTerm,
  getFirstLevelGlossaryTermsPaginated,
  getGlossaryTermVersionPermissions,
  getGlossaryTermWorkingVersion,
  getGlossaryVersionPermissions,
  ListGlossaryTermsParams,
  updateGlossaryTermWorkingVersion,
} from '../../rest/glossaryAPI';
import { getEntityDeleteMessage } from '../../utils/EntityDisplayUtils';
import { getBusinessVersion } from '../../utils/BusinessVersionUtils';
import { updateGlossaryTermByFqn } from '../../utils/GlossaryUtils';
import {
  isDataDictionaryGlossary,
  isDataQualityGlossary,
} from '../../constants/Glossary.contant';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getGlossaryTermDetailsPath } from '../../utils/RouterUtils';
import { getCdeDetailPath } from '../../utils/routing/cdeRoutingHelper';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import ErrorPlaceHolder from '../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../common/Loader/Loader';
import { GenericProvider } from '../Customization/GenericProvider/GenericProvider';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';
import { GlossaryTermForm } from './AddGlossaryTermForm/AddGlossaryTermForm.interface';
import GlossaryDetails from './GlossaryDetails/GlossaryDetails.component';
import GlossaryTermModal from './GlossaryTermModal/GlossaryTermModal.component';
import GlossaryTermsV1 from './GlossaryTerms/GlossaryTermsV1.component';
import { GlossaryV1Props } from './GlossaryV1.interfaces';
import './glossaryV1.less';
import { ModifiedGlossary, useGlossaryStore } from './useGlossary.store';

const GlossaryV1 = ({
  isGlossaryActive,
  selectedData,
  onGlossaryTermUpdate,
  updateGlossary,
  updateVote,
  onGlossaryDelete,
  onGlossaryTermDelete,
  isVersionsView,
  onAssetClick,
  isSummaryPanelOpen,
  refreshActiveGlossaryTerm,
  refreshGlossaryList,
}: GlossaryV1Props) => {
  const { t } = useTranslation();
  const { action, tab } = useRequiredParams<{
    action: EntityAction;
    glossaryName: string;
    tab: string;
  }>();
  const { customizedPage } = useCustomPages(
    isGlossaryActive ? PageType.Glossary : PageType.GlossaryTerm
  );
  const navigate = useNavigate();
  const [activeGlossaryTerm, setActiveGlossaryTerm] =
    useState<GlossaryTerm | null>(null);
  const { getEntityPermission } = usePermissionProvider();
  const [isLoading, setIsLoading] = useState(true);
  const [isPermissionLoading, setIsPermissionLoading] = useState(false);
  const { setGlossaryFunctionRef } = useGlossaryStore();
  const [isTabExpanded, setIsTabExpanded] = useState(true);

  const [isDelete, setIsDelete] = useState<boolean>(false);

  const [glossaryPermission, setGlossaryPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [glossaryTermPermission, setGlossaryTermPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [editMode, setEditMode] = useState(false);

  const {
    activeGlossary,
    glossaryChildTerms,
    setGlossaryChildTerms,
    insertNewGlossaryTermToChildTerms,
    requestGlossaryTermsRefresh,
    termsLoading,
    setTermsLoading,
  } = useGlossaryStore();

  const { id, fullyQualifiedName } = activeGlossary ?? {};
  const selectedTermGlossaryId = (selectedData as GlossaryTerm).glossary?.id;
  const isSelectedEntityReady = isGlossaryActive
    ? !selectedTermGlossaryId
    : Boolean(selectedTermGlossaryId);
  const isCDEGlossaryTerm =
    !isGlossaryActive &&
    isDataDictionaryGlossary(
      selectedData.fullyQualifiedName,
      (selectedData as GlossaryTerm).glossary?.name,
      (selectedData as GlossaryTerm).glossary?.displayName
    );
  const isDQGlossaryTerm =
    !isGlossaryActive &&
    isDataQualityGlossary(
      selectedData.fullyQualifiedName,
      (selectedData as GlossaryTerm).glossary?.name,
      (selectedData as GlossaryTerm).glossary?.displayName
    );

  const [afterCursor, setAfterCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const fetchGlossaryTerm = async (
    params?: ListGlossaryTermsParams,
    refresh?: boolean,
    append?: boolean
  ) => {
    if (!append) {
      refresh ? setTermsLoading(true) : setIsLoading(true);
    }

    try {
      const { data, paging } = await getFirstLevelGlossaryTermsPaginated(
        params?.glossary ?? params?.parent ?? '',
        PAGE_SIZE_LARGE,
        append ? afterCursor : undefined,
        undefined,
        undefined,
        undefined,
        params?.glossary ? selectedData.id : undefined,
        params?.glossary
          ? getBusinessVersion(selectedData.businessVersion, '1')
          : undefined
      );

      if (append) {
        // Append to existing terms
        const currentTerms = glossaryChildTerms || [];
        const mergedTerms = [...currentTerms, ...(data as ModifiedGlossary[])];
        setGlossaryChildTerms(mergedTerms);
      } else {
        // Replace terms
        setGlossaryChildTerms(data as ModifiedGlossary[]);
      }

      // Update cursor for next page
      setAfterCursor(paging?.after);
      // Check if there are more terms to load
      setHasMore(paging?.after !== undefined);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      if (!append) {
        refresh ? setTermsLoading(false) : setIsLoading(false);
      }
    }
  };

  const fetchGlossaryPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY,
        selectedData?.id as string
      );
      setGlossaryPermission(response);

      return response;
    } catch (error) {
      showErrorToast(error as AxiosError);

      throw error;
    }
  };

  const fetchGlossaryTermPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY_TERM,
        selectedData?.id as string
      );
      setGlossaryTermPermission(response);

      return response;
    } catch (error) {
      showErrorToast(error as AxiosError);

      throw error;
    }
  };

  const handleDelete = async () => {
    const { id } = selectedData;
    if (isGlossaryActive) {
      await onGlossaryDelete(id);
    } else {
      await onGlossaryTermDelete(id);
    }
    setIsDelete(false);
  };

  const loadGlossaryTerms = useCallback(
    (refresh = false, append = false) => {
      fetchGlossaryTerm(
        isGlossaryActive
          ? { glossary: fullyQualifiedName }
          : { parent: fullyQualifiedName },
        refresh,
        append
      );
    },
    [
      fullyQualifiedName,
      isGlossaryActive,
      afterCursor,
      selectedData.id,
      selectedData.businessVersion,
    ]
  );

  const loadMoreTerms = useCallback(() => {
    if (hasMore && !termsLoading) {
      loadGlossaryTerms(false, true);
    }
  }, [hasMore, termsLoading, loadGlossaryTerms]);

  const handleGlossaryTermModalAction = useCallback(
    (editMode: boolean, glossaryTerm: GlossaryTerm | null) => {
      setEditMode(editMode);
      setActiveGlossaryTerm(glossaryTerm);
      setIsEditModalOpen(true);
    },
    []
  );

  const updateGlossaryTermInStore = (updatedTerm: GlossaryTerm) => {
    const clonedTerms = cloneDeep(glossaryChildTerms);
    const updatedGlossaryTerms = updateGlossaryTermByFqn(
      clonedTerms,
      updatedTerm.fullyQualifiedName ?? '',
      updatedTerm as ModifiedGlossary
    );

    setGlossaryChildTerms(updatedGlossaryTerms);
  };

  const updateGlossaryTerm = async (
    currentData: GlossaryTerm,
    updatedData: GlossaryTerm
  ) => {
    const working =
      currentData.workingRevision != null
        ? currentData
        : await getGlossaryTermWorkingVersion(
            currentData.id,
            currentData.parentBusinessVersion
          );
    const response = await updateGlossaryTermWorkingVersion(
      currentData.id,
      working.workingRevision as number,
      updatedData
    );
    if (!response) {
      throw new Error(
        t('server.entity-updating-error', {
          entity: t('label.glossary-term'),
        })
      );
    } else {
      updateGlossaryTermInStore({
        ...response,
        // Since patch didn't respond with childrenCount preserve it from currentData
        childrenCount: currentData.childrenCount,
      });
      setIsEditModalOpen(false);
    }
  };

  const onTermModalSuccess = useCallback(
    (term: GlossaryTerm) => {
      // Setting loading so that nested terms are rendered again on table with change
      setTermsLoading(true);
      // Update store with newly created term
      insertNewGlossaryTermToChildTerms(term);
      // GlossaryTermTab owns the version-aware CDE query. Incrementing its
      // refresh token makes it reload with the current version and filters
      // instead of relying only on the optimistic shared-store insertion.
      requestGlossaryTermsRefresh();
      // Close the controlled modal before navigating to the newly-created CDE. Glossary routes
      // reuse this component, so navigating first can preserve the open state on the next view.
      setIsEditModalOpen(false);
      setTermsLoading(false);
      if (
        isGlossaryActive &&
        isDataDictionaryGlossary(selectedData) &&
        term.fullyQualifiedName &&
        term.businessVersion &&
        term.parentBusinessVersion
      ) {
        navigate(
          getCdeDetailPath({
            fqn: term.fullyQualifiedName,
            businessVersion: term.businessVersion,
            parentBusinessVersion: term.parentBusinessVersion,
            isWorkingDraft: true,
          })
        );
      } else if (!isGlossaryActive && tab !== EntityTabs.GLOSSARY_TERMS) {
        navigate(
          getGlossaryTermDetailsPath(
            selectedData.fullyQualifiedName || '',
            EntityTabs.GLOSSARY_TERMS
          )
        );
      }
      // Refresh glossary list to update term count
      if (isGlossaryActive && refreshGlossaryList) {
        refreshGlossaryList();
      }
    },
    [
      isGlossaryActive,
      tab,
      selectedData,
      refreshGlossaryList,
      requestGlossaryTermsRefresh,
      navigate,
    ]
  );

  // The create request has no test declarations; a new Rule carries them from its first Draft.
  const saveTestSpecsOfNewRule = async (
    term: GlossaryTerm,
    formData: GlossaryTermForm
  ) => {
    if (formData.dataQualityTestSpecs?.items?.length) {
      const scope = getBusinessVersion(selectedData.businessVersion, '1');
      const working = await getGlossaryTermWorkingVersion(term.id, scope);
      await updateGlossaryTermWorkingVersion(
        term.id,
        working.workingRevision as number,
        { ...working, dataQualityTestSpecs: formData.dataQualityTestSpecs },
        scope
      );
    }
  };

  const handleGlossaryTermAdd = async (formData: GlossaryTermForm) => {
    const term = await addGlossaryTerm({
      name: formData.name,
      displayName: formData.displayName,
      description: formData.description,
      owners: formData.owners,
      tags: formData.tags,
      extension: formData.extension,
      versionedRelatedTerms: formData.versionedRelatedTerms,
      domains: formData.domains?.map(
        (domain) => domain.fullyQualifiedName ?? domain.name ?? ''
      ),
      glossary: selectedData.fullyQualifiedName ?? '',
      parentBusinessVersion: getBusinessVersion(
        selectedData.businessVersion,
        '1'
      ),
    });
    await saveTestSpecsOfNewRule(term, formData);
    onTermModalSuccess(term);
  };

  const handleGlossaryTermSave = async (formData: GlossaryTermForm) => {
    const newTermData = cloneDeep(activeGlossaryTerm);
    if (editMode) {
      if (newTermData && activeGlossaryTerm) {
        const {
          displayName,
          description,
          synonyms,
          tags,
          references,
          mutuallyExclusive,
          reviewers,
          owners,
          relatedTerms,
          domains,
          extension,
          dataQualityTestSpecs,
        } = formData || {};

        newTermData.name = activeGlossaryTerm.name;
        newTermData.displayName = displayName;
        newTermData.description = description;
        newTermData.synonyms = synonyms;
        newTermData.tags = tags;
        newTermData.mutuallyExclusive = mutuallyExclusive;
        newTermData.reviewers = reviewers;
        newTermData.owners = owners;
        newTermData.references = references;
        newTermData.relatedTerms =
          formData.versionedRelatedTerms ??
          relatedTerms?.map((term) => ({
            relationType: 'relatedTo',
            term: {
              id: term,
              type: 'glossaryTerm',
            },
          }));
        newTermData.domains = domains;
        newTermData.extension = extension;
        if (dataQualityTestSpecs !== undefined) {
          newTermData.dataQualityTestSpecs = dataQualityTestSpecs;
        }
        await updateGlossaryTerm(activeGlossaryTerm, newTermData);
      }
    } else {
      await handleGlossaryTermAdd(formData);
    }
  };

  const handleGlossaryUpdate = async (newGlossary: Glossary) => {
    const jsonPatch = compare(selectedData, newGlossary);

    const shouldRefreshTerms = jsonPatch.some((patch) =>
      patch.path.startsWith('/owners')
    );

    await updateGlossary(newGlossary);
    shouldRefreshTerms && loadGlossaryTerms(true);
  };

  const initPermissions = async () => {
    setIsPermissionLoading(true);
    const permissionFetch = isGlossaryActive
      ? fetchGlossaryPermission
      : fetchGlossaryTermPermission;
    const workflowPermissionFetch = isGlossaryActive
      ? getGlossaryVersionPermissions
      : getGlossaryTermVersionPermissions;

    try {
      if (isVersionsView) {
        const permission = VERSION_VIEW_GLOSSARY_PERMISSION;
        setGlossaryPermission(permission);
        setGlossaryTermPermission(permission);

        return permission;
      } else {
        const permission = await permissionFetch();
        let isConsumer = true;
        let canEditWorking = false;
        try {
          const workflowPermission = await workflowPermissionFetch(
            selectedData.id
          );
          isConsumer =
            workflowPermission.isConsumer ?? !workflowPermission.canViewWorking;
          canEditWorking = workflowPermission.canEditWorking;
        } catch {
          // Fail closed: mutation controls stay hidden when workflow authorization is unknown.
        }

        const isImmutableApprovedTerm =
          !isGlossaryActive &&
          selectedData.entityStatus === EntityStatus.Approved;

        if (isConsumer || isImmutableApprovedTerm) {
          const readOnlyPermission = {
            ...VERSION_VIEW_GLOSSARY_PERMISSION,
            ViewAll: permission.ViewAll,
            ViewBasic: permission.ViewBasic,
          };
          if (isGlossaryActive) {
            setGlossaryPermission(readOnlyPermission);
          } else {
            setGlossaryTermPermission(readOnlyPermission);
          }

          return readOnlyPermission;
        }

        if (
          !isGlossaryActive &&
          selectedData.entityStatus === EntityStatus.Draft &&
          canEditWorking
        ) {
          const workingEditPermission = {
            ...permission,
            EditAll: true,
            EditCustomFields: true,
            EditDescription: true,
            EditDisplayName: true,
            EditGlossaryTerms: true,
            EditOwners: true,
            EditTags: true,
          };
          setGlossaryTermPermission(workingEditPermission);

          return workingEditPermission;
        }

        return permission;
      }
    } finally {
      setIsPermissionLoading(false);
    }
  };

  const initializeGlossary = async () => {
    const permission = await initPermissions();
    if (permission?.ViewAll || permission?.ViewBasic) {
      // Only load terms if we're viewing a glossary term, not a glossary
      // GlossaryTermTab handles pagination for glossaries
      // Governed CDE/DQ identities are always direct glossary children. Their
      // versioned FQN is a read-model address, not a native parent-term FQN;
      // querying directChildrenOf with it produces a false 404 on detail pages.
      if (!isGlossaryActive && !isCDEGlossaryTerm && !isDQGlossaryTerm) {
        loadGlossaryTerms();
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id && !action && isSelectedEntityReady) {
      // Clear terms and reset pagination when switching entities
      setGlossaryChildTerms([]);
      setAfterCursor(undefined);
      setHasMore(true);
      initializeGlossary();
    }
    setIsTabExpanded(true);

    // Cleanup on unmount
    return () => {
      setGlossaryChildTerms([]);
    };
  }, [
    id,
    isGlossaryActive,
    isVersionsView,
    action,
    isSelectedEntityReady,
    selectedData.id,
    selectedData.entityStatus,
  ]);

  useEffect(() => {
    setGlossaryFunctionRef({
      onAddGlossaryTerm: (term) =>
        handleGlossaryTermModalAction(false, term ?? null),
      onEditGlossaryTerm: (term) =>
        handleGlossaryTermModalAction(true, term ?? null),
      refreshGlossaryTerms: () => loadGlossaryTerms(true),
      loadMoreTerms: loadMoreTerms,
    });
  }, [loadGlossaryTerms, handleGlossaryTermModalAction, loadMoreTerms]);

  const toggleTabExpanded = () => {
    setIsTabExpanded(!isTabExpanded);
  };

  const glossaryContent = useMemo(() => {
    if (!(glossaryPermission.ViewAll || glossaryPermission.ViewBasic)) {
      return (
        <div className="full-height">
          <ErrorPlaceHolder
            className="mt-0-important border-none"
            permissionValue={t('label.view-entity', {
              entity: t('label.glossary'),
            })}
            size={SIZE.X_LARGE}
            type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
          />
        </div>
      );
    }

    return (
      <GlossaryDetails
        handleGlossaryDelete={onGlossaryDelete}
        isTabExpanded={isTabExpanded}
        isVersionView={isVersionsView}
        permissions={glossaryPermission}
        toggleTabExpanded={toggleTabExpanded}
        updateGlossary={handleGlossaryUpdate}
        updateVote={updateVote}
      />
    );
  }, [
    glossaryPermission.ViewAll,
    glossaryPermission.ViewBasic,
    isTabExpanded,
    isVersionsView,
    onGlossaryDelete,
    handleGlossaryUpdate,
    updateVote,
  ]);

  return (
    <>
      {(isLoading || isPermissionLoading) && <Loader />}

      {isSelectedEntityReady && (
        <GenericProvider<Glossary | GlossaryTerm>
          currentVersionData={selectedData}
          customizedPage={customizedPage}
          data={selectedData}
          isTabExpanded={isTabExpanded}
          isVersionView={isVersionsView}
          permissions={
            isGlossaryActive ? glossaryPermission : glossaryTermPermission
          }
          type={
            isGlossaryActive ? EntityType.GLOSSARY : EntityType.GLOSSARY_TERM
          }
          onUpdate={handleGlossaryUpdate}>
          {!isLoading &&
            !isPermissionLoading &&
            !isEmpty(selectedData) &&
            (isGlossaryActive ? (
              glossaryContent
            ) : (
              <GlossaryTermsV1
                glossaryTerm={selectedData as GlossaryTerm}
                handleGlossaryTermDelete={onGlossaryTermDelete}
                handleGlossaryTermUpdate={onGlossaryTermUpdate}
                isSummaryPanelOpen={isSummaryPanelOpen}
                isTabExpanded={isTabExpanded}
                isVersionView={isVersionsView}
                refreshActiveGlossaryTerm={refreshActiveGlossaryTerm}
                toggleTabExpanded={toggleTabExpanded}
                updateVote={updateVote}
                onAssetClick={onAssetClick}
              />
            ))}
        </GenericProvider>
      )}

      {selectedData && (
        <EntityDeleteModal
          bodyText={getEntityDeleteMessage(selectedData.name, '')}
          entityName={selectedData.name}
          entityType="Glossary"
          visible={isDelete}
          onCancel={() => setIsDelete(false)}
          onConfirm={handleDelete}
        />
      )}

      {isEditModalOpen && (
        <GlossaryTermModal
          editMode={editMode}
          glossaryTermFQN={activeGlossaryTerm?.fullyQualifiedName}
          isCDEGlossary={isDataDictionaryGlossary(
            activeGlossary?.name,
            activeGlossary?.displayName
          )}
          isDQGlossary={isDataQualityGlossary(
            activeGlossary?.name,
            activeGlossary?.displayName,
            activeGlossary?.fullyQualifiedName
          )}
          parentBusinessVersion={selectedData.businessVersion}
          visible={isEditModalOpen}
          onCancel={() => setIsEditModalOpen(false)}
          onSave={handleGlossaryTermSave}
        />
      )}
    </>
  );
};

export default withActivityFeed(GlossaryV1);
