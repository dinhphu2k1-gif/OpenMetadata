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
import { Alert, Button, Progress } from 'antd';
import { useTranslation } from 'react-i18next';
import { TechnicalBootstrapJob } from '../../rest/technicalDictionaryAPI';

interface TechnicalBootstrapStatusProps {
  job?: TechnicalBootstrapJob;
  canManage: boolean;
  isBusy: boolean;
  onRetry: (job: TechnicalBootstrapJob) => void;
}

/** Operational state of the Column bootstrap; independent of the catalog status. */
const TechnicalBootstrapStatus = ({
  job,
  canManage,
  isBusy,
  onRetry,
}: TechnicalBootstrapStatusProps) => {
  const { t } = useTranslation();
  const isActive = job?.status === 'Running' || job?.status === 'Pending';
  const isFailed = job?.status === 'Failed';

  return (
    <>
      {job && isActive && (
        <Alert
          showIcon
          className="m-b-md"
          data-testid="technical-bootstrap-running"
          description={
            <Progress
              percent={
                job.total > 0
                  ? Math.floor((job.processed / job.total) * 100)
                  : 0
              }
              size="small"
            />
          }
          message={t('message.technical-dictionary-bootstrap-running', {
            processed: job.processed,
            total: job.total,
          })}
          type="info"
        />
      )}
      {job && isFailed && (
        <Alert
          showIcon
          action={
            canManage ? (
              <Button
                data-testid="technical-bootstrap-retry"
                loading={isBusy}
                size="small"
                onClick={() => onRetry(job)}>
                {t('label.retry')}
              </Button>
            ) : undefined
          }
          className="m-b-md"
          data-testid="technical-bootstrap-failed"
          description={job.errors?.[0]?.message}
          message={t('message.technical-dictionary-bootstrap-failed', {
            failed: job.failed,
          })}
          type="error"
        />
      )}
    </>
  );
};

export default TechnicalBootstrapStatus;
