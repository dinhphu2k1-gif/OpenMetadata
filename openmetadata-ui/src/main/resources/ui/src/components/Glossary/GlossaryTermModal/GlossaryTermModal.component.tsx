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
import { Button, Modal } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { getGlossaryTermByFQN } from '../../../rest/glossaryAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { EntityAttachmentProvider } from '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import Loader from '../../common/Loader/Loader';
import AddGlossaryTermForm from '../AddGlossaryTermForm/AddGlossaryTermForm.component';
import CDEGlossaryTermForm from '../AddGlossaryTermForm/CDEGlossaryTermForm.component';
import DQGlossaryTermForm from '../AddGlossaryTermForm/DQGlossaryTermForm.component';
import { GlossaryTermForm } from '../AddGlossaryTermForm/AddGlossaryTermForm.interface';

interface Props {
  glossaryTermFQN?: string;
  onSave: (value: GlossaryTermForm) => void | Promise<void>;
  onCancel: () => void;
  visible: boolean;
  editMode: boolean;
  isCDEGlossary?: boolean;
  isDQGlossary?: boolean;
}

const GlossaryTermModal: FC<Props> = ({
  editMode,
  visible,
  glossaryTermFQN,
  onSave,
  onCancel,
  isCDEGlossary = false,
  isDQGlossary = false,
}) => {
  const { t } = useTranslation();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [glossaryTerm, setGlossaryTerm] = useState<GlossaryTerm>();

  const isCustomModal = isCDEGlossary || isDQGlossary;

  const dialogTitle = useMemo(() => {
    if (isDQGlossary) {
      return (
        <div className="cde-glossary-modal-title">
          <div>
            {editMode
              ? t('label.edit-entity', { entity: t('dq.rule', 'Quy tắc CLDL') })
              : t('label.add-entity', {
                  entity: t('dq.rule', 'Quy tắc CLDL'),
                })}
          </div>
          <div className="cde-glossary-modal-subtitle">
            {t('dq.data-quality', 'Chất lượng dữ liệu')}
          </div>
        </div>
      );
    }

    if (isCDEGlossary) {
      return (
        <div className="cde-glossary-modal-title">
          <div>
            {editMode
              ? t('label.edit-entity', { entity: 'CDE' })
              : t('label.add-entity', {
                  entity: t('label.term'),
                })}
          </div>
          <div className="cde-glossary-modal-subtitle">
            {t('cde.data-dictionary')}
          </div>
        </div>
      );
    }

    return editMode
      ? t('label.edit-entity', { entity: t('label.glossary-term') })
      : t('label.add-entity', { entity: t('label.glossary-term') });
  }, [editMode, isCDEGlossary, isDQGlossary, t]);

  const fetchCurrentEntity = useCallback(async () => {
    try {
      const fields = isCustomModal
        ? [
            TabSpecificField.OWNERS,
            TabSpecificField.REVIEWERS,
            TabSpecificField.TAGS,
            TabSpecificField.RELATED_TERMS,
            TabSpecificField.DOMAINS,
            TabSpecificField.EXTENSION,
          ]
        : [
            TabSpecificField.OWNERS,
            TabSpecificField.REVIEWERS,
            TabSpecificField.TAGS,
            TabSpecificField.RELATED_TERMS,
          ];
      const data = await getGlossaryTermByFQN(glossaryTermFQN, {
        fields,
      });
      setGlossaryTerm(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [glossaryTermFQN, isCustomModal]);

  const handleSave = async (values: GlossaryTermForm) => {
    setSaving(true);
    try {
      await onSave(values);
    } catch (error) {
      if ((error as AxiosError)?.response?.status === 400) {
        const errorMessage =
          (error as AxiosError<{ message: string }>)?.response?.data?.message ??
          '';

        // Handle name duplication error
        if (errorMessage.includes('already exists')) {
          form.setFields([
            {
              name: 'name',
              errors: [errorMessage],
            },
          ]);
        }
        // Handle tag mutual exclusivity error
        else if (errorMessage.includes('mutually exclusive')) {
          form.setFields([
            {
              name: 'tags',
              errors: [errorMessage],
            },
          ]);
        }
      }

      throw error;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (editMode) {
      fetchCurrentEntity();
    } else {
      setIsLoading(false);
    }
    if (!visible) {
      form.resetFields();
    }
  }, [visible]);

  return (
    <Modal
      centered
      destroyOnClose
      cancelText={t('label.cancel')}
      className={`edit-glossary-modal ${
        isCustomModal ? 'cde-glossary-term-modal' : ''
      } ${
        isCustomModal && !editMode ? 'cde-glossary-term-modal--add' : ''
      }`}
      closable={isCustomModal}
      data-testid="edit-glossary-modal"
      footer={[
        <Button
          key="cancel-btn"
          type={isCustomModal ? 'default' : 'link'}
          onClick={onCancel}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="save-glossary-term"
          key="save-btn"
          loading={saving}
          type="primary"
          onClick={form.submit}>
          {isCustomModal && !editMode
            ? t('label.create-entity', {
                entity: isDQGlossary
                  ? t('dq.rule', 'Quy tắc')
                  : t('label.term'),
              })
            : t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      okText={t('label.save')}
      open={visible}
      title={dialogTitle}
      width={isDQGlossary && !editMode ? 1240 : isCustomModal ? 1000 : 800}
      onCancel={onCancel}>
      <EntityAttachmentProvider
        entityFqn={glossaryTermFQN}
        entityType={EntityType.GLOSSARY_TERM}>
        {isLoading ? (
          <Loader />
        ) : isCDEGlossary ? (
          <CDEGlossaryTermForm
            editMode={editMode}
            formRef={form}
            glossaryTerm={glossaryTerm}
            onCancel={onCancel}
            onSave={handleSave}
          />
        ) : isDQGlossary ? (
          <DQGlossaryTermForm
            editMode={editMode}
            formRef={form}
            glossaryTerm={glossaryTerm}
            onCancel={onCancel}
            onSave={handleSave}
          />
        ) : (
          <AddGlossaryTermForm
            editMode={editMode}
            formRef={form}
            glossaryTerm={glossaryTerm}
            onCancel={onCancel}
            onSave={handleSave}
          />
        )}
      </EntityAttachmentProvider>
    </Modal>
  );
};

export default GlossaryTermModal;
