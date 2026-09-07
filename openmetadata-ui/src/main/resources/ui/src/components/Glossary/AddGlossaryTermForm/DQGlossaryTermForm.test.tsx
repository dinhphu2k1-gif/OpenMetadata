/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { Form } from 'antd';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import DQGlossaryTermForm, {
  DQGlossaryTermFormValues,
} from './DQGlossaryTermForm.component';

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    currentUser: { id: 'user-123', name: 'test_user', type: 'user' },
  }),
}));

jest.mock('../../../hooks/useEntityRules', () => ({
  useEntityRules: () => ({
    entityRules: {
      canAddMultipleDomains: true,
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  }),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  getFirstLevelGlossaryTermsPaginated: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'cde-id-1',
        name: 'CDE1',
        displayName: 'Tên khách hàng',
        fullyQualifiedName: 'Data Dictionary.CDE1',
      },
    ],
  }),
  searchGlossaryTermsPaginated: jest.fn().mockResolvedValue({
    data: [],
  }),
}));

jest.mock('../../common/UserTeamSelectableListSearchInput/UserTeamSelectableListSearchInput.component', () =>
  jest.fn().mockImplementation(({ onUpdate }) => (
    <div data-testid="mock-user-team-picker">
      <button
        data-testid="mock-set-owner"
        type="button"
        onClick={() =>
          onUpdate([
            { id: 'owner-1', name: 'Data Team', type: 'team' },
          ])
        }>
        Set Owner
      </button>
      <button
        data-testid="mock-set-reviewer"
        type="button"
        onClick={() =>
          onUpdate([
            { id: 'reviewer-1', name: 'Reviewer User', type: 'user' },
          ])
        }>
        Set Reviewer
      </button>
    </div>
  ))
);

jest.mock('../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn().mockImplementation(({ initialValue, onTextChange }) => (
    <textarea
      data-testid="dq-rule-statement"
      defaultValue={initialValue}
      onChange={(e) => onTextChange?.(e.target.value)}
    />
  ))
);

jest.mock('../../../pages/TasksPage/shared/TagSuggestion', () =>
  jest.fn().mockImplementation(({ classificationFilter, onChange }) => (
    <div data-testid={`mock-tag-suggestion-${classificationFilter}`}>
      <button
        data-testid={`mock-add-tag-${classificationFilter}`}
        type="button"
        onClick={() =>
          onChange?.([
            {
              tagFQN: `${classificationFilter}.Tag1`,
              name: 'Tag1',
              source: TagSource.Classification,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ])
        }>
        Add Tag {classificationFilter}
      </button>
    </div>
  ))
);

const mockGlossaryTerm: GlossaryTerm = {
  id: 'dq-term-id-1',
  name: 'DQ1.1',
  displayName: 'DQ1.1 - Tính chính xác (Tên khách hàng)',
  description: 'Tên KH phải chính xác khớp với giấy tờ tùy thân',
  glossary: { id: 'glossary-dq', name: 'Data Quality', type: 'glossary' },
  owners: [{ id: 'team-1', name: 'Ban QLDL', type: 'team' }],
  reviewers: [{ id: 'user-2', name: 'Steward User', type: 'user' }],
  tags: [
    {
      tagFQN: 'DataQualityDimension.Accuracy',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
    {
      tagFQN: 'DataSource.IPCAS',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  extension: {
    cdeCode: 'CDE1',
    cdeName: 'Tên khách hàng',
    cdeVersion: '1.0',
    qualityThreshold: '100%',
    ruleExplanation: 'Diễn giải chi tiết',
    otherConstraints: 'Kiểm tra Not Null',
    exceptions: 'Không có',
  },
};

const FormWrapper = ({
  editMode = false,
  glossaryTerm,
  onSave = jest.fn(),
}: {
  editMode?: boolean;
  glossaryTerm?: GlossaryTerm;
  onSave?: jest.Mock;
}) => {
  const [form] = Form.useForm<DQGlossaryTermFormValues>();

  return (
    <div>
      <DQGlossaryTermForm
        editMode={editMode}
        formRef={form}
        glossaryTerm={glossaryTerm}
        onCancel={jest.fn()}
        onSave={onSave}
      />
      <button data-testid="submit-form" type="button" onClick={() => form.submit()}>
        Submit
      </button>
    </div>
  );
};

describe('DQGlossaryTermForm', () => {
  it('renders all form fields in add mode', () => {
    render(<FormWrapper />);

    expect(screen.getByTestId('dq-rule-code')).toBeInTheDocument();
    expect(screen.getByTestId('dq-rule-name')).toBeInTheDocument();
    expect(screen.getByTestId('dq-version')).toBeInTheDocument();
    expect(screen.getByTestId('dq-rule-statement')).toBeInTheDocument();
    expect(screen.getByTestId('dq-quality-threshold')).toBeInTheDocument();
    expect(screen.getByTestId('dq-rule-explanation')).toBeInTheDocument();
    expect(screen.getByTestId('dq-other-constraints')).toBeInTheDocument();
    expect(screen.getByTestId('dq-exceptions')).toBeInTheDocument();
  });

  it('populates fields in edit mode from glossaryTerm', () => {
    render(<FormWrapper editMode glossaryTerm={mockGlossaryTerm} />);

    expect(screen.getByTestId('dq-rule-code')).toHaveValue('DQ1.1');
    expect(screen.getByTestId('dq-rule-name')).toHaveValue(
      'DQ1.1 - Tính chính xác (Tên khách hàng)'
    );
    expect(screen.getByTestId('dq-version')).toHaveValue('1.0');
    expect(screen.getByTestId('dq-quality-threshold')).toHaveValue('100%');
    expect(screen.getByTestId('dq-rule-explanation')).toHaveValue(
      'Diễn giải chi tiết'
    );
  });

  it('submits form with correct payload', async () => {
    const handleSave = jest.fn();
    render(<FormWrapper onSave={handleSave} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('dq-rule-code'), {
        target: { value: 'DQ3.1' },
      });
      fireEvent.change(screen.getByTestId('dq-rule-name'), {
        target: { value: 'DQ3.1 - Tính đầy đủ' },
      });
      fireEvent.change(screen.getByTestId('dq-version'), {
        target: { value: '1.2' },
      });
      fireEvent.change(screen.getByTestId('dq-rule-statement'), {
        target: { value: 'Mô tả quy tắc' },
      });
      fireEvent.change(screen.getByTestId('dq-quality-threshold'), {
        target: { value: '99%' },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-form'));
    });

    expect(handleSave).toHaveBeenCalledTimes(1);
    const payload = handleSave.mock.calls[0][0];
    expect(payload.name).toBe('DQ3.1');
    expect(payload.displayName).toBe('DQ3.1 - Tính đầy đủ');
    expect(payload.description).toBe('Mô tả quy tắc');
    expect(payload.extension).toEqual(
      expect.objectContaining({
        cdeVersion: '1.2',
        qualityThreshold: '99%',
      })
    );
  });
});
