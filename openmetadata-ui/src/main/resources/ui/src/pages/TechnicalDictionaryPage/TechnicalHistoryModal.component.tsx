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
import { Button } from '@openmetadata/ui-core-components';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import TechnicalHistoryPanel from './TechnicalHistoryPanel.component';

interface TechnicalHistoryModalProps {
  open: boolean;
  /** Record whose history is shown. */
  termId?: string;
  title?: string;
  onClose: () => void;
}

/** The change history of a record in a dialog. */
const TechnicalHistoryModal = ({
  open,
  termId,
  title,
  onClose,
}: TechnicalHistoryModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      centered
      destroyOnClose
      data-testid="technical-history-modal"
      footer={
        <Button color="secondary" onPress={onClose}>
          {t('label.close')}
        </Button>
      }
      open={open}
      title={
        <>
          {t('label.technical-history')}
          {title && <div className="text-grey-muted text-xs">{title}</div>}
        </>
      }
      width={900}
      onCancel={onClose}>
      <TechnicalHistoryPanel active={open} termId={termId} />
    </Modal>
  );
};

export default TechnicalHistoryModal;
