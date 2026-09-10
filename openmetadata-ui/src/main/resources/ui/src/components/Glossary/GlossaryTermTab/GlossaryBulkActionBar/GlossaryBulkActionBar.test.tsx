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

import { fireEvent, render, screen } from '@testing-library/react';
import { EntityStatus } from '../../../../generated/entity/data/glossaryTerm';
import { ModifiedGlossaryTerm } from '../GlossaryTermTab.interface';
import GlossaryBulkActionBar from './GlossaryBulkActionBar.component';

describe('GlossaryBulkActionBar', () => {
  const mockClearSelection = jest.fn();
  const mockSubmitForReview = jest.fn();
  const mockApprove = jest.fn();
  const mockReject = jest.fn();
  const mockRevokeApproval = jest.fn();

  const mockDraftTerm = {
    id: 'term-1',
    name: 'Term 1',
    fullyQualifiedName: 'Glossary.Term1',
    entityStatus: EntityStatus.Draft,
  } as ModifiedGlossaryTerm;

  const mockInReviewTerm = {
    id: 'term-2',
    name: 'Term 2',
    fullyQualifiedName: 'Glossary.Term2',
    entityStatus: EntityStatus.InReview,
  } as ModifiedGlossaryTerm;

  const mockApprovedTerm = {
    id: 'term-3',
    name: 'Term 3',
    fullyQualifiedName: 'Glossary.Term3',
    entityStatus: EntityStatus.Approved,
  } as ModifiedGlossaryTerm;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render null when selectedTerms is empty', () => {
    const { container } = render(
      <GlossaryBulkActionBar
        canApproveOrReject={true}
        canSubmitForReview={true}
        selectedTerms={[]}
        onApprove={mockApprove}
        onClearSelection={mockClearSelection}
        onReject={mockReject}
        onSubmitForReview={mockSubmitForReview}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render selection count and draft action for Proposer', () => {
    render(
      <GlossaryBulkActionBar
        canApproveOrReject={false}
        canSubmitForReview={true}
        selectedTerms={[mockDraftTerm]}
        onApprove={mockApprove}
        onClearSelection={mockClearSelection}
        onReject={mockReject}
        onSubmitForReview={mockSubmitForReview}
      />
    );

    expect(screen.getByTestId('selected-count-tag')).toBeInTheDocument();
    expect(screen.getByTestId('draft-count-tag')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-submit-for-review-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-approve-btn')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bulk-submit-for-review-btn'));
    expect(mockSubmitForReview).toHaveBeenCalledWith([mockDraftTerm]);

    fireEvent.click(screen.getByTestId('clear-selection-btn'));
    expect(mockClearSelection).toHaveBeenCalled();
  });

  it('should render in-review actions (Approve / Reject) for Steward / Reviewer', () => {
    render(
      <GlossaryBulkActionBar
        canApproveOrReject={true}
        canSubmitForReview={false}
        selectedTerms={[mockInReviewTerm]}
        onApprove={mockApprove}
        onClearSelection={mockClearSelection}
        onReject={mockReject}
        onSubmitForReview={mockSubmitForReview}
      />
    );

    expect(screen.getByTestId('in-review-count-tag')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-approve-btn')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-reject-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-submit-for-review-btn')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bulk-approve-btn'));
    expect(mockApprove).toHaveBeenCalledWith([mockInReviewTerm]);

    fireEvent.click(screen.getByTestId('bulk-reject-btn'));
    expect(mockReject).toHaveBeenCalledWith([mockInReviewTerm]);
  });

  it('should show both draft and in-review actions for Admin when mixed terms selected', () => {
    render(
      <GlossaryBulkActionBar
        canApproveOrReject={true}
        canSubmitForReview={true}
        selectedTerms={[mockDraftTerm, mockInReviewTerm, mockApprovedTerm]}
        onApprove={mockApprove}
        onClearSelection={mockClearSelection}
        onReject={mockReject}
        onSubmitForReview={mockSubmitForReview}
      />
    );

    expect(screen.getByTestId('draft-count-tag')).toBeInTheDocument();
    expect(screen.getByTestId('in-review-count-tag')).toBeInTheDocument();
    expect(screen.getByTestId('approved-count-tag')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-submit-for-review-btn')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-approve-btn')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-reject-btn')).toBeInTheDocument();
  });

  it('should render bulk revoke action when approved terms are selected and user can approve/reject', () => {
    render(
      <GlossaryBulkActionBar
        canApproveOrReject={true}
        canSubmitForReview={false}
        selectedTerms={[mockApprovedTerm]}
        onApprove={mockApprove}
        onClearSelection={mockClearSelection}
        onReject={mockReject}
        onRevokeApproval={mockRevokeApproval}
        onSubmitForReview={mockSubmitForReview}
      />
    );

    expect(screen.getByTestId('approved-count-tag')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-revoke-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('bulk-approve-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-reject-btn')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('bulk-revoke-btn'));
    expect(mockRevokeApproval).toHaveBeenCalledWith([mockApprovedTerm]);
  });
});
