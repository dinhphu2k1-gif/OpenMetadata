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
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { Button } from '@openmetadata/ui-core-components';
import { Empty, Modal, Spin, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  exportTechnicalSnapshot,
  listTechnicalSnapshots,
  TechnicalSnapshotSummary,
} from '../../rest/technicalDictionaryAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../utils/ToastUtils';

interface TechnicalSnapshotsModalProps {
  open: boolean;
  onClose: () => void;
  onView: (version: string) => void;
}

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

/** Frozen CDE bindings of the Data Dictionary versions that were replaced; downloadable. */
const TechnicalSnapshotsModal = ({
  open,
  onClose,
  onView,
}: TechnicalSnapshotsModalProps) => {
  const { t } = useTranslation();
  const [snapshots, setSnapshots] = useState<TechnicalSnapshotSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloading, setDownloading] = useState<string>();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let active = true;
    setIsLoading(true);
    listTechnicalSnapshots()
      .then((loaded) => active && setSnapshots(loaded))
      .catch((error) => {
        active && setSnapshots([]);
        showErrorToast(error as AxiosError);
      })
      .finally(() => active && setIsLoading(false));

    return () => {
      active = false;
    };
  }, [open]);

  const handleDownload = async (version: string) => {
    setDownloading(version);
    try {
      const file = await exportTechnicalSnapshot(version);
      saveBlob(file.blob, file.fileName);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setDownloading(undefined);
    }
  };

  const columns: ColumnsType<TechnicalSnapshotSummary> = [
    {
      title: t('label.version'),
      dataIndex: 'dataDictionaryVersion',
      width: 120,
      render: (version: string) => `v${version}`,
    },
    {
      title: t('label.technical-frozen-at'),
      dataIndex: 'frozenAt',
      render: (frozenAt: number) => formatDateTime(frozenAt),
    },
    {
      title: t('label.technical-mapped-columns'),
      dataIndex: 'bindings',
      width: 160,
    },
    {
      title: t('label.action-plural'),
      key: 'actions',
      width: 220,
      render: (_, snapshot) => (
        <div className="d-flex gap-2">
          <Button
            color="secondary"
            data-testid={`technical-snapshot-view-${snapshot.dataDictionaryVersion}`}
            iconLeading={<EyeOutlined />}
            size="sm"
            onPress={() => onView(snapshot.dataDictionaryVersion)}>
            {t('label.view')}
          </Button>
          <Button
            color="secondary"
            data-testid={`technical-snapshot-download-${snapshot.dataDictionaryVersion}`}
            iconLeading={<DownloadOutlined />}
            isLoading={downloading === snapshot.dataDictionaryVersion}
            size="sm"
            onPress={() => handleDownload(snapshot.dataDictionaryVersion)}>
            {t('label.download')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Modal
      centered
      destroyOnClose
      data-testid="technical-snapshots-modal"
      footer={
        <Button color="secondary" onPress={onClose}>
          {t('label.close')}
        </Button>
      }
      open={open}
      title={t('label.technical-previous-snapshots')}
      width={720}
      onCancel={onClose}>
      <Spin spinning={isLoading}>
        {snapshots.length === 0 && !isLoading ? (
          <Empty
            description={t('message.technical-snapshots-empty')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={snapshots}
            pagination={false}
            rowKey="dataDictionaryVersion"
            size="small"
          />
        )}
      </Spin>
    </Modal>
  );
};

export default TechnicalSnapshotsModal;
