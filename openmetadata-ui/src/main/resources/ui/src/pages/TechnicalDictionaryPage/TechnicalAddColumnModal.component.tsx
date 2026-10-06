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
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TECHNICAL_SEARCH_DEBOUNCE_MS } from '../../constants/TechnicalDictionary.constants';
import { TechnicalDictionaryOptions } from '../../hooks/useTechnicalDictionaryOptions';
import {
  declareTechnicalColumn,
  searchTechnicalColumns,
  TechnicalColumnCandidate,
} from '../../rest/technicalDictionaryAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import { candidateToRow } from './TechnicalDictionaryRows';
import TechnicalRecordModal, {
  TechnicalRecordFormValues,
} from './TechnicalRecordModal.component';

export const TECHNICAL_COLUMN_ALREADY_DECLARED = 'TD_COLUMN_ALREADY_DECLARED';
const COLUMN_PAGE_SIZE = 20;

interface TechnicalAddColumnModalProps {
  open: boolean;
  dataDictionaryVersion: string;
  options: TechnicalDictionaryOptions;
  onClose: () => void;
  onDone: () => void;
}

const errorCodeOf = (error: unknown): string | undefined =>
  (error as AxiosError<{ code?: string }>)?.response?.data?.code;

/** One form: pick a physical Column, which fills its identity fields, then fill the values; Save declares it once. */
const TechnicalAddColumnModal = ({
  open,
  dataDictionaryVersion,
  options,
  onClose,
  onDone,
}: TechnicalAddColumnModalProps) => {
  const { t } = useTranslation();
  const [candidates, setCandidates] = useState<TechnicalColumnCandidate[]>([]);
  const [selected, setSelected] = useState<TechnicalColumnCandidate>();
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const search = useCallback(async (text: string) => {
    setIsSearching(true);
    try {
      setCandidates(await searchTechnicalColumns(text, COLUMN_PAGE_SIZE));
    } catch (error) {
      setCandidates([]);
      showErrorToast(error as AxiosError);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debouncedSearch = useMemo(
    () => debounce(search, TECHNICAL_SEARCH_DEBOUNCE_MS),
    [search]
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  useEffect(() => {
    if (open) {
      setSelected(undefined);
      search('');
    }
  }, [open, search]);

  const shownCandidates = useMemo(
    () =>
      selected &&
      !candidates.some((item) => item.columnKey === selected.columnKey)
        ? [selected, ...candidates]
        : candidates,
    [candidates, selected]
  );

  // Memoized so the modal's form only resets when another Column is picked.
  const row = useMemo(
    () => (selected ? candidateToRow(selected) : undefined),
    [selected]
  );

  const handleSave = async (values: TechnicalRecordFormValues) => {
    if (!selected) {
      return;
    }
    setIsSaving(true);
    try {
      await declareTechnicalColumn({
        columnFqn: selected.columnFqn,
        cde: values.cde?.id,
        rank: values.rank ?? undefined,
        elementType: values.elementType,
        generationType: values.generationType,
        creationMethod: values.creationMethod,
        timeliness: values.timeliness,
        systemOwners: values.systemOwners,
      });
      showSuccessToast(t('message.technical-column-declared'));
      onDone();
      onClose();
    } catch (error) {
      if (errorCodeOf(error) === TECHNICAL_COLUMN_ALREADY_DECLARED) {
        showErrorToast(t('message.technical-column-already-declared'));
        setSelected(undefined);
        search('');
      } else {
        showErrorToast(error as AxiosError);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TechnicalRecordModal
      columnPicker={{
        candidates: shownCandidates,
        isSearching,
        selectedKey: selected?.columnKey,
        onSearch: debouncedSearch,
        onSelect: setSelected,
      }}
      dataDictionaryVersion={dataDictionaryVersion}
      isSaving={isSaving}
      mode="create"
      open={open}
      options={options}
      row={row}
      onCancel={onClose}
      onSave={handleSave}
    />
  );
};

export default TechnicalAddColumnModal;
