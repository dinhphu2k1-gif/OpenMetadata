/*
 *  Copyright 2024 Collate.
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
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '../../../constants/constants';
import { isDataDictionaryGlossary } from '../../../constants/Glossary.contant';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { useFqn } from '../../../hooks/useFqn';
import GlossaryPage from '../../../pages/Glossary/GlossaryPage/GlossaryPage.component';
import { userPermissions } from '../../../utils/PermissionsUtils';
import AdminProtectedRoute from '../AdminProtectedRoute';

const DataDictionaryRoute = ({ children }: { children: ReactNode }) => {
  const { fqn } = useFqn();

  return isDataDictionaryGlossary(fqn) ? (
    children
  ) : (
    <Navigate replace to={ROUTES.DATA_DICTIONARY} />
  );
};

const GlossaryRouter = () => {
  const { permissions } = usePermissionProvider();
  const { t } = useTranslation();
  const glossaryPermission = useMemo(
    () =>
      userPermissions.hasViewPermissions(ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  return (
    <Routes>
      <Route
        element={<Navigate replace to={ROUTES.DATA_DICTIONARY} />}
        path="/"
      />
      <Route
        element={
          <DataDictionaryRoute>
            <AdminProtectedRoute hasPermission={glossaryPermission}>
              <GlossaryPage pageTitle={t('label.glossary')} />
            </AdminProtectedRoute>
          </DataDictionaryRoute>
        }
        path={ROUTES.GLOSSARY_DETAILS.replace(ROUTES.GLOSSARY, '')}
      />
      <Route
        element={
          <DataDictionaryRoute>
            <AdminProtectedRoute hasPermission={glossaryPermission}>
              <GlossaryPage pageTitle={t('label.glossary')} />
            </AdminProtectedRoute>
          </DataDictionaryRoute>
        }
        path={ROUTES.GLOSSARY_DETAILS_WITH_ACTION.replace(ROUTES.GLOSSARY, '')}
      />
      <Route
        element={
          <DataDictionaryRoute>
            <AdminProtectedRoute hasPermission={glossaryPermission}>
              <GlossaryPage pageTitle={t('label.glossary')} />
            </AdminProtectedRoute>
          </DataDictionaryRoute>
        }
        path={ROUTES.GLOSSARY_DETAILS_WITH_TAB.replace(ROUTES.GLOSSARY, '')}
      />
      <Route
        element={
          <DataDictionaryRoute>
            <AdminProtectedRoute hasPermission={glossaryPermission}>
              <GlossaryPage pageTitle={t('label.glossary')} />
            </AdminProtectedRoute>
          </DataDictionaryRoute>
        }
        path={ROUTES.GLOSSARY_DETAILS_WITH_SUBTAB.replace(ROUTES.GLOSSARY, '')}
      />
      <Route
        element={<Navigate replace to={ROUTES.DATA_DICTIONARY} />}
        path="*"
      />
    </Routes>
  );
};

export default GlossaryRouter;
