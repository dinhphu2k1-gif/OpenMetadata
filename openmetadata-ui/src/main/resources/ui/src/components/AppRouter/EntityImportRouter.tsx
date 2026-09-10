/*
 *  Copyright 2025 Collate.
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { SUPPORTED_BULK_IMPORT_EDIT_ENTITY } from '../../constants/BulkImport.constant';
import { ROUTES } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { useFqn } from '../../hooks/useFqn';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { isDataDictionaryGlossary, isDataQualityGlossary } from '../../constants/Glossary.contant';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import withSuspenseFallback from './withSuspenseFallback';

const BulkEntityImportPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/EntityImport/BulkEntityImportPage/BulkEntityImportPage'
      )
  )
);

const CDEImportPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/CDEImportPage/CDEImportPage'))
);

const DQImportPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/DQImportPage/DQImportPage'))
);

const EntityImportRouter = () => {
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { entityType } = useRequiredParams<{ entityType: ResourceEntity }>();
  const { getEntityPermissionByFqn, permissions } = usePermissionProvider();
  const { currentUser, selectedPersona } = useApplicationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [entityPermission, setEntityPermission] = useState(
    DEFAULT_ENTITY_PERMISSION
  );

  const isSteward = useMemo(() => {
    const userRoles =
      currentUser?.roles?.map((r) => r.name?.toLowerCase() ?? '') ?? [];
    const personaName = (
      selectedPersona?.name ||
      selectedPersona?.fullyQualifiedName?.split('.').at(-1) ||
      ''
    ).toLowerCase();

    return (
      (userRoles.some((r) => r.includes('steward')) ||
        personaName.includes('steward')) &&
      !currentUser?.isAdmin
    );
  }, [currentUser, selectedPersona]);

  const isProposer = useMemo(() => {
    if (currentUser?.isAdmin) {
      return false;
    }
    const userRoles =
      currentUser?.roles?.map((r) => r.name?.toLowerCase() ?? '') ?? [];
    const personaName = (
      selectedPersona?.name ||
      selectedPersona?.fullyQualifiedName?.split('.').at(-1) ||
      ''
    ).toLowerCase();

    return (
      !isSteward &&
      (userRoles.some((r) => r.includes('proposer')) ||
        personaName.includes('proposer'))
    );
  }, [currentUser, selectedPersona, isSteward]);

  const fetchResourcePermission = useCallback(async () => {
    if (!entityType) {
      return;
    }
    setIsLoading(true);

    if (entityType === ResourceEntity.TEST_CASE) {
      const { testCase } = permissions;
      setEntityPermission(testCase ?? DEFAULT_ENTITY_PERMISSION);
      setIsLoading(false);

      return;
    }

    try {
      const entityPermission = await getEntityPermissionByFqn(entityType, fqn);
      setEntityPermission(entityPermission);
    } catch {
      setEntityPermission(DEFAULT_ENTITY_PERMISSION);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, fqn, permissions, getEntityPermissionByFqn]);

  useEffect(() => {
    if (fqn && SUPPORTED_BULK_IMPORT_EDIT_ENTITY.includes(entityType)) {
      fetchResourcePermission();
    } else {
      navigate(ROUTES.NOT_FOUND);
    }
  }, [fqn, entityType, fetchResourcePermission]);

  const isCDE = useMemo(() => {
    return (
      entityType === ResourceEntity.GLOSSARY && isDataDictionaryGlossary(fqn)
    );
  }, [entityType, fqn]);

  const isDQ = useMemo(() => {
    return (
      entityType === ResourceEntity.GLOSSARY && isDataQualityGlossary(fqn)
    );
  }, [entityType, fqn]);

  const canImport = useMemo(() => {
    if (isCDE || isDQ) {
      return (
        Boolean(currentUser?.isAdmin) ||
        isProposer ||
        Boolean(entityPermission.EditAll)
      );
    }

    return Boolean(entityPermission.EditAll);
  }, [isCDE, isDQ, currentUser?.isAdmin, isProposer, entityPermission.EditAll]);

  if (isLoading) {
    return null;
  }

  return (
    <Routes>
      {canImport && (
        <Route
          element={
            isDQ ? (
              <DQImportPage />
            ) : isCDE ? (
              <CDEImportPage />
            ) : (
              <BulkEntityImportPage />
            )
          }
          path="*"
        />
      )}
      <Route element={<Navigate to={ROUTES.NOT_FOUND} />} path="*" />
    </Routes>
  );
};

export default EntityImportRouter;
