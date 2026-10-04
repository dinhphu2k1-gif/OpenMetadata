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

import { Alert, Button, Card, Input, Radio, Select, Switch, Tag } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DqTestSpec,
  DqTestSpecKind,
  DqTestSpecs,
  TestCaseParameterValue,
} from '../../../generated/type/dqTestSpecs';
import {
  listDqLibraryTestDefinitions,
  previewDqRuleTests,
} from '../../../rest/dqRuleTestAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DQLibraryDefinition, DQPreview } from './DQRuleTests.interface';

interface DQTestSpecsFieldProps {
  value?: DqTestSpecs;
  onChange?: (value: DqTestSpecs) => void;
  cdeTermId?: string;
  defaultKind: DqTestSpecKind;
  ruleThreshold?: string;
  lockedKeys?: string[];
}

const ARRAY_DATA_TYPE = 'ARRAY';

const parseArrayValue = (value?: string): string[] => {
  try {
    const parsed = value ? JSON.parse(value) : [];

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

export const isDqTestSpecsValid = (specs?: DqTestSpecs) =>
  (specs?.items ?? []).every(
    (spec) =>
      Boolean(spec.name?.trim()) &&
      (spec.kind === DqTestSpecKind.SQL
        ? Boolean(spec.sqlExpression?.trim())
        : Boolean(spec.testDefinitionFqn))
  );

const DQTestSpecsField = ({
  value,
  onChange,
  cdeTermId,
  defaultKind,
  ruleThreshold,
  lockedKeys = [],
}: DQTestSpecsFieldProps) => {
  const { t } = useTranslation();
  const [definitions, setDefinitions] = useState<DQLibraryDefinition[]>([]);
  const [preview, setPreview] = useState<DQPreview>();
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const items = useMemo(() => value?.items ?? [], [value]);

  useEffect(() => {
    listDqLibraryTestDefinitions()
      .then(setDefinitions)
      .catch((error: AxiosError) => showErrorToast(error));
  }, []);

  const emit = useCallback(
    (next: DqTestSpec[]) => onChange?.({ schemaVersion: 1, items: next }),
    [onChange]
  );

  const update = (index: number, patch: Partial<DqTestSpec>) =>
    emit(
      items.map((spec, at) => (at === index ? { ...spec, ...patch } : spec))
    );

  const addSpec = () =>
    emit([
      ...items,
      {
        name: '',
        kind: defaultKind,
        parameterValues: [],
        computePassedFailedRowCount: false,
      },
    ]);

  const removeSpec = (index: number) =>
    emit(items.filter((_, at) => at !== index));

  const definitionOf = (fqn?: string) =>
    definitions.find((definition) => definition.fqn === fqn);

  const changeKind = (index: number, kind: DqTestSpecKind) =>
    update(index, {
      kind,
      testDefinitionFqn: undefined,
      sqlExpression: undefined,
      parameterValues: [],
      computePassedFailedRowCount: false,
    });

  const changeDefinition = (index: number, fqn: string) =>
    update(index, {
      testDefinitionFqn: fqn,
      parameterValues: [],
      computePassedFailedRowCount: false,
    });

  const setParameter = (index: number, name: string, parameter?: string) => {
    const others = (items[index].parameterValues ?? []).filter(
      (entry: TestCaseParameterValue) => entry.name !== name
    );
    update(index, {
      parameterValues: isEmpty(parameter)
        ? others
        : [...others, { name, value: parameter }],
    });
  };

  const loadPreview = async () => {
    setIsPreviewLoading(true);
    try {
      setPreview(
        await previewDqRuleTests(cdeTermId, { schemaVersion: 1, items })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const renderParameters = (spec: DqTestSpec, index: number) => {
    const definition = definitionOf(spec.testDefinitionFqn);

    return (definition?.parameterDefinition ?? []).map((parameter) => {
      const current = spec.parameterValues?.find(
        (entry) => entry.name === parameter.name
      )?.value;
      const label = `${parameter.displayName ?? parameter.name}${
        parameter.required ? ' *' : ''
      }`;

      return (
        <div
          className="dq-test-spec-parameter"
          data-testid={`dq-test-parameter-${parameter.name}`}
          key={parameter.name}>
          <label>{label}</label>
          {parameter.dataType === ARRAY_DATA_TYPE ? (
            <Select
              mode="tags"
              open={false}
              style={{ width: '100%' }}
              value={parseArrayValue(current)}
              onChange={(values: string[]) =>
                setParameter(
                  index,
                  parameter.name,
                  values.length ? JSON.stringify(values) : undefined
                )
              }
            />
          ) : (
            <Input
              value={current}
              onChange={(event) =>
                setParameter(index, parameter.name, event.target.value)
              }
            />
          )}
        </div>
      );
    });
  };

  const renderSpec = (spec: DqTestSpec, index: number) => {
    const isLocked = Boolean(spec.key && lockedKeys.includes(spec.key));
    const definition = definitionOf(spec.testDefinitionFqn);
    // The SQL validator only counts violations, so only library tests can compute a pass rate.
    const canComputeRate =
      spec.kind === DqTestSpecKind.Library &&
      Boolean(definition?.supportsRowLevelPassedFailed);

    return (
      <Card
        className="dq-test-spec-card"
        data-testid={`dq-test-spec-${index}`}
        extra={
          <Button
            danger
            data-testid={`dq-test-remove-${index}`}
            size="small"
            type="text"
            onClick={() => removeSpec(index)}>
            {t('dq.test.remove')}
          </Button>
        }
        key={spec.key ?? `new-${index}`}
        size="small"
        title={
          <>
            {spec.name || t('dq.test.untitled')}{' '}
            {spec.key && <Tag>{spec.key}</Tag>}
          </>
        }>
        <div className="dq-test-spec-row">
          <label>{t('dq.test.name')} *</label>
          <Input
            data-testid={`dq-test-name-${index}`}
            maxLength={128}
            status={spec.name?.trim() ? undefined : 'error'}
            value={spec.name}
            onChange={(event) => update(index, { name: event.target.value })}
          />
        </div>
        <div className="dq-test-spec-row">
          <label>{t('dq.test.kind')}</label>
          <Radio.Group
            data-testid={`dq-test-kind-${index}`}
            disabled={isLocked}
            value={spec.kind}
            onChange={(event) => changeKind(index, event.target.value)}>
            <Radio value={DqTestSpecKind.Library}>
              {t('dq.test.kind-library')}
            </Radio>
            <Radio value={DqTestSpecKind.SQL}>{t('dq.test.kind-sql')}</Radio>
          </Radio.Group>
        </div>
        {spec.kind === DqTestSpecKind.Library ? (
          <>
            <div className="dq-test-spec-row">
              <label>{t('dq.test.definition')} *</label>
              <Select
                showSearch
                data-testid={`dq-test-definition-${index}`}
                disabled={isLocked}
                optionFilterProp="label"
                options={definitions.map((entry) => ({
                  value: entry.fqn,
                  label: entry.displayName ?? entry.name,
                }))}
                status={spec.testDefinitionFqn ? undefined : 'error'}
                style={{ width: '100%' }}
                value={spec.testDefinitionFqn}
                onChange={(fqn) => changeDefinition(index, fqn)}
              />
              {isLocked && (
                <span className="dq-test-spec-hint">
                  {t('dq.test.definition-locked')}
                </span>
              )}
              {definition?.description && (
                <span className="dq-test-spec-hint">
                  {definition.description}
                </span>
              )}
            </div>
            {renderParameters(spec, index)}
          </>
        ) : (
          <div className="dq-test-spec-row">
            <label>{t('dq.test.sql')} *</label>
            <Input.TextArea
              autoSize={{ minRows: 4, maxRows: 16 }}
              data-testid={`dq-test-sql-${index}`}
              spellCheck={false}
              status={spec.sqlExpression?.trim() ? undefined : 'error'}
              style={{ fontFamily: 'monospace' }}
              value={spec.sqlExpression}
              onChange={(event) =>
                update(index, { sqlExpression: event.target.value })
              }
            />
            <span className="dq-test-spec-hint">{t('dq.test.sql-hint')}</span>
          </div>
        )}
        {spec.kind === DqTestSpecKind.Library && (
          <div className="dq-test-spec-row dq-test-spec-inline">
            <Switch
              checked={Boolean(spec.computePassedFailedRowCount)}
              data-testid={`dq-test-compute-${index}`}
              disabled={!canComputeRate}
              onChange={(checked) =>
                update(index, { computePassedFailedRowCount: checked })
              }
            />
            <span>{t('dq.test.compute-rate')}</span>
          </div>
        )}
        <div className="dq-test-spec-row">
          <label>{t('dq.test.threshold')}</label>
          <Input
            data-testid={`dq-test-threshold-${index}`}
            maxLength={64}
            placeholder={
              ruleThreshold
                ? t('dq.test.threshold-placeholder', {
                    threshold: ruleThreshold,
                  })
                : t('dq.test.threshold-placeholder-none')
            }
            value={spec.threshold}
            onChange={(event) =>
              update(index, { threshold: event.target.value || undefined })
            }
          />
        </div>
      </Card>
    );
  };

  const renderPreview = () =>
    preview && (
      <div className="dq-test-preview" data-testid="dq-test-preview">
        <p>
          {t('dq.test.preview-summary', {
            testCases: preview.totals.testCases,
            columns: preview.totals.columns,
            notApplicable: preview.totals.notApplicable,
          })}
        </p>
        <ul>
          {preview.columns.map((column) => (
            <li key={column.columnKey}>
              <code>{column.columnFqn}</code>{' '}
              {column.tests
                .filter((test) => !test.applicable)
                .map((test) => (
                  <Tag
                    color="warning"
                    key={`${column.columnKey}-${test.index}`}>
                    {test.name}: {t('dq.test.not-applicable')}
                  </Tag>
                ))}
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="dq-test-specs-field" data-testid="dq-test-specs-field">
      <p className="dq-test-specs-description">{t('dq.test.description')}</p>
      {isEmpty(items) && (
        <Alert
          showIcon
          data-testid="dq-test-specs-empty"
          message={t('dq.test.empty')}
          type="info"
        />
      )}
      {items.map(renderSpec)}
      <div className="dq-test-specs-actions">
        <Button data-testid="dq-test-add" onClick={addSpec}>
          {t('dq.test.add')}
        </Button>
        <Button
          data-testid="dq-test-preview-button"
          disabled={isEmpty(items) || !cdeTermId}
          loading={isPreviewLoading}
          onClick={loadPreview}>
          {t('dq.test.preview')}
        </Button>
        {!cdeTermId && (
          <span className="dq-test-spec-hint">
            {t('dq.test.preview-no-cde')}
          </span>
        )}
      </div>
      {renderPreview()}
    </div>
  );
};

export default DQTestSpecsField;
