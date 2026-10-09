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
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import { ClientErrors } from '../enums/Axios.enum';
import { EntityType } from '../enums/entity.enum';
import { Page, PageType } from '../generated/system/ui/page';
import { NavigationItem } from '../generated/system/ui/uiCustomization';
import { getDocumentByFQN } from '../rest/DocStoreAPI';
import { useApplicationStore } from './useApplicationStore';

export const useCustomPages = (pageType: PageType | 'Navigation') => {
  const { selectedPersona } = useApplicationStore();
  const selectedPersonaFqn = selectedPersona?.fullyQualifiedName;
  const [customizedPage, setCustomizedPage] = useState<Page | null>(null);
  const [navigation, setNavigation] = useState<NavigationItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // null = nothing resolved yet; undefined = resolved for "no persona".
  const [navigationPersonaFqn, setNavigationPersonaFqn] = useState<
    string | undefined | null
  >(null);

  const fetchDocument = useCallback(
    async (personaFqn: string, isStale: () => boolean) => {
      const pageFQN = `${EntityType.PERSONA}${FQN_SEPARATOR_CHAR}${personaFqn}`;
      try {
        const doc = await getDocumentByFQN(pageFQN);
        if (isStale()) {
          return;
        }
        setCustomizedPage(
          doc.data?.pages?.find((p: Page | null) => p?.pageType === pageType)
        );
        setNavigation(doc.data?.navigation);
        setNavigationPersonaFqn(personaFqn);
      } catch (error) {
        if (isStale()) {
          return;
        }
        // Need to reset Navigation to avoid showing old navigation items
        setNavigation([]);
        setCustomizedPage(null);
        // Only a missing document means "persona has no customization". A
        // transient failure must stay unresolved, otherwise the sidebar falls
        // back to every tab instead of the persona's navigation.
        if (
          (error as AxiosError)?.response?.status === ClientErrors.NOT_FOUND
        ) {
          setNavigationPersonaFqn(personaFqn);
        }
      } finally {
        if (!isStale()) {
          setIsLoading(false);
        }
      }
    },
    [pageType]
  );

  useEffect(() => {
    let isStale = false;
    if (selectedPersonaFqn) {
      fetchDocument(selectedPersonaFqn, () => isStale);
    } else {
      setNavigationPersonaFqn(undefined);
      setIsLoading(false);
    }

    return () => {
      isStale = true;
    };
  }, [selectedPersona, pageType]);

  return {
    customizedPage,
    navigation,
    isLoading,
    isNavigationResolved: navigationPersonaFqn === selectedPersonaFqn,
  };
};
