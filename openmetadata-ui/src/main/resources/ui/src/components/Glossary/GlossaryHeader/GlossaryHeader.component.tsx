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
import Icon, { DownOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Dropdown,
  Input,
  Modal,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { MenuInfo } from 'rc-menu/lib/interface';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep, isEmpty, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as IconTerm } from '../../../assets/svg/book.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { ReactComponent as ChangeHierarchyIcon } from '../../../assets/svg/ic-change-hierarchy.svg';
import { ReactComponent as IconDelete } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as ExportIcon } from '../../../assets/svg/ic-export.svg';
import { ReactComponent as ImportIcon } from '../../../assets/svg/ic-import.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { ReactComponent as IconDropdown } from '../../../assets/svg/menu.svg';
import { ReactComponent as StyleIcon } from '../../../assets/svg/style.svg';
import { ManageButtonItemLabel } from '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component';
import { useEntityExportModalProvider } from '../../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { EntityHeader } from '../../../components/Entity/EntityHeader/EntityHeader.component';
import ConfirmationModal from '../../../components/Modals/ConfirmationModal/ConfirmationModal';
import EntityDeleteModal from '../../../components/Modals/EntityDeleteModal/EntityDeleteModal';
import EntityNameModal from '../../../components/Modals/EntityNameModal/EntityNameModal.component';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { ExportTypes } from '../../../constants/Export.constants';
import { LEARNING_PAGE_IDS } from '../../../constants/Learning.constants';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { Operation } from '../../../generated/entity/policies/policy';
import { Style } from '../../../generated/type/tagLabel';
import { useFqn } from '../../../hooks/useFqn';
import {
  isDataDictionaryGlossary,
  isDataQualityGlossary,
} from '../../../constants/Glossary.contant';
import {
  exportDataDictionaryVersion,
  exportGlossaryInCSVFormat,
  createGlossaryTermWorkingVersion,
  getGlossariesById,
  getGlossaryTermVersionPermissions,
  getGlossaryTerms,
  getGlossaryTermsById,
  getGlossaryTermWorkingVersion,
  getGlossaryTermsVersionsList,
  getGlossaryTermsVersion,
  getGlossaryVersionsList,
  getGlossaryVersion,
  getGlossaryVersionPermissions,
  getGlossaryWorkingVersion,
  GlossaryVersionPermissions,
  GlossaryWorkflowAction,
  transitionGlossaryTermWorkflow,
  transitionGlossaryWorkflow,
} from '../../../rest/glossaryAPI';
import { API_RES_MAX_SIZE } from '../../../constants/constants';
import { CDE_GLOSSARY_TERM_FIELDS } from '../../../constants/Glossary.contant';
import { exportDQToExcel } from '../DQImportExport/DQImportExport.utils';

import { getEntityDeleteMessage } from '../../../utils/EntityDisplayUtils';
import {
  compareBusinessVersions,
  getBusinessVersion,
} from '../../../utils/BusinessVersionUtils';
import { getEntityImportPath } from '../../../utils/EntityPureUtils';
import Fqn from '../../../utils/Fqn';
import { checkPermission } from '../../../utils/PermissionsUtils';
import {
  getGlossaryPath,
  getGlossaryTermsVersionsPath,
  getGlossaryVersionsPath,
} from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import {
  getEntityStatusClass,
  getEntityStatusLabel,
} from '../../../utils/EntityStatusUtils';
import {
  getCdeDetailPath,
  parseCdeRoute,
} from '../../../utils/routing/cdeRoutingHelper';
import { TitleBreadcrumbProps } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import StatusBadge from '../../common/StatusBadge/StatusBadge.component';

import { LearningIcon } from '../../Learning/LearningIcon/LearningIcon.component';
import ChangeParentHierarchy from '../../Modals/ChangeParentHierarchy/ChangeParentHierarchy.component';
import StyleModal from '../../Modals/StyleModal/StyleModal.component';
import { useGlossaryStore } from '../useGlossary.store';
import { GlossaryHeaderProps } from './GlossaryHeader.interface';
import './glossery-header.less';

export { getCreatedDraftSearch } from '../../../utils/routing/cdeRoutingHelper';

export const suggestNextVersion = (ver: string, isGlossary = false): string => {
  const trimmed = ver.trim();
  if (isGlossary) {
    const match = trimmed.match(/^(\d+)(?:\.\d+)?$/);
    if (match) {
      try {
        const current = BigInt(match[1]);

        return (current + 1n).toString();
      } catch {
        return '2';
      }
    }

    return '2';
  }
  if (/^[1-9]\d*$/.test(trimmed)) {
    const digits = trimmed.split('').map(Number);
    for (let index = digits.length - 1; index >= 0; index--) {
      if (digits[index] < 9) {
        digits[index] += 1;

        return digits.join('');
      }
      digits[index] = 0;
    }

    return `1${digits.join('')}`;
  }
  const match = trimmed.match(/^(\d+)\.(\d+)$/);
  if (match) {
    const major = parseInt(match[1], 10);
    const minor = parseInt(match[2], 10);

    return `${major}.${minor + 1}`;
  }

  return trimmed ? `${trimmed}.1` : '1.1';
};

const GlossaryHeader = ({
  latestData,
  onDelete,
  onAssetAdd,
  onAddGlossaryTerm,
  onVersionSelect,
  onWorkflowTransition,
}: GlossaryHeaderProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { fqn } = useFqn();
  const { activeGlossary } = useGlossaryStore();
  const cdeRoute = useMemo(
    () =>
      parseCdeRoute({
        fqn,
        pathname: location.pathname,
        search: location.search,
      }),
    [fqn, location.pathname, location.search],
  );
  const {
    onUpdate,
    data: selectedData,
    isVersionView,
    permissions,
    type: entityType,
  } = useGenericContext<GlossaryTerm>();

  const { version, id } = useRequiredParams<{
    version: string;
    id: string;
  }>();
  const { showModal } = useEntityExportModalProvider();
  const [breadcrumb, setBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isNameEditing, setIsNameEditing] = useState<boolean>(false);
  const [latestGlossaryData, setLatestGlossaryData] = useState<
    Glossary | GlossaryTerm
  >();
  const [isStyleEditing, setIsStyleEditing] = useState(false);
  const [openChangeParentHierarchyModal, setOpenChangeParentHierarchyModal] =
    useState(false);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState<boolean>(false);
  const [isRevoking, setIsRevoking] = useState<boolean>(false);
  const [isSubmitForReviewModalOpen, setIsSubmitForReviewModalOpen] =
    useState<boolean>(false);
  const [isSubmittingForReview, setIsSubmittingForReview] =
    useState<boolean>(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [isReopening, setIsReopening] = useState(false);
  const [hasWorkflowConflict, setHasWorkflowConflict] = useState(false);
  const [isReloadingWorking, setIsReloadingWorking] = useState(false);
  const [isCreateDraftModalOpen, setIsCreateDraftModalOpen] =
    useState<boolean>(false);
  const [draftVersion, setDraftVersion] = useState<string>('');
  const [draftVersionError, setDraftVersionError] = useState<string>('');
  const [isCreatingDraft, setIsCreatingDraft] = useState<boolean>(false);
  const [availableVersions, setAvailableVersions] = useState<
    {
      label: string;
      snapshotVersion: string;
      snapshot?: Glossary | GlossaryTerm;
    }[]
  >([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const isGlossary = entityType === EntityType.GLOSSARY;
  const [workflowPermissions, setWorkflowPermissions] =
    useState<GlossaryVersionPermissions>();
  const [isWorkflowPermissionLoading, setIsWorkflowPermissionLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadWorkflowPermissions = async () => {
      setIsWorkflowPermissionLoading(true);
      setWorkflowPermissions(undefined);
      try {
        const value = isGlossary
          ? await getGlossaryVersionPermissions(selectedData.id)
          : await getGlossaryTermVersionPermissions(selectedData.id);
        if (!cancelled) {
          setWorkflowPermissions(value);
        }
      } catch {
        if (!cancelled) {
          setWorkflowPermissions(undefined);
        }
      } finally {
        if (!cancelled) {
          setIsWorkflowPermissionLoading(false);
        }
      }
    };

    if (selectedData?.id) {
      loadWorkflowPermissions();
    } else {
      setIsWorkflowPermissionLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [isGlossary, selectedData?.id]);
  const isConsumer = workflowPermissions
    ? (workflowPermissions.isConsumer ??
      !(
        workflowPermissions.canViewWorking ||
        workflowPermissions.canEditWorking ||
        workflowPermissions.canCreateVersion
      ))
    : false;
  const canRenderMutationActions =
    !isWorkflowPermissionLoading && !isConsumer && Boolean(workflowPermissions);
  const canViewHistory = Boolean(
    isConsumer ||
      workflowPermissions?.canViewWorking ||
      workflowPermissions?.canArchive,
  );
  const { permissions: globalPermissions } = usePermissionProvider();

  const createGlossaryTermPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.GLOSSARY_TERM,
        globalPermissions,
      ),
    [globalPermissions],
  );

  const importExportPermissions = useMemo(
    () =>
      checkPermission(
        Operation.All,
        ResourceEntity.GLOSSARY_TERM,
        globalPermissions,
      ) ||
      checkPermission(
        Operation.EditAll,
        ResourceEntity.GLOSSARY_TERM,
        globalPermissions,
      ),
    [globalPermissions],
  );

  // To fetch the latest glossary data
  // necessary to handle back click functionality to work properly in version page
  const fetchCurrentGlossaryInfo = async () => {
    const entityId = id ?? selectedData.id;
    if (!entityId) {
      return;
    }
    try {
      const res = isGlossary
        ? await getGlossariesById(entityId)
        : await getGlossaryTermsById(entityId);

      setLatestGlossaryData(res);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const glossaryTermStatus: EntityStatus = useMemo(() => {
    const raw = selectedData?.entityStatus ?? (selectedData as any)?.status;
    if (raw && String(raw).trim() !== '') {
      const normalized = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, '');
      const match = Object.values(EntityStatus).find(
        (val) => val.toLowerCase().replace(/[\s_-]+/g, '') === normalized,
      );
      if (match) {
        if (match === EntityStatus.Unprocessed) {
          return EntityStatus.Draft;
        }

        return match;
      }
    }

    return EntityStatus.Draft;
  }, [selectedData?.entityStatus, (selectedData as any)?.status]);

  const hasEditDisplayNamePermission =
    permissions.EditAll || permissions.EditDisplayName;

  const isCDEGlossary = useMemo(() => {
    if (!isGlossary) {
      return false;
    }

    return isDataDictionaryGlossary(
      selectedData?.name,
      selectedData?.displayName,
      selectedData?.fullyQualifiedName,
    );
  }, [isGlossary, selectedData]);

  const isDQGlossary = useMemo(() => {
    if (!isGlossary) {
      return false;
    }

    return isDataQualityGlossary(
      selectedData?.name,
      selectedData?.displayName,
      selectedData?.fullyQualifiedName,
    );
  }, [isGlossary, selectedData]);

  const [isExportingCDE, setIsExportingCDE] = useState(false);

  const handleCDEExportClick = useCallback(async () => {
    if (isExportingCDE) {
      return;
    }
    try {
      setIsExportingCDE(true);
      const parentBusinessVersion = getBusinessVersion(
        selectedData.businessVersion,
        ''
      );
      if (!parentBusinessVersion) {
        throw new Error('parentBusinessVersion is required for CDE export');
      }
      const { blob, fileName } = await exportDataDictionaryVersion(
        selectedData.id,
        parentBusinessVersion
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      showErrorToast(err as AxiosError);
    } finally {
      setIsExportingCDE(false);
    }
  }, [isExportingCDE, selectedData.businessVersion, selectedData.id]);

  const handleDQExportClick = useCallback(async () => {
    try {
      const { data } = await getGlossaryTerms({
        glossary: selectedData.id,
        limit: API_RES_MAX_SIZE,
        fields: CDE_GLOSSARY_TERM_FIELDS,
      });
      exportDQToExcel(data);
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  }, [selectedData.id]);

  const isCDEGlossaryTerm = useMemo(() => {
    if (isGlossary) {
      return false;
    }
    const term = selectedData as GlossaryTerm;

    return isDataDictionaryGlossary(
      term?.fullyQualifiedName,
      term?.glossary?.name,
      term?.glossary?.displayName,
    );
  }, [isGlossary, selectedData]);

  const isDQGlossaryTerm = useMemo(() => {
    if (isGlossary) {
      return false;
    }
    const term = selectedData as GlossaryTerm;

    return isDataQualityGlossary(
      term?.fullyQualifiedName,
      term?.glossary?.name,
      term?.glossary?.displayName,
    );
  }, [isGlossary, selectedData]);

  const isCustomManagedGlossary = isGlossary && (isCDEGlossary || isDQGlossary);
  const isCustomManagedTerm = isCDEGlossaryTerm || isDQGlossaryTerm;
  const isCustomManaged = isCustomManagedTerm || isCustomManagedGlossary;
  const isImmutableApprovedTerm =
    !isGlossary && glossaryTermStatus === EntityStatus.Approved;
  const canManageBusinessContent =
    !isImmutableApprovedTerm &&
    (!isCustomManaged || Boolean(workflowPermissions?.canEditWorking));
  const canDeleteBusinessContent =
    canManageBusinessContent &&
    !(isCDEGlossary && glossaryTermStatus === EntityStatus.Approved);
  const canCreateGlossaryTerm =
    canRenderMutationActions &&
    glossaryTermStatus !== EntityStatus.Archived &&
    (permissions.Create || createGlossaryTermPermission);
  const editDisplayNamePermission =
    hasEditDisplayNamePermission &&
    canManageBusinessContent &&
    (!isCDEGlossaryTerm || selectedData.workingRevision != null);
  const canImportCustomGlossary =
    canRenderMutationActions &&
    !isVersionView &&
    glossaryTermStatus !== EntityStatus.Archived &&
    Boolean(workflowPermissions?.canEditWorking);
  const canImportCDE =
    canImportCustomGlossary &&
    isGlossary &&
    isCDEGlossary &&
    [EntityStatus.Approved, EntityStatus.Draft].includes(glossaryTermStatus) &&
    Boolean(workflowPermissions?.canImportCdeDrafts);
  const canImportDQ = canImportCustomGlossary;

  const businessVersion = useMemo(() => {
    if (!isCustomManagedTerm && !isCustomManagedGlossary) {
      return null;
    }
    const data = selectedData as Glossary | GlossaryTerm;

    return getBusinessVersion(data.businessVersion, isGlossary ? '1' : '1.0');
  }, [isCustomManagedTerm, isCustomManagedGlossary, selectedData, isGlossary]);

  const icon = useMemo(() => {
    if (isGlossary) {
      return (
        <GlossaryIcon
          className="align-middle"
          color={DE_ACTIVE_COLOR}
          height={36}
          name="folder"
          width={32}
        />
      );
    }

    if (selectedData.style?.iconURL) {
      return (
        <img
          className="align-middle object-contain"
          data-testid="icon"
          height={36}
          src={selectedData.style?.iconURL}
          width={32}
        />
      );
    }

    return (
      <IconTerm
        className="align-middle"
        color={DE_ACTIVE_COLOR}
        height={36}
        name="doc"
        width={32}
      />
    );
  }, [selectedData, isGlossary]);

  const handleAddGlossaryTermClick = useCallback(() => {
    onAddGlossaryTerm(!isGlossary ? selectedData : undefined);
  }, [fqn]);

  const handleGlossaryImport = () => {
    const importPath = getEntityImportPath(
      EntityType.GLOSSARY,
      selectedData?.fullyQualifiedName || fqn,
    );

    navigate(
      isCDEGlossary
        ? `${importPath}?parentBusinessVersion=${encodeURIComponent(
            String(businessVersion),
          )}`
        : importPath,
    );
  };

  const handleVersionClick = async () => {
    let path: string;
    if (isVersionView) {
      path = getGlossaryPath(latestGlossaryData?.fullyQualifiedName);
    } else {
      const targetVersion = isCustomManagedTerm
        ? String(businessVersion ?? (isGlossary ? '1' : '1.0'))
            .trim()
            .replace(/^(version:?\s*|v)/i, '')
        : toString(selectedData.version);

      path = isGlossary
        ? getGlossaryVersionsPath(selectedData.id, targetVersion)
        : getGlossaryTermsVersionsPath(selectedData.id, targetVersion);
    }

    navigate(path);
  };

  const loadAvailableVersions = async (open: boolean) => {
    if (!open || (!isCustomManagedTerm && !isCustomManagedGlossary)) {
      return;
    }

    setIsLoadingVersions(true);
    try {
      const history = isGlossary
        ? await getGlossaryVersionsList(selectedData.id)
        : await getGlossaryTermsVersionsList(
            selectedData.id,
            cdeRoute.parentBusinessVersion ?? selectedData.parentBusinessVersion
          );
      let versions: {
        label: string;
        snapshotVersion: string;
        snapshot?: Glossary | GlossaryTerm;
      }[] = (history?.versions ?? [])
        .map((snapshot) =>
          typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot,
        )
        .filter(
          (snapshot) => {
            const status =
              snapshot.entityStatus ??
              snapshot.status ??
              (snapshot.archivedAt != null
                ? EntityStatus.Archived
                : EntityStatus.Approved);

            return (
              status === EntityStatus.Approved ||
              (status === EntityStatus.Archived && canViewHistory)
            );
          },
        )
        .sort(
          (first, second) =>
            Number(second.version ?? 0) - Number(first.version ?? 0),
        )
        .map((snapshot) => {
          const label = getBusinessVersion(
            snapshot.businessVersion,
            isGlossary ? '1' : '1.0',
          )
            .trim()
            .replace(/^(version:?\s*|v)/i, '');

          return { label, snapshotVersion: label, snapshot };
        });

      const currentVerClean = String(businessVersion ?? (isGlossary ? '1' : '1.0'))
        .trim()
        .replace(/^(version:?\s*|v)/i, '');

      if (isGlossary && workflowPermissions?.canViewWorking) {
        try {
          const working = await getGlossaryWorkingVersion(selectedData.id);
          const workingBusinessVersion = getBusinessVersion(
            working.businessVersion,
            '1',
          )
            .trim()
            .replace(/^(version:?\s*|v)/i, '');
          if (
            workingBusinessVersion &&
            !versions.some((item) => item.label === workingBusinessVersion)
          ) {
            versions.unshift({
              label: workingBusinessVersion,
              snapshotVersion: workingBusinessVersion,
              snapshot: working,
            });
          }
        } catch (error) {
          if ((error as AxiosError)?.response?.status !== 404) {
            throw error;
          }
        }
      }

      if (!isGlossary && workflowPermissions?.canViewWorking) {
        try {
          const working = await getGlossaryTermWorkingVersion(
            selectedData.id,
            cdeRoute.parentBusinessVersion
          );
          const workingBusinessVersion = getBusinessVersion(
            working.businessVersion,
          )
            .trim()
            .replace(/^(version:?\s*|v)/i, '');
          if (
            workingBusinessVersion &&
            !versions.some((item) => item.label === workingBusinessVersion)
          ) {
            versions.unshift({
              label: workingBusinessVersion,
              snapshotVersion: workingBusinessVersion,
              snapshot: working,
            });
          }
        } catch (error) {
          if ((error as AxiosError)?.response?.status !== 404) {
            throw error;
          }
        }
      }

      if (isGlossary && activeGlossary?.id === selectedData.id) {
        const latestBusinessVersion = getBusinessVersion(
          activeGlossary.businessVersion,
          '1',
        )
          .trim()
          .replace(/^(version:?\s*|v)/i, '');
        if (!versions.some((item) => item.label === latestBusinessVersion)) {
          versions.unshift({
            label: latestBusinessVersion,
            snapshotVersion: latestBusinessVersion,
            snapshot: activeGlossary,
          });
        }
      }

      if (!isGlossary && latestData?.id === selectedData.id) {
        const latestBusinessVersion = getBusinessVersion(
          latestData.businessVersion,
        )
          .trim()
          .replace(/^(version:?\s*|v)/i, '');
        if (!versions.some((item) => item.label === latestBusinessVersion)) {
          versions.unshift({
            label: latestBusinessVersion,
            snapshotVersion: latestBusinessVersion,
            snapshot: latestData,
          });
        }
      }

      const currentIsArchived =
        selectedData.entityStatus === EntityStatus.Archived ||
        selectedData.archivedAt != null;
      if (
        (!currentIsArchived || canViewHistory) &&
        !versions.some((v) => v.label === currentVerClean)
      ) {
        versions.unshift({
          label: currentVerClean,
          snapshotVersion: currentVerClean,
          snapshot: selectedData,
        });
      }

      setAvailableVersions(
        versions
          .filter(
            (item, index) =>
              versions.findIndex((version) => version.label === item.label) ===
              index,
          )
          .sort((first, second) =>
            compareBusinessVersions(second.label, first.label),
          ),
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const selectVersion = async (snapshotVersion: string) => {
    try {
      const availableVersion = availableVersions.find(
        (item) => item.snapshotVersion === snapshotVersion,
      );
      if (availableVersion?.snapshot) {
        onVersionSelect?.(availableVersion.snapshot);

        return;
      }

      if (
        !isGlossary &&
        latestData?.id === selectedData.id &&
        toString(latestData.version) === snapshotVersion
      ) {
        onVersionSelect?.(latestData);

        return;
      }

      if (
        isGlossary &&
        activeGlossary?.id === selectedData.id &&
        toString(activeGlossary.version) === snapshotVersion
      ) {
        onVersionSelect?.(activeGlossary);

        return;
      }

      const snapshot = isGlossary
        ? await getGlossaryVersion(selectedData.id, snapshotVersion)
        : await getGlossaryTermsVersion(
            selectedData.id,
            snapshotVersion,
            cdeRoute.parentBusinessVersion ?? selectedData.parentBusinessVersion
          );
      onVersionSelect?.(
        isGlossary && !snapshot.entityStatus
          ? { ...snapshot, entityStatus: EntityStatus.Approved }
          : snapshot,
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleDelete = async () => {
    const { id } = selectedData;
    await onDelete(id);
    setIsDelete(false);
  };

  const onNameSave = async (obj: { name: string; displayName?: string }) => {
    const { name, displayName } = obj;
    let updatedDetails = cloneDeep(selectedData);

    updatedDetails = {
      ...selectedData,
      name: isCDEGlossaryTerm
        ? selectedData.name
        : name?.trim() || selectedData.name,
      displayName: displayName?.trim(),
    };

    await onUpdate(updatedDetails);
    setIsNameEditing(false);
  };

  const onStyleSave = async (data: Style) => {
    const style: Style = {
      // if color/iconURL is empty or undefined send undefined
      color: !isEmpty(data.color) ? data.color : undefined,
      iconURL: !isEmpty(data.iconURL) ? data.iconURL : undefined,
    };
    const updatedDetails = {
      ...selectedData,
      style,
    };

    await onUpdate(updatedDetails);
    setIsStyleEditing(false);
  };

  const canRevokeApproval = useMemo(() => {
    if (isVersionView || glossaryTermStatus !== EntityStatus.Approved) {
      return false;
    }

    return Boolean(workflowPermissions?.canArchive);
  }, [isVersionView, glossaryTermStatus, workflowPermissions]);

  const canCreateDraft = useMemo(() => {
    const hasWorkingCopy = selectedData.workingRevision != null;
    if (
      isVersionView ||
      glossaryTermStatus !== EntityStatus.Approved ||
      hasWorkingCopy
    ) {
      return false;
    }

    return (
      (isGlossary || isCDEGlossaryTerm) &&
      Boolean(workflowPermissions?.canCreateVersion)
    );
  }, [
    isVersionView,
    isGlossary,
    isCDEGlossaryTerm,
    glossaryTermStatus,
    workflowPermissions,
    selectedData.workingRevision,
  ]);

  const runWorkflowAction = async (
    action: GlossaryWorkflowAction,
    options?: { businessVersion?: string },
  ) => {
    const expectedRevision = Number(selectedData.workingRevision);
    if (
      action !== 'createDraft' &&
      action !== 'revoke' &&
      !Number.isFinite(expectedRevision)
    ) {
      throw new Error(
        'Working version revision is required for workflow actions',
      );
    }
    const request = {
      ...(Number.isFinite(expectedRevision) ? { expectedRevision } : {}),
      ...(options?.businessVersion
        ? { businessVersion: options.businessVersion }
        : {}),
    };
    const updated = isGlossary
      ? await transitionGlossaryWorkflow(selectedData.id, action, request)
      : action === 'createDraft'
        ? await createGlossaryTermWorkingVersion(
            selectedData.id,
            options?.businessVersion ?? '',
            cdeRoute.parentBusinessVersion ??
              getBusinessVersion(activeGlossary?.businessVersion, ''),
          )
        : action === 'submit' || action === 'reject' || action === 'reopen'
          ? await transitionGlossaryTermWorkflow(selectedData.id, action, {
              expectedRevision,
            })
          : await transitionGlossaryTermWorkflow(
              selectedData.id,
              action,
              request,
            );
    if (!isGlossary && action === 'createDraft') {
      const createdBusinessVersion = getBusinessVersion(
        updated.businessVersion,
        options?.businessVersion ?? '',
      );

      const parentVersion =
        cdeRoute.parentBusinessVersion ??
        getBusinessVersion(activeGlossary?.businessVersion, '');

      navigate(
        getCdeDetailPath({
          fqn: selectedData.fullyQualifiedName ?? selectedData.name,
          businessVersion: createdBusinessVersion,
          parentBusinessVersion: parentVersion,
          isWorkingDraft: true,
        }),
        { replace: true },
      );
    }
    await onWorkflowTransition?.(updated, action);
    setHasWorkflowConflict(false);

    return updated;
  };

  const handleWorkflowError = (error: unknown) => {
    if ((error as AxiosError)?.response?.status === 409) {
      setHasWorkflowConflict(true);
    }
    showErrorToast(error as AxiosError);
  };

  const handleReloadWorking = async () => {
    try {
      setIsReloadingWorking(true);
      const latest = isGlossary
        ? await getGlossariesById(selectedData.id)
        : await getGlossaryTermsById(selectedData.id);
      await onWorkflowTransition?.(latest);
      setHasWorkflowConflict(false);
      setIsCreateDraftModalOpen(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsReloadingWorking(false);
    }
  };

  const handleCreateDraft = async () => {
    if (isCreatingDraft) {
      return;
    }
    const cleanVer = draftVersion.trim();
    const isCanonical = isGlossary
      ? /^[1-9]\d*$/.test(cleanVer)
      : /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(cleanVer);
    if (cleanVer.length > 64 || !isCanonical) {
      setDraftVersionError(
        isGlossary
          ? 'Phiên bản Từ điển phải là số nguyên dương, không có số 0 ở đầu.'
          : 'Phiên bản phải có định dạng MAJOR.MINOR, không có số 0 ở đầu và tối đa 64 ký tự.',
      );

      return;
    }
    const expectedVersion = suggestNextVersion(
      String(businessVersion ?? (isGlossary ? '1' : '1.0')),
      isGlossary,
    );
    if (isGlossary ? cleanVer !== expectedVersion : compareBusinessVersions(cleanVer, String(businessVersion ?? '0.0')) <= 0) {
      setDraftVersionError(
        isGlossary
          ? `Phiên bản kế tiếp bắt buộc là ${expectedVersion}.`
          : 'Phiên bản mới phải lớn hơn phiên bản Approved mới nhất.',
      );

      return;
    }
    try {
      setIsCreatingDraft(true);
      await runWorkflowAction('createDraft', {
        businessVersion: cleanVer,
      });
      showSuccessToast(t('message.create-draft-success'));
      setIsCreateDraftModalOpen(false);
    } catch (error) {
      if ((error as AxiosError)?.response?.status === 409) {
        setHasWorkflowConflict(true);
      } else {
        showErrorToast(error as AxiosError);
      }
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const handleRevokeApproval = async () => {
    try {
      setIsRevoking(true);
      await runWorkflowAction('revoke');
      showSuccessToast(t('message.revoke-approval-success'));
      setIsRevokeModalOpen(false);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsRevoking(false);
    }
  };

  const canSubmitForReview = useMemo(() => {
    if (isVersionView || glossaryTermStatus !== EntityStatus.Draft) {
      return false;
    }

    return Boolean(workflowPermissions?.canSubmit);
  }, [isVersionView, glossaryTermStatus, workflowPermissions]);

  const handleSubmitForReview = async () => {
    try {
      setIsSubmittingForReview(true);
      await runWorkflowAction('submit');
      showSuccessToast(t('message.submit-for-review-success'));
      setIsSubmitForReviewModalOpen(false);
    } catch (error) {
      handleWorkflowError(error);
    } finally {
      setIsSubmittingForReview(false);
    }
  };

  const canApprove = useMemo(() => {
    if (isVersionView || !workflowPermissions) {
      return false;
    }

    return (
      glossaryTermStatus === EntityStatus.InReview &&
      workflowPermissions.canApprove
    );
  }, [isVersionView, workflowPermissions, glossaryTermStatus]);

  const canApproveOrReject =
    canApprove ||
    (!isVersionView &&
      glossaryTermStatus === EntityStatus.InReview &&
      Boolean(workflowPermissions?.canReject));

  const handleApproveTerm = async () => {
    if (isApproving) {
      return;
    }
    try {
      setIsApproving(true);
      await runWorkflowAction('approve');
      showSuccessToast(
        t('message.entity-approved-success', {
          entity: isGlossary ? t('label.glossary') : t('label.glossary-term'),
        }),
      );
      setIsApproveModalOpen(false);
    } catch (error) {
      handleWorkflowError(error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectTerm = async () => {
    try {
      setIsRejecting(true);
      await runWorkflowAction('reject');
      showSuccessToast(
        t('message.entity-rejected-success', {
          entity: isGlossary ? t('label.glossary') : t('label.glossary-term'),
        }),
      );
      setIsRejectModalOpen(false);
    } catch (error) {
      handleWorkflowError(error);
    } finally {
      setIsRejecting(false);
    }
  };

  const canReopen =
    !isVersionView &&
    glossaryTermStatus === EntityStatus.Rejected &&
    Boolean(workflowPermissions?.canEditWorking);

  const handleReopen = async () => {
    try {
      setIsReopening(true);
      await runWorkflowAction('reopen');
      showSuccessToast(t('message.create-draft-success'));
    } catch (error) {
      handleWorkflowError(error);
    } finally {
      setIsReopening(false);
    }
  };

  const addButtonContent = [
    {
      label: t('label.glossary-term'),
      key: '1',
      onClick: handleAddGlossaryTermClick,
    },
    {
      label: t('label.asset-plural'),
      key: '2',
      onClick: onAssetAdd,
    },
  ];

  const handleGlossaryExportClick = useCallback(async () => {
    if (selectedData) {
      showModal({
        name: selectedData?.fullyQualifiedName || '',
        onExport: exportGlossaryInCSVFormat,
        exportTypes: [ExportTypes.CSV],
      });
    }
  }, [selectedData]);

  const manageButtonContent: ItemType[] = [
    ...(isGlossary && (isCDEGlossary || isDQGlossary || importExportPermissions)
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.export-entity-help', {
                  entity: t('label.glossary-term-lowercase-plural'),
                })}
                icon={ExportIcon}
                id="export-button"
                name={
                  isDQGlossary
                    ? t('dq.export-excel', 'Xuất Excel')
                    : isCDEGlossary
                      ? t('cde.export-excel', 'Xuất Excel')
                      : t('label.export')
                }
              />
            ),
            key: 'export-button',
            disabled: isCDEGlossary && isExportingCDE,
            onClick: (e) => {
              e.domEvent.stopPropagation();
              if (isDQGlossary) {
                handleDQExportClick();
              } else if (isCDEGlossary) {
                handleCDEExportClick();
              } else {
                handleGlossaryExportClick();
              }
              setShowActions(false);
            },
          },
          ...((
            isDQGlossary
              ? canImportDQ
              : isCDEGlossary
                ? canImportCDE
                : importExportPermissions
          )
            ? [
                {
                  label: (
                    <ManageButtonItemLabel
                      description={t('message.import-entity-help', {
                        entity: t('label.glossary-term-lowercase'),
                      })}
                      icon={ImportIcon}
                      id="import-button"
                      name={
                        isDQGlossary
                          ? t('dq.import-excel', 'Nhập Excel')
                          : isCDEGlossary
                            ? t('cde.import-excel', 'Nhập Excel')
                            : t('label.import')
                      }
                    />
                  ),
                  key: 'import-button',
                  onClick: (e: MenuInfo) => {
                    e.domEvent.stopPropagation();
                    handleGlossaryImport();
                    setShowActions(false);
                  },
                },
              ]
            : []),
        ] as ItemType[])
      : []),
    ...(editDisplayNamePermission
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={
                  isCDEGlossaryTerm
                    ? t('message.update-displayName-entity', {
                        entity: t('label.glossary-term'),
                      })
                    : t('message.rename-entity', {
                        entity: isGlossary
                          ? t('label.glossary')
                          : t('label.glossary-term'),
                      })
                }
                icon={EditIcon}
                id="rename-button"
                name={
                  isCDEGlossaryTerm
                    ? t('label.edit-glossary-display-name')
                    : t('label.rename')
                }
              />
            ),
            key: 'rename-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsNameEditing(true);
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),
    ...(permissions?.EditAll && !isGlossary && canManageBusinessContent
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.edit-entity-style-description', {
                  entity: t('label.glossary-term'),
                })}
                icon={StyleIcon}
                id="edit-style-button"
                name={t('label.style')}
              />
            ),
            key: 'edit-style-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsStyleEditing(true);
              setShowActions(false);
            },
          },
          {
            label: (
              <ManageButtonItemLabel
                description={t('message.modify-hierarchy-entity-description', {
                  entity: t('label.term'),
                })}
                icon={ChangeHierarchyIcon}
                id="change-parent-button"
                name={t('label.change-parent-entity', {
                  entity: t('label.term'),
                })}
              />
            ),
            key: 'change-parent-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setOpenChangeParentHierarchyModal(true);
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),

    ...(permissions.Delete && canDeleteBusinessContent
      ? ([
          {
            label: (
              <ManageButtonItemLabel
                description={t(
                  'message.delete-entity-type-action-description',
                  {
                    entityType: isGlossary
                      ? t('label.glossary')
                      : t('label.glossary-term'),
                  },
                )}
                icon={IconDelete}
                id="delete-button"
                name={t('label.delete')}
              />
            ),
            key: 'delete-button',
            onClick: (e) => {
              e.domEvent.stopPropagation();
              setIsDelete(true);
              setShowActions(false);
            },
          },
        ] as ItemType[])
      : []),
  ];

  const immutableTermActionKeys = new Set([
    'rename-button',
    'edit-style-button',
    'change-parent-button',
    'delete-button',
  ]);
  const availableManageButtonContent = isImmutableApprovedTerm
    ? manageButtonContent.filter(
        (item) => !immutableTermActionKeys.has(String(item?.key ?? '')),
      )
    : manageButtonContent;
  const visibleManageButtonContent = isVersionView
    ? isCDEGlossary
      ? availableManageButtonContent.filter(
          (item) => item?.key === 'export-button',
        )
      : []
    : isCDEGlossary
      ? canRenderMutationActions
        ? availableManageButtonContent
        : availableManageButtonContent.filter(
            (item) => item?.key === 'export-button',
          )
      : canRenderMutationActions
        ? availableManageButtonContent
        : [];

  const statusBadge = useMemo(() => {
    const entityStatus = glossaryTermStatus;
    const statusClass = getEntityStatusClass(entityStatus);

    if (isCustomManagedTerm || isCustomManagedGlossary) {
      const rawVersion = String(businessVersion ?? '1.0').trim();
      const cleanVersion = rawVersion.replace(/^(version:?\s*)/i, '');
      const versionLabel = `${t('label.version')}: ${cleanVersion}`;

      const currentVersionItem = {
        label: cleanVersion,
        snapshotVersion: cleanVersion,
        snapshot: selectedData,
      };
      const versionList =
        availableVersions.length > 0 ? availableVersions : [currentVersionItem];

      if (isWorkflowPermissionLoading) {
        return (
          <Space align="center" size={8}>
            <StatusBadge label={entityStatus} status={statusClass} />
            <span
              className={`status-badge cde-header-version-badge ${statusClass}`}>
              <span className={`status-badge-label ${statusClass}`}>
                {versionLabel}
              </span>
            </span>
          </Space>
        );
      }

      return (
        <Space align="center" size={8}>
          <StatusBadge label={entityStatus} status={statusClass} />
          <Dropdown
            menu={{
              items: isLoadingVersions
                ? [
                    {
                      key: 'loading',
                      label: t('label.loading'),
                      disabled: true,
                    },
                  ]
                : versionList.map((availableVersion) => ({
                    key: availableVersion.snapshotVersion,
                    label: isGlossary
                      ? `${t('label.version')}: ${availableVersion.label} — ${getEntityStatusLabel(
                          (availableVersion.snapshot?.entityStatus ??
                            (availableVersion.snapshot?.archivedAt != null
                              ? EntityStatus.Archived
                              : EntityStatus.Approved)) as EntityStatus,
                        )}`
                      : `${t('label.version')}: ${availableVersion.label}`,
                  })),
              onClick: ({ key }) => selectVersion(key),
            }}
            trigger={['click']}
            onOpenChange={loadAvailableVersions}>
            <button
              className={classNames(
                'status-badge cde-header-version-badge',
                statusClass,
              )}
              data-testid="version-button"
              type="button">
              <span className={`status-badge-label ${statusClass}`}>
                {versionLabel}
              </span>
              <DownOutlined />
            </button>
          </Dropdown>
        </Space>
      );
    }

    return <StatusBadge label={entityStatus} status={statusClass} />;
  }, [
    selectedData,
    isGlossary,
    isCustomManagedTerm,
    isCustomManagedGlossary,
    businessVersion,
    isVersionView,
    availableVersions,
    isLoadingVersions,
    isWorkflowPermissionLoading,
    glossaryTermStatus,
    navigate,
    t,
  ]);

  const createButtons = useMemo(() => {
    // CDEs are always direct children of the Data Dictionary. The native term actions create a
    // sub-term or attach an asset, neither of which is a valid CDE authoring action.
    if (isCDEGlossaryTerm) {
      return null;
    }

    if (canCreateGlossaryTerm) {
      return isGlossary ? (
        <Button
          className="m-l-xs"
          data-testid="add-new-tag-button-header"
          size="middle"
          type="primary"
          onClick={handleAddGlossaryTermClick}>
          {t('label.add-entity', { entity: t('label.term-lowercase') })}
        </Button>
      ) : (
        <>
          {glossaryTermStatus &&
            glossaryTermStatus === EntityStatus.Approved && (
              <Dropdown
                className="m-l-xs"
                menu={{
                  items: addButtonContent,
                }}
                placement="bottomRight"
                trigger={['click']}>
                <Button
                  data-testid="glossary-term-add-button-menu"
                  type="primary">
                  <Space>
                    {t('label.add')}
                    <DownOutlined />
                  </Space>
                </Button>
              </Dropdown>
            )}
        </>
      );
    }

    return null;
  }, [
    isGlossary,
    isCDEGlossaryTerm,
    permissions,
    createGlossaryTermPermission,
    addButtonContent,
    glossaryTermStatus,
    canCreateGlossaryTerm,
  ]);

  const approvalActionButtons = useMemo(() => {
    if (isVersionView || !canRenderMutationActions) {
      return null;
    }

    const currentVer = businessVersion ?? (isGlossary ? '1' : '1.0');
    const cleanVer = String(currentVer)
      .trim()
      .replace(/^(version:?\s*|v)/i, '');

    return (
      <Space size={8}>
        {canApproveOrReject && (
          <>
            {canApprove && (
              <Button
                className="m-l-xs"
                disabled={isApproving}
                style={{
                  backgroundColor: '#10b981',
                  borderColor: '#10b981',
                  color: '#fff',
                }}
                type="primary"
                onClick={() => setIsApproveModalOpen(true)}>
                {t('label.approve')}
              </Button>
            )}
            {workflowPermissions?.canReject && (
              <Button
                danger
                className="m-l-xs"
                disabled={isRejecting}
                onClick={() => setIsRejectModalOpen(true)}>
                {t('label.reject')}
              </Button>
            )}
          </>
        )}

        {canSubmitForReview && glossaryTermStatus !== EntityStatus.InReview && (
          <Button
            className="m-l-xs"
            disabled={isSubmittingForReview}
            type="primary"
            onClick={() => setIsSubmitForReviewModalOpen(true)}>
            {t('label.submit-for-review')}
          </Button>
        )}

        {canReopen && (
          <Button
            className="m-l-xs"
            loading={isReopening}
            onClick={handleReopen}>
            Chỉnh sửa lại
          </Button>
        )}

        {canCreateDraft && glossaryTermStatus === EntityStatus.Approved && (
          <Button
            className="m-l-xs"
            onClick={() => {
              setDraftVersion(suggestNextVersion(cleanVer, isGlossary));
              setDraftVersionError('');
              setIsCreateDraftModalOpen(true);
            }}>
            {t('label.create-draft')}
          </Button>
        )}

        {canRevokeApproval && glossaryTermStatus === EntityStatus.Approved && (
          <Button
            danger
            className="m-l-xs"
            onClick={() => setIsRevokeModalOpen(true)}>
            {t('label.revoke-approval')}
          </Button>
        )}
      </Space>
    );
  }, [
    isVersionView,
    canApproveOrReject,
    canApprove,
    workflowPermissions,
    canSubmitForReview,
    isSubmittingForReview,
    canReopen,
    isReopening,
    canCreateDraft,
    canRevokeApproval,
    glossaryTermStatus,
    selectedData,
    businessVersion,
    t,
    canRenderMutationActions,
  ]);

  /**
   * To create breadcrumb from the fqn
   * @param fqn fqn of glossary or glossary term
   */
  const handleBreadcrumb = (fqn: string) => {
    if (!fqn) {
      return;
    }

    const arr = !isGlossary ? Fqn.split(fqn) : [];
    const dataFQN: Array<string> = [];
    const glossaryDisplayName = (selectedData as GlossaryTerm)?.glossary
      ?.displayName;
    const glossaryName = (selectedData as GlossaryTerm)?.glossary?.name;
    const { parentBusinessVersion } = cdeRoute;

    const newData = [
      {
        name: t('label.glossary-plural'),
        url: getGlossaryPath(arr[0]),
        activeTitle: false,
      },
      ...arr.slice(0, -1).map((d, index) => {
        dataFQN.push(d);
        const glossaryPath = getGlossaryPath(dataFQN.join(FQN_SEPARATOR_CHAR));
        const nameToDisplay =
          index === 0 &&
          glossaryDisplayName &&
          (d === glossaryName || d === glossaryDisplayName)
            ? `${glossaryDisplayName}${
                parentBusinessVersion ? ` (v${parentBusinessVersion})` : ''
              }`
            : d;

        return {
          name: nameToDisplay,
          url:
            index === 0 && parentBusinessVersion
              ? `${glossaryPath}?businessVersion=${encodeURIComponent(
                  parentBusinessVersion,
                )}`
              : glossaryPath,
          activeTitle: false,
        };
      }),
    ];

    setBreadcrumb(newData);
  };

  useEffect(() => {
    const { fullyQualifiedName, name } = selectedData;
    handleBreadcrumb(fullyQualifiedName ?? name);
  }, [
    selectedData?.fullyQualifiedName,
    selectedData?.name,
    (selectedData as GlossaryTerm)?.glossary?.displayName,
    location.search,
  ]);

  useEffect(() => {
    if (isVersionView) {
      fetchCurrentGlossaryInfo();
    }
  }, [id, isVersionView, selectedData.id]);

  return (
    <>
      <div className="glossary-header flex gap-4 justify-between no-wrap ">
        <div className="flex w-min-0 flex-auto">
          <EntityHeader
            badge={statusBadge}
            breadcrumb={breadcrumb}
            entityData={selectedData}
            entityType={EntityType.GLOSSARY_TERM}
            icon={icon}
            serviceName=""
            suffix={
              !isGlossary && (
                <LearningIcon pageId={LEARNING_PAGE_IDS.GLOSSARY_TERM} />
              )
            }
            titleColor={isGlossary ? undefined : selectedData.style?.color}
          />
        </div>
        <div className="flex items-center">
          <div className="d-flex gap-3 justify-end items-center">
            {!isVersionView && approvalActionButtons}
            {!isVersionView && createButtons}

            <ButtonGroup className="spaced" size="small">
              {!isCustomManaged && !isGlossary && selectedData?.version && (
                <Tooltip
                  title={t(
                    `label.${
                      isVersionView
                        ? 'exit-version-history'
                        : 'version-plural-history'
                    }`,
                  )}>
                  <Button
                    className={classNames('', {
                      'text-primary border-primary': version,
                    })}
                    data-testid="version-button"
                    icon={<Icon component={VersionIcon} />}
                    onClick={handleVersionClick}>
                    <Typography.Text
                      className={classNames('', {
                        'text-primary': version,
                      })}>
                      {toString(selectedData.version)}
                    </Typography.Text>
                  </Button>
                </Tooltip>
              )}

              {visibleManageButtonContent.length > 0 && (
                  <Dropdown
                    align={{ targetOffset: [-12, 0] }}
                    className="m-l-xs"
                    menu={{
                      items: visibleManageButtonContent,
                    }}
                    open={showActions}
                    overlayClassName="glossary-manage-dropdown-list-container"
                    overlayStyle={{ width: '350px' }}
                    placement="bottomRight"
                    trigger={['click']}
                    onOpenChange={setShowActions}>
                    <Tooltip
                      placement="topRight"
                      title={t('label.manage-entity', {
                        entity: isGlossary
                          ? t('label.glossary')
                          : t('label.glossary-term'),
                      })}>
                      <Button
                        className="glossary-manage-dropdown-button"
                        data-testid="manage-button"
                        icon={
                          <IconDropdown
                            className="vertical-align-inherit manage-dropdown-icon"
                            height={16}
                            width={16}
                          />
                        }
                        onClick={() => setShowActions(true)}
                      />
                    </Tooltip>
                  </Dropdown>
                )}
            </ButtonGroup>
          </div>
        </div>
      </div>
      {!isGlossary &&
        glossaryTermStatus === EntityStatus.Rejected &&
        selectedData.rejectedBy && (
          <Typography.Text className="text-grey-muted" type="secondary">
            Từ chối bởi {selectedData.rejectedBy}
            {selectedData.rejectedAt
              ? ` lúc ${new Date(selectedData.rejectedAt).toLocaleString()}`
              : ''}
          </Typography.Text>
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

      <EntityNameModal<GlossaryTerm>
        allowRename={!isCDEGlossaryTerm}
        entity={selectedData}
        nameValidationRules={[
          {
            min: 1,
            max: 128,
            message: t('message.entity-size-in-between', {
              entity: t('label.name'),
              min: 1,
              max: 128,
            }),
          },
        ]}
        title={
          isCDEGlossaryTerm
            ? t('label.edit-glossary-display-name')
            : t('label.edit-entity', {
                entity: t('label.name'),
              })
        }
        visible={isNameEditing}
        onCancel={() => setIsNameEditing(false)}
        onSave={onNameSave}
      />

      <StyleModal
        open={isStyleEditing}
        style={selectedData.style}
        onCancel={() => setIsStyleEditing(false)}
        onSubmit={onStyleSave}
      />

      {openChangeParentHierarchyModal && (
        <ChangeParentHierarchy
          selectedData={selectedData}
          onCancel={() => setOpenChangeParentHierarchyModal(false)}
        />
      )}

      <ConfirmationModal
        bodyText={t('message.confirm-revoke-approval-message')}
        cancelText={t('label.cancel')}
        confirmText={t('label.revoke-approval')}
        header={t('message.confirm-revoke-approval-title')}
        isLoading={isRevoking}
        visible={isRevokeModalOpen}
        onCancel={() => setIsRevokeModalOpen(false)}
        onConfirm={handleRevokeApproval}
      />

      {hasWorkflowConflict && !isGlossary && (
        <Alert
          showIcon
          action={
            <Button
              loading={isReloadingWorking}
              size="small"
              onClick={handleReloadWorking}>
              Tải representation mới nhất
            </Button>
          }
          className="m-b-sm"
          message="Bản làm việc đã thay đổi. Trạng thái hiện tại được giữ nguyên cho đến khi bạn tải lại."
          type="warning"
        />
      )}

      <Modal
        centered
        destroyOnClose
        closable={false}
        confirmLoading={isCreatingDraft}
        data-testid="cde-create-draft-modal"
        maskClosable={false}
        okButtonProps={{
          disabled:
            isCreatingDraft ||
            (isCustomManaged &&
              (!draftVersion.trim() || Boolean(draftVersionError))),
        }}
        okText={t('label.create-draft')}
        open={isCreateDraftModalOpen}
        title={
          <Typography.Text strong data-testid="modal-header">
            {t('message.confirm-create-draft-title')}
          </Typography.Text>
        }
        onCancel={() => setIsCreateDraftModalOpen(false)}
        onOk={handleCreateDraft}>
        <div className="d-flex flex-col gap-3">
          <Typography.Text>
            {t('message.confirm-create-draft-message')}
          </Typography.Text>
          {isCustomManaged && (
            <div>
              <label className="d-block text-xs font-medium text-grey-muted m-b-xs">
                <span className="text-red-500">* </span>
                {t('cde.version')}
              </label>
              <Input
                autoFocus
                data-testid="cde-draft-version-input"
                placeholder={
                  isGlossary ? 'Ví dụ: 2, 3...' : 'Ví dụ: 1.1, 2.0...'
                }
                value={draftVersion}
                disabled={isGlossary}
                status={draftVersionError ? 'error' : undefined}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraftVersion(value);
                  const canonical = isGlossary
                    ? /^[1-9]\d*$/.test(value.trim())
                    : /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.trim());
                  setDraftVersionError(
                    value.trim().length > 64 || !canonical
                      ? isGlossary
                        ? 'Phiên bản Từ điển phải là số nguyên dương, không có số 0 ở đầu.'
                        : 'Phiên bản phải có định dạng MAJOR.MINOR, không có số 0 ở đầu và tối đa 64 ký tự.'
                      : compareBusinessVersions(
                            value.trim(),
                            String(businessVersion ?? (isGlossary ? '0' : '0.0')),
                          ) <= 0
                        ? 'Phiên bản mới phải lớn hơn phiên bản Approved mới nhất.'
                        : '',
                  );
                }}
                onPressEnter={() => {
                  if (draftVersion?.trim() && !isCreatingDraft) {
                    handleCreateDraft();
                  }
                }}
              />
              {draftVersionError && (
                <Typography.Text type="danger">
                  {draftVersionError}
                </Typography.Text>
              )}
            </div>
          )}
          {hasWorkflowConflict && !isGlossary && (
            <Alert
              showIcon
              action={
                <Button
                  loading={isReloadingWorking}
                  size="small"
                  onClick={handleReloadWorking}>
                  Tải representation mới nhất
                </Button>
              }
              message="Đã có thay đổi đồng thời. Bản hiện tại vẫn được giữ nguyên."
              type="warning"
            />
          )}
        </div>
      </Modal>

      <ConfirmationModal
        bodyText={t('message.confirm-submit-for-review-message')}
        cancelText={t('label.cancel')}
        confirmText={t('label.submit-for-review')}
        header={t('message.confirm-submit-for-review-title')}
        isLoading={isSubmittingForReview}
        visible={isSubmitForReviewModalOpen}
        onCancel={() => setIsSubmitForReviewModalOpen(false)}
        onConfirm={handleSubmitForReview}
      />

      <ConfirmationModal
        bodyText={
          isGlossary
            ? t('message.confirm-approve-entity-message', {
                entity: t('label.glossary'),
              })
            : t('message.confirm-approve-glossary-term-message')
        }
        cancelText={t('label.cancel')}
        confirmText={t('label.approve')}
        header={
          isGlossary
            ? t('message.confirm-approve-entity-title', {
                entity: t('label.glossary'),
              })
            : t('message.confirm-approve-glossary-term-title')
        }
        isLoading={isApproving}
        visible={isApproveModalOpen}
        onCancel={() => setIsApproveModalOpen(false)}
        onConfirm={handleApproveTerm}
      />

      <ConfirmationModal
        bodyText={
          isGlossary
            ? t('message.confirm-reject-entity-message', {
                entity: t('label.glossary'),
              })
            : t('message.confirm-reject-glossary-term-message')
        }
        cancelText={t('label.cancel')}
        confirmText={t('label.reject')}
        header={
          isGlossary
            ? t('message.confirm-reject-entity-title', {
                entity: t('label.glossary'),
              })
            : t('message.confirm-reject-glossary-term-title')
        }
        isLoading={isRejecting}
        visible={isRejectModalOpen}
        onCancel={() => setIsRejectModalOpen(false)}
        onConfirm={handleRejectTerm}
      />
    </>
  );
};

export default GlossaryHeader;
