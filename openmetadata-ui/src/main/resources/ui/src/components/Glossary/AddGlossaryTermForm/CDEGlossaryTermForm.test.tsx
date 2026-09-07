/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { Form, FormInstance } from 'antd';
import { CreateGlossaryTerm } from '../../../generated/api/data/createGlossaryTerm';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { CDE_TAG_CLASSIFICATIONS } from '../GlossaryTermTab/CDEGlossaryTableColumns';
import CDEGlossaryTermForm, {
  CDEGlossaryTermFormValues,
} from './CDEGlossaryTermForm.component';
import { GlossaryTermForm } from './AddGlossaryTermForm.interface';

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

jest.mock('../../common/DomainSelectableList/DomainSelectableList.component', () =>
  jest.fn().mockImplementation(({ children, onUpdate }) => (
    <div data-testid="mock-domain-list">
      {children}
      <button
        data-testid="mock-set-domain"
        type="button"
        onClick={() =>
          onUpdate([
            { id: 'domain-1', name: 'Khách hàng', fullyQualifiedName: 'KhachHang', type: 'domain' },
          ])
        }>
        Set Domain
      </button>
      <button
        data-testid="mock-clear-domain"
        type="button"
        onClick={() => onUpdate(undefined)}>
        Clear Domain
      </button>
    </div>
  ))
);

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
      data-testid="cde-business-meaning"
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
  id: 'term-id-1',
  name: 'CDE_MA_KH',
  displayName: 'Mã khách hàng',
  description: 'Mã định danh duy nhất của khách hàng',
  glossary: { id: 'glossary-1', name: 'Data Dictionary', type: 'glossary' },
  domains: [
    { id: 'domain-1', name: 'Khách hàng', fullyQualifiedName: 'KhachHang', type: 'domain' },
  ],
  owners: [{ id: 'team-1', name: 'Ban QLDL', type: 'team' }],
  reviewers: [{ id: 'user-2', name: 'Steward User', type: 'user' }],
  tags: [
    {
      tagFQN: 'DataSource.CoreBanking',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
    {
      tagFQN: 'DataClassification.NoiBo',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
    {
      tagFQN: 'Tier.Tier1',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  extension: {
    cdeVersion: '1.0',
    entityRelationship: '1 KH - N TK',
    dataQualityRules: ['Y'],
    relatedRegulatoryDocuments: 'Quyết định 123/QĐ-NHNo',
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
  const [form] = Form.useForm<CDEGlossaryTermFormValues>();

  return (
    <div>
      <CDEGlossaryTermForm
        editMode={editMode}
        formRef={form as unknown as FormInstance<CreateGlossaryTerm>}
        glossaryTerm={glossaryTerm}
        onCancel={jest.fn()}
        onSave={onSave}
      />
      <button data-testid="submit-btn" type="button" onClick={() => form.submit()}>
        Submit
      </button>
    </div>
  );
};

describe('CDEGlossaryTermForm', () => {
  it('renders correctly in Add mode', () => {
    const { container } = render(<FormWrapper />);

    expect(screen.getByTestId('cde-term-code')).toBeInTheDocument();
    expect(screen.getByTestId('cde-business-term-name')).toBeInTheDocument();
    expect(screen.getByTestId('cde-version')).toBeInTheDocument();
    expect(screen.getByTestId('cde-business-meaning')).toBeInTheDocument();
    expect(screen.getByTestId('cde-business-group')).toBeInTheDocument();
    expect(
      container.querySelector('.cde-glossary-term-form')
    ).toHaveClass('cde-glossary-term-form--add');
    expect(container.querySelectorAll('.ant-form-item')).toHaveLength(13);
    expect(container.querySelectorAll('.cde-form-section-title')).toHaveLength(
      0
    );
  });

  it('submits a complete CDE in Add mode', async () => {
    const handleSave = jest.fn();
    render(<FormWrapper onSave={handleSave} />);

    fireEvent.change(screen.getByTestId('cde-term-code'), {
      target: { value: 'CDE_NEW' },
    });
    fireEvent.change(screen.getByTestId('cde-business-term-name'), {
      target: { value: 'New CDE' },
    });
    fireEvent.change(screen.getByTestId('cde-version'), {
      target: { value: '1.0' },
    });
    fireEvent.change(screen.getByTestId('cde-business-meaning'), {
      target: { value: 'Meaning for the new CDE' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-set-domain'));
      fireEvent.click(
        screen.getByTestId(
          `mock-add-tag-${CDE_TAG_CLASSIFICATIONS.dataSource}`
        )
      );
      fireEvent.click(screen.getAllByTestId('mock-set-owner')[0]);
      fireEvent.click(screen.getAllByTestId('mock-set-reviewer')[1]);
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    expect(handleSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'CDE_NEW',
        displayName: 'New CDE',
        description: 'Meaning for the new CDE',
        domains: [
          expect.objectContaining({ fullyQualifiedName: 'KhachHang' }),
        ],
        owners: [expect.objectContaining({ id: 'owner-1' })],
        reviewers: [expect.objectContaining({ id: 'reviewer-1' })],
        tags: [
          expect.objectContaining({
            tagFQN: `${CDE_TAG_CLASSIFICATIONS.dataSource}.Tag1`,
          }),
        ],
        extension: expect.objectContaining({
          cdeVersion: '1.0',
        }),
      })
    );
  });

  it('prefills fields correctly in Edit mode', () => {
    const { container } = render(
      <FormWrapper editMode glossaryTerm={mockGlossaryTerm} />
    );

    expect(screen.getByTestId('cde-term-code')).toHaveValue('CDE_MA_KH');
    expect(screen.getByTestId('cde-business-term-name')).toHaveValue('Mã khách hàng');
    expect(screen.getByTestId('cde-version')).toHaveValue('1.0');
    expect(screen.getByTestId('cde-business-meaning')).toHaveValue(
      'Mã định danh duy nhất của khách hàng'
    );
    expect(screen.getByTestId('cde-business-group')).toHaveTextContent('Khách hàng');
    expect(
      container.querySelector('.cde-glossary-term-form')
    ).toHaveClass('cde-glossary-term-form--edit');
    expect(container.querySelectorAll('.cde-form-section-title')).toHaveLength(
      3
    );
  });

  it('preserves non-CDE tags and submits all CDE data accurately', async () => {
    const handleSave = jest.fn();
    render(<FormWrapper editMode glossaryTerm={mockGlossaryTerm} onSave={handleSave} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('submit-btn'));
    });

    expect(handleSave).toHaveBeenCalledTimes(1);

    const savedData = handleSave.mock.calls[0][0];

    expect(savedData.name).toBe('CDE_MA_KH');
    expect(savedData.displayName).toBe('Mã khách hàng');
    expect(savedData.description).toBe('Mã định danh duy nhất của khách hàng');
    expect(savedData.domains).toEqual([
      { id: 'domain-1', name: 'Khách hàng', fullyQualifiedName: 'KhachHang', type: 'domain' },
    ]);
    expect(savedData.owners).toEqual([{ id: 'team-1', name: 'Ban QLDL', type: 'team' }]);
    expect(savedData.reviewers).toEqual([{ id: 'user-2', name: 'Steward User', type: 'user' }]);

    // Should contain both CDE tags and non-CDE tags (Tier.Tier1)
    const tagFqns = (savedData as GlossaryTermForm).tags.map((tag) =>
      tag.tagFQN
    );

    expect(tagFqns).toContain('Tier.Tier1');
    expect(tagFqns).toContain('DataSource.CoreBanking');
    expect(tagFqns).toContain('DataClassification.NoiBo');

    // Extension fields
    expect(savedData.extension).toEqual({
      cdeVersion: '1.0',
      entityRelationship: '1 KH - N TK',
      dataQualityRules: ['Y'],
      relatedRegulatoryDocuments: 'Quyết định 123/QĐ-NHNo',
    });
  });

  it('safely handles clearing domains without crashing', async () => {
    render(<FormWrapper editMode glossaryTerm={mockGlossaryTerm} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-clear-domain'));
    });

    expect(screen.getByTestId('cde-business-group')).toBeInTheDocument();
  });
});
