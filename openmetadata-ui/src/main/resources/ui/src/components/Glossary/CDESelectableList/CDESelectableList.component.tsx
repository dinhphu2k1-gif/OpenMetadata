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
import { Space, Typography } from 'antd';
import { ReactNode, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { EntitySelectableList } from '../../common/EntitySelectableList/EntitySelectableList.component';
import { EntitySelectableListConfig } from '../../common/EntitySelectableList/EntitySelectableList.interface';
import { getSelectableCdes } from '../CDESelector/CDESelector.component';
import { DATA_DICTIONARY_GLOSSARY_NAME } from '../../../constants/Glossary.contant';
import { EntityStatus as TermStatus } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/entity/type';
import {
  getGlossariesByName,
  getGlossaryVersion,
  searchGlossaryTermsPaginated,
} from '../../../rest/glossaryAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';

interface CDESelectableListProps {
  /** Data Dictionary version the CDE is chosen from; an archived version offers its archived CDEs. */
  dataDictionaryVersion?: string;
  selectedCde?: EntityReference;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called with the chosen CDE, or with nothing when the current one is removed. */
  onSelect: (cde?: EntityReference) => Promise<void>;
  children: ReactNode;
}

const CDE_PAGE_SIZE = 50;

/** Search and pick a CDE (Column or DQ term reference), in the same list popover the owners and tags use. */
const CDESelectableList = ({
  dataDictionaryVersion,
  selectedCde,
  isOpen,
  onOpenChange,
  onSelect,
  children,
}: CDESelectableListProps) => {
  const { t } = useTranslation();
  const dictionaryId = useRef<string>();
  const isArchivedScope = useRef<Record<string, boolean>>({});

  const config: EntitySelectableListConfig<EntityReference> = useMemo(
    () => ({
      toEntityReference: (items) => items,
      fromEntityReference: (refs) => refs,
      fetchOptions: async (searchText) => {
        let data: EntityReference[] = [];
        try {
          if (!dictionaryId.current) {
            const dictionary = await getGlossariesByName(
              DATA_DICTIONARY_GLOSSARY_NAME
            );
            dictionaryId.current = dictionary.id;
          }
          if (
            dataDictionaryVersion &&
            isArchivedScope.current[dataDictionaryVersion] === undefined
          ) {
            const snapshot = await getGlossaryVersion(
              dictionaryId.current,
              dataDictionaryVersion
            );
            isArchivedScope.current[dataDictionaryVersion] = Boolean(
              snapshot.entityStatus === TermStatus.Archived ||
                snapshot.archivedAt
            );
          }
          const archived = Boolean(
            dataDictionaryVersion &&
              isArchivedScope.current[dataDictionaryVersion]
          );
          const response = await searchGlossaryTermsPaginated({
            glossary: dictionaryId.current,
            parentBusinessVersion: dataDictionaryVersion,
            statuses: archived ? TermStatus.Archived : TermStatus.Approved,
            q: searchText.trim() || undefined,
            limit: CDE_PAGE_SIZE,
          });
          data = getSelectableCdes(response.data ?? [], archived).map(
            (cde) => ({
              id: cde.id,
              name: cde.name,
              displayName: getEntityName(cde),
              fullyQualifiedName: cde.fullyQualifiedName,
              type: 'glossaryTerm',
            })
          );
        } catch {
          data = [];
        }

        return { data, paging: { total: data.length } };
      },
      customTagRenderer: (item) => (
        <Space size={6}>
          <Typography.Text strong className="cde-select-code">
            {item.name}
          </Typography.Text>
          <Typography.Text type="secondary">
            · {item.displayName}
          </Typography.Text>
        </Space>
      ),
      searchPlaceholder: t('label.search-for-type', {
        type: t('label.cde-code-ref'),
      }),
      searchBarDataTestId: 'cde-select-search-bar',
      overlayClassName: 'cde-select-popover',
    }),
    [dataDictionaryVersion, t]
  );

  return (
    <EntitySelectableList
      config={config}
      multiSelect={false}
      popoverProps={{
        open: isOpen,
        overlayClassName: 'cde-tag-select-popover cde-code-select-popover',
        placement: 'bottomLeft',
        onOpenChange,
      }}
      selectedItems={selectedCde ? [selectedCde] : []}
      onCancel={() => onOpenChange?.(false)}
      onUpdate={(items) => onSelect(items[0])}>
      {children}
    </EntitySelectableList>
  );
};

export default CDESelectableList;
