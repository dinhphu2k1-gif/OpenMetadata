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

import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isArray, isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CSMode } from '../../../enums/codemirror.enum';
import {
  EntityType,
  TestDataType,
  TestDefinition,
  TestPlatform,
} from '../../../generated/tests/testDefinition';
import {
  DqTestSpec,
  DqTestSpecKind,
  TestCaseParameterValue,
} from '../../../generated/type/dqTestSpecs';
import {
  listDqLibraryTestDefinitions,
  previewDqRuleTests,
} from '../../../rest/dqRuleTestAPI';
import { getListTestDefinitions } from '../../../rest/testAPI';
import { createTestCaseParameters } from '../../../utils/DataQuality/DataQualityUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { filterSelectOptions } from '../../../utils/FilterQueryUtils';
import { getPopupContainer } from '../../../utils/formUtils';
import { isValidJSONString } from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ParameterForm from '../../DataQuality/AddDataQualityTest/components/ParameterForm';
import '../../DataQuality/AddDataQualityTest/components/TestCaseFormV1.less';
import './dq-test-spec-modal.less';
import CodeEditor from '../../Database/SchemaEditor/CodeEditor';
import {
  DQ_DEFAULT_TIMEZONE,
  DQ_TEST_DEFINITION_LIMIT,
} from './DQRuleTests.constants';
import { DQPreview } from './DQRuleTests.interface';
import { localizeDqDefinition } from './DQRuleTests.utils';
import DQScheduleField, { DQScheduleValue } from './DQScheduleField.component';

type FormParams = Record<string, string | { [key: string]: string }[]>;

interface DQTestSpecFormValues {
  name: string;
  kind: DqTestSpecKind;
  testDefinitionFqn?: string;
  params?: FormParams;
  sqlExpression?: string;
  computePassedFailedRowCount?: boolean;
  threshold?: string;
  schedule?: DQScheduleValue;
}

export interface DQTestSpecModalProps {
  open: boolean;
  /** The declaration being edited; absent when adding one. */
  spec?: DqTestSpec;
  defaultKind: DqTestSpecKind;
  /** Names of the other declarations of the Rule, which must stay unique. */
  otherNames: string[];
  isDefinitionLocked?: boolean;
  ruleThreshold?: string;
  cdeTermId?: string;
  onCancel: () => void;
  onSave: (spec: DqTestSpec) => Promise<void>;
}

/** The inverse of createTestCaseParameters: stored values back into ParameterForm values. */
const toFormParams = (
  values: TestCaseParameterValue[] = [],
  definition?: TestDefinition
) =>
  values.reduce<Record<string, unknown>>((params, entry) => {
    const parameter = definition?.parameterDefinition?.find(
      (item) => item.name === entry.name
    );
    let value: unknown = entry.value;
    if (
      parameter?.dataType === TestDataType.Array &&
      isValidJSONString(entry.value)
    ) {
      const parsed = JSON.parse(entry.value ?? '[]');
      value = isArray(parsed)
        ? parsed.map((item) => ({ value: item }))
        : parsed;
    } else if (parameter?.dataType === TestDataType.Boolean) {
      value = entry.value === 'true';
    }

    return { ...params, [entry.name ?? '']: value };
  }, {});

const DQTestSpecModal = ({
  open,
  spec,
  defaultKind,
  otherNames,
  isDefinitionLocked = false,
  ruleThreshold,
  cdeTermId,
  onCancel,
  onSave,
}: DQTestSpecModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<DQTestSpecFormValues>();
  const kind = Form.useWatch('kind', form);
  const testDefinitionFqn = Form.useWatch('testDefinitionFqn', form);
  const [definitions, setDefinitions] = useState<TestDefinition[]>([]);
  const [isDefinitionLoading, setIsDefinitionLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState<DQPreview>();
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    const loadDefinitions = async () => {
      try {
        const [library, { data }] = await Promise.all([
          listDqLibraryTestDefinitions(),
          getListTestDefinitions({
            limit: DQ_TEST_DEFINITION_LIMIT,
            entityType: EntityType.Column,
            testPlatform: TestPlatform.OpenMetadata,
          }),
        ]);
        const allowed = new Set(library.map((entry) => entry.fqn));
        setDefinitions(
          data
            .filter((definition) =>
              allowed.has(definition.fullyQualifiedName ?? '')
            )
            .map((definition) => localizeDqDefinition(t, definition))
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsDefinitionLoading(false);
      }
    };
    loadDefinitions();
  }, []);

  const definitionOf = (fqn?: string) =>
    definitions.find((definition) => definition.fullyQualifiedName === fqn);
  const selectedDefinition = definitionOf(testDefinitionFqn);

  useEffect(() => {
    if (isDefinitionLoading) {
      return;
    }
    form.setFieldsValue({
      name: spec?.name ?? '',
      kind: spec?.kind ?? defaultKind,
      testDefinitionFqn: spec?.testDefinitionFqn,
      params: toFormParams(
        spec?.parameterValues,
        definitionOf(spec?.testDefinitionFqn)
      ) as FormParams,
      sqlExpression: spec?.sqlExpression,
      computePassedFailedRowCount: spec?.computePassedFailedRowCount,
      threshold: spec?.threshold,
      schedule: {
        cron: spec?.scheduleCron,
        timezone: spec?.scheduleTimezone ?? DQ_DEFAULT_TIMEZONE,
      },
    });
  }, [isDefinitionLoading, spec, defaultKind]);

  const testTypeOptions = useMemo(
    () =>
      definitions.map((definition) => ({
        label: (
          <div data-testid={definition.fullyQualifiedName}>
            <Typography.Paragraph className="m-b-0">
              {getEntityName(definition)}
            </Typography.Paragraph>
            <Typography.Paragraph className="m-b-0 text-grey-muted text-xs">
              {definition.description}
            </Typography.Paragraph>
          </div>
        ),
        value: definition.fullyQualifiedName ?? '',
        labelValue: getEntityName(definition),
      })),
    [definitions]
  );

  const buildSpec = (values: DQTestSpecFormValues): DqTestSpec => {
    const common = {
      ...(spec?.key ? { key: spec.key } : {}),
      name: values.name.trim(),
      kind: values.kind,
      threshold: values.threshold?.trim() || undefined,
      scheduleCron: values.schedule?.cron?.trim() || undefined,
      scheduleTimezone: values.schedule?.cron?.trim()
        ? values.schedule.timezone?.trim() || DQ_DEFAULT_TIMEZONE
        : undefined,
    };

    if (values.kind === DqTestSpecKind.SQL) {
      return {
        ...common,
        sqlExpression: values.sqlExpression?.trim(),
        parameterValues:
          spec?.kind === DqTestSpecKind.SQL ? spec.parameterValues : [],
        computePassedFailedRowCount: false,
      };
    }

    const definition = definitionOf(values.testDefinitionFqn);

    return {
      ...common,
      testDefinitionFqn: values.testDefinitionFqn,
      parameterValues: (
        createTestCaseParameters(values.params, definition) ?? []
      )
        .map((entry) => ({ ...entry, value: String(entry.value) }))
        .filter((entry) => !isEmpty(entry.value)),
      computePassedFailedRowCount:
        Boolean(definition?.supportsRowLevelPassedFailed) &&
        Boolean(values.computePassedFailedRowCount),
    };
  };

  const validate = () => form.validateFields().catch(() => undefined);

  const handleSave = async () => {
    const values = await validate();
    if (!values) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(buildSpec(values));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = async () => {
    const values = await validate();
    if (!values) {
      return;
    }
    setIsPreviewLoading(true);
    try {
      setPreview(
        await previewDqRuleTests(cdeTermId, {
          schemaVersion: 1,
          items: [buildSpec(values)],
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const notApplicableColumns = (preview?.columns ?? []).filter((column) =>
    column.tests.some((test) => !test.applicable)
  );

  return (
    <Modal
      centered
      destroyOnClose
      className="dq-test-spec-modal"
      data-testid="dq-test-spec-modal"
      footer={
        <div className="dq-test-spec-modal-footer">
          <Space>
            <Button
              data-testid="dq-test-preview-button"
              disabled={!cdeTermId}
              loading={isPreviewLoading}
              onClick={handlePreview}>
              {t('dq.test.preview')}
            </Button>
            {!cdeTermId && (
              <Typography.Text type="secondary">
                {t('dq.test.preview-no-cde')}
              </Typography.Text>
            )}
          </Space>
          <Space>
            <Button onClick={onCancel}>{t('label.cancel')}</Button>
            <Button
              data-testid="dq-test-save"
              loading={isSaving}
              type="primary"
              onClick={handleSave}>
              {t('label.save')}
            </Button>
          </Space>
        </div>
      }
      maskClosable={false}
      open={open}
      title={spec ? t('dq.test.edit') : t('dq.test.add')}
      width={760}
      onCancel={onCancel}>
      <Form<DQTestSpecFormValues>
        className="test-case-form-v1 dq-test-spec-form"
        form={form}
        layout="vertical"
        onValuesChange={(changed) => {
          if (changed.kind || changed.testDefinitionFqn) {
            form.setFieldsValue({
              params: undefined,
              computePassedFailedRowCount: false,
            });
          }
          setPreview(undefined);
        }}>
        <Typography.Paragraph className="text-grey-muted">
          {t('dq.test.description')}
        </Typography.Paragraph>

        <Card className="form-card-section">
          <Form.Item
            label={t('dq.test.name')}
            name="name"
            rules={[
              {
                required: true,
                whitespace: true,
                message: t('message.field-text-is-required', {
                  fieldText: t('dq.test.name'),
                }),
              },
              { max: 128 },
              {
                validator: async (_, value?: string) =>
                  otherNames.some(
                    (name) =>
                      name.trim().toLowerCase() === value?.trim().toLowerCase()
                  )
                    ? Promise.reject(new Error(t('dq.test.name-duplicate')))
                    : Promise.resolve(),
              },
            ]}>
            <Input data-testid="dq-test-name" />
          </Form.Item>
          <Form.Item label={t('dq.test.kind')} name="kind">
            <Radio.Group
              buttonStyle="solid"
              data-testid="dq-test-kind"
              disabled={isDefinitionLocked}
              optionType="button">
              <Radio.Button value={DqTestSpecKind.Library}>
                {t('dq.test.kind-library')}
              </Radio.Button>
              <Radio.Button value={DqTestSpecKind.SQL}>
                {t('dq.test.kind-sql')}
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
          {kind === DqTestSpecKind.SQL ? (
            <Form.Item
              extra={t('dq.test.sql-hint')}
              label={t('dq.test.sql')}
              name="sqlExpression"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: t('message.field-text-is-required', {
                    fieldText: t('dq.test.sql'),
                  }),
                },
              ]}
              trigger="onChange">
              <CodeEditor
                showCopyButton
                className="custom-query-editor query-editor-h-200"
                mode={{ name: CSMode.SQL }}
              />
            </Form.Item>
          ) : (
            <>
              <Form.Item
                extra={isDefinitionLocked && t('dq.test.definition-locked')}
                label={t('dq.test.definition')}
                name="testDefinitionFqn"
                rules={[
                  {
                    required: true,
                    message: t('message.field-text-is-required', {
                      fieldText: t('dq.test.definition'),
                    }),
                  },
                ]}
                tooltip={selectedDefinition?.description}>
                <Select
                  showSearch
                  data-testid="dq-test-definition"
                  disabled={isDefinitionLocked}
                  filterOption={filterSelectOptions}
                  getPopupContainer={getPopupContainer}
                  loading={isDefinitionLoading}
                  options={testTypeOptions}
                  placeholder={t('dq.test.select-definition')}
                  popupClassName="no-wrap-option"
                />
              </Form.Item>
              {selectedDefinition?.parameterDefinition && (
                <ParameterForm definition={selectedDefinition} />
              )}
              {selectedDefinition?.supportsRowLevelPassedFailed && (
                <div className="d-flex gap-2 form-switch-container">
                  <Form.Item
                    className="m-b-0"
                    name="computePassedFailedRowCount"
                    valuePropName="checked">
                    <Switch data-testid="dq-test-compute" />
                  </Form.Item>
                  <Typography.Text className="font-medium">
                    {t('dq.test.compute-rate')}
                  </Typography.Text>
                </div>
              )}
            </>
          )}
          <Form.Item
            label={t('dq.test.threshold')}
            name="threshold"
            rules={[{ max: 64 }]}>
            <Input
              data-testid="dq-test-threshold"
              placeholder={
                ruleThreshold
                  ? t('dq.test.threshold-placeholder', {
                      threshold: ruleThreshold,
                    })
                  : t('dq.test.threshold-placeholder-none')
              }
            />
          </Form.Item>
          <Form.Item
            extra={t('dq.test.schedule-hint')}
            label={t('dq.test.schedule')}
            name="schedule">
            <DQScheduleField />
          </Form.Item>
        </Card>

        {preview && (
          <Alert
            showIcon
            data-testid="dq-test-preview"
            description={
              notApplicableColumns.length > 0 && (
                <Space wrap size={4}>
                  {notApplicableColumns.map((column) => (
                    <Tag color="warning" key={column.columnKey}>
                      {column.columnFqn.split('.').slice(-1)[0]}:{' '}
                      {t('dq.test.not-applicable')}
                    </Tag>
                  ))}
                </Space>
              )
            }
            message={t('dq.test.preview-summary', {
              testCases: preview.totals.testCases,
              columns: preview.totals.columns,
              notApplicable: preview.totals.notApplicable,
            })}
            type={notApplicableColumns.length > 0 ? 'warning' : 'info'}
          />
        )}
      </Form>
    </Modal>
  );
};

export default DQTestSpecModal;
