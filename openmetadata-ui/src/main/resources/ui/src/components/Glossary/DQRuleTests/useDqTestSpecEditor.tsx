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

import { Modal } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DATA_DICTIONARY_GLOSSARY_NAME } from '../../../constants/Glossary.contant';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import {
  DqTestSpec,
  DqTestSpecKind,
} from '../../../generated/type/dqTestSpecs';
import { DQ_SQL_METHOD_TAG_SUFFIX } from './DQRuleTests.constants';
import DQTestSpecModal from './DQTestSpecModal.component';

interface UseDqTestSpecEditorProps {
  glossaryTerm: GlossaryTerm;
  onUpdate: (glossaryTerm: GlossaryTerm) => Promise<void>;
}

/** Add, edit and remove the test declarations of a Rule's working copy, one at a time. */
export const useDqTestSpecEditor = ({
  glossaryTerm,
  onUpdate,
}: UseDqTestSpecEditorProps) => {
  const { t } = useTranslation();
  // undefined: closed; null: adding; a number: editing that declaration.
  const [editingIndex, setEditingIndex] = useState<number | null>();
  const specs = glossaryTerm.dataQualityTestSpecs?.items ?? [];

  const saveSpecs = (items: DqTestSpec[]) =>
    onUpdate({
      ...glossaryTerm,
      dataQualityTestSpecs: { schemaVersion: 1, items },
    });

  // A minor version keeps the tests already applied, so their check cannot change.
  const minorVersion = Number(
    (glossaryTerm.businessVersion ?? '').split('.')[1]
  );
  const editingSpec =
    editingIndex === null || editingIndex === undefined
      ? undefined
      : specs[editingIndex];
  const isDefinitionLocked = Boolean(minorVersion > 0 && editingSpec?.key);

  const defaultKind = (glossaryTerm.tags ?? []).some((tag) =>
    tag.tagFQN.endsWith(DQ_SQL_METHOD_TAG_SUFFIX)
  )
    ? DqTestSpecKind.SQL
    : DqTestSpecKind.Library;

  const cdeTermId = glossaryTerm.relatedTerms?.find((relation) =>
    relation.term?.fullyQualifiedName?.includes(DATA_DICTIONARY_GLOSSARY_NAME)
  )?.term?.id;

  const openAdd = () => setEditingIndex(null);

  const openEdit = (index: number) => setEditingIndex(index);

  const remove = (index: number) =>
    Modal.confirm({
      title: t('dq.test.remove-confirm', { name: specs[index]?.name }),
      okButtonProps: { danger: true },
      okText: t('dq.test.remove'),
      cancelText: t('label.cancel'),
      onOk: () => saveSpecs(specs.filter((_, at) => at !== index)),
    });

  const handleSave = async (spec: DqTestSpec) => {
    await saveSpecs(
      editingSpec
        ? specs.map((item, at) => (at === editingIndex ? spec : item))
        : [...specs, spec]
    );
    setEditingIndex(undefined);
  };

  const modal =
    editingIndex === undefined ? null : (
      <DQTestSpecModal
        open
        cdeTermId={cdeTermId}
        defaultKind={defaultKind}
        isDefinitionLocked={isDefinitionLocked}
        otherNames={specs
          .filter((item) => item !== editingSpec)
          .map((item) => item.name)}
        ruleThreshold={glossaryTerm.extension?.qualityThreshold}
        spec={editingSpec}
        onCancel={() => setEditingIndex(undefined)}
        onSave={handleSave}
      />
    );

  return { openAdd, openEdit, remove, modal };
};
