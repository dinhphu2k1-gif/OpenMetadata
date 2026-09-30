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
import { Button, Modal, Select, Tag } from 'antd';
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
  glossaryId: string;
  businessVersion: string;
  options: TechnicalDictionaryOptions;
  onClose: () => void;
  onDone: () => void;
}

const errorCodeOf = (error: unknown): string | undefined =>
  (error as AxiosError<{ code?: string }>)?.response?.data?.code;

/** Step 1 picks a physical Column, step 2 fills the initial values; Save declares it once. */
const TechnicalAddColumnModal = ({
  open,
  glossaryId,
  businessVersion,
  options,
  onClose,
  onDone,
}: TechnicalAddColumnModalProps) => {
  const { t } = useTranslation();
  const [candidates, setCandidates] = useState<TechnicalColumnCandidate[]>([]);
  const [selected, setSelected] = useState<TechnicalColumnCandidate>();
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormStep, setIsFormStep] = useState(false);

  const search = useCallback(
    async (text: string) => {
      setIsSearching(true);
      try {
        setCandidates(
          await searchTechnicalColumns(
            glossaryId,
            businessVersion,
            text,
            COLUMN_PAGE_SIZE
          )
        );
      } catch (error) {
        setCandidates([]);
        showErrorToast(error as AxiosError);
      } finally {
        setIsSearching(false);
      }
    },
    [businessVersion, glossaryId]
  );

  const debouncedSearch = useMemo(
    () => debounce(search, TECHNICAL_SEARCH_DEBOUNCE_MS),
    [search]
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  useEffect(() => {
    if (open) {
      setSelected(undefined);
      setIsFormStep(false);
      search('');
    }
  }, [open, search]);

  const shownCandidates = useMemo(
    () =>
      selected && !candidates.some((item) => item.columnKey === selected.columnKey)
        ? [selected, ...candidates]
        : candidates,
    [candidates, selected]
  );

  const handleSave = async (values: TechnicalRecordFormValues) => {
    if (!selected) {
      return;
    }
    setIsSaving(true);
    try {
      await declareTechnicalColumn(glossaryId, businessVersion, {
        columnFqn: selected.columnFqn,
        cde: values.cde?.id,
        rank: values.rank ?? undefined,
        elementType: values.elementType,
        generationType: values.generationType,
        creationMethod: values.creationMethod,
        timeliness: values.timeliness,
        systemOwnerId: values.systemOwnerId,
      });
      showSuccessToast(t('message.technical-column-declared'));
      onDone();
      onClose();
    } catch (error) {
      if (errorCodeOf(error) === TECHNICAL_COLUMN_ALREADY_DECLARED) {
        showErrorToast(t('message.technical-column-already-declared'));
        setIsFormStep(false);
        search('');
      } else {
        showErrorToast(error as AxiosError);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isFormStep && selected) {
    return (
      <TechnicalRecordModal
        isSaving={isSaving}
        mode="create"
        open={open}
        options={options}
        row={candidateToRow(selected, businessVersion)}
        onCancel={onClose}
        onSave={handleSave}
      />
    );
  }

  return (
    <Modal
      destroyOnClose
      centered
      cancelText={t('label.cancel')}
      data-testid="technical-add-column-modal"
      footer={
        <>
          <Button onClick={onClose}>{t('label.cancel')}</Button>
          <Button
            data-testid="technical-add-column-next"
            disabled={!selected}
            type="primary"
            onClick={() => setIsFormStep(true)}>
            {t('label.next')}
          </Button>
        </>
      }
      open={open}
      title={t('label.add-column')}
      width={640}
      onCancel={onClose}>
      <p>{t('message.technical-add-column-description')}</p>
      <Select
        showSearch
        className="w-full"
        data-testid="technical-add-column-select"
        filterOption={false}
        loading={isSearching}
        placeholder={t('label.select-column')}
        value={selected?.columnKey}
        onChange={(key: string) =>
          setSelected(shownCandidates.find((item) => item.columnKey === key))
        }
        onSearch={debouncedSearch}>
        {shownCandidates.map((item) => (
          <Select.Option
            disabled={item.declared}
            key={item.columnKey}
            style={item.declared ? { opacity: 0.5 } : undefined}
            value={item.columnKey}>
            <span>{item.columnFqn}</span>{' '}
            {item.declared && <Tag>{t('label.declared')}</Tag>}
          </Select.Option>
        ))}
      </Select>
    </Modal>
  );
};

export default TechnicalAddColumnModal;
