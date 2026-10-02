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
import { useMemo } from 'react';
import { useApplicationsProvider } from '../components/Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { filterHiddenNavigationItems } from '../utils/CustomizaNavigation/CustomizeNavigation';
import {
  hideBasicConsumerMarketplaceOverview,
  isBasicConsumerPersona,
} from '../utils/Persona/BasicConsumerNavigation';
import leftSidebarClassBase from '../utils/LeftSidebarClassBase';
import { IS_PORTAL_MODE } from '../utils/PortalMode';
import { useApplicationStore } from './useApplicationStore';
import { useCustomPages } from './useCustomPages';

const useAdministrationSidebarItems = () => {
  const { navigation } = useCustomPages('Navigation');
  const { plugins = [] } = useApplicationsProvider();
  const { selectedPersona } = useApplicationStore();

  const sideBarItems = useMemo(() => {
    const items = filterHiddenNavigationItems(navigation, plugins);

    return isBasicConsumerPersona(selectedPersona)
      ? hideBasicConsumerMarketplaceOverview(items)
      : items;
  }, [navigation, plugins, selectedPersona]);

  return sideBarItems;
};

// The Portal has a fixed menu and reads no navigation preferences, so it skips the persona lookups.
const usePortalSidebarItems = () => leftSidebarClassBase.getSidebarItems();

export const useSidebarItems = IS_PORTAL_MODE
  ? usePortalSidebarItems
  : useAdministrationSidebarItems;
