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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import {
  mockedGlossaryTerms,
  MOCK_GLOSSARY,
} from '../../../mocks/Glossary.mock';
import { mockUserData } from '../../../mocks/MyDataPage.mock';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import { QueryVoteType } from '../../Database/TableQueries/TableQueries.interface';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import GlossaryHeader, { suggestNextVersion } from './GlossaryHeader.component';

const mockGlossaryTermPermission = {
  All: true,
  Create: true,
  Delete: true,
  ViewAll: true,
  EditAll: true,
  EditDescription: true,
  EditDisplayName: true,
  EditCustomFields: true,
};

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    permissions: {
      glossaryTerm: mockGlossaryTermPermission,
    },
  })),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    glossaryFqn: 'glossaryFqn',
    action: 'action',
  }),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock(
  '../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => {
    return {
      UserTeamSelectableList: jest.fn().mockImplementation(({ onUpdate }) => (
        <div>
          <p>UserTeamSelectableList</p>
          <button data-testid="update" onClick={onUpdate}>
            update
          </button>
        </div>
      )),
    };
  }
);

jest.mock('../../common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <div>Description</div>);
});

jest.mock('../../Entity/EntityHeader/EntityHeader.component', () => ({
  EntityHeader: jest.fn().mockImplementation(({ badge }) => (
    <div data-testid="entity-header">
      EntityHeader
      {badge}
    </div>
  )),
}));

jest.mock(
  '../../Modals/ChangeParentHierarchy/ChangeParentHierarchy.component',
  () => {
    return jest.fn().mockImplementation(({ onCancel }) => (
      <div data-testid="glossary-change-parent-modal">
        <span>ChangeParentHierarchyComponent</span>
        <button onClick={onCancel}>Cancel_Button</button>
      </div>
    ));
  }
);

jest.mock(
  '../../../components/Modals/EntityDeleteModal/EntityDeleteModal',
  () => {
    return jest.fn().mockImplementation(() => <p>EntityDeleteModal</p>);
  }
);

jest.mock(
  '../../../components/Modals/EntityNameModal/EntityNameModal.component',
  () => {
    return jest.fn().mockImplementation(() => <p>EntityNameModal</p>);
  }
);

jest.mock(
  '../../../components/common/ManageButtonContentItem/ManageButtonContentItem.component',
  () => ({
    ManageButtonItemLabel: jest
      .fn()
      .mockImplementation(({ name }) => <div>{name}</div>),
  })
);

jest.mock(
  '../../../components/common/StatusBadge/StatusBadge.component',
  () => {
    return jest.fn().mockImplementation(() => <p>StatusBadge</p>);
  }
);

jest.mock('../../Modals/StyleModal/StyleModal.component', () => {
  return jest.fn().mockImplementation(() => <p>StyleModal</p>);
});

jest.mock('../../Entity/Voting/Voting.component', () => {
  return jest.fn().mockImplementation(() => <p>Voting</p>);
});
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../utils/EntityVoteUtils', () => ({
  getEntityVoteStatus: jest.fn().mockReturnValue(QueryVoteType.votedUp),
}));

jest.mock('../../../utils/EntityDisplayUtils', () => ({
  getEntityDeleteMessage: jest.fn(),
}));
jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue('glossary.test1'),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getGlossaryPath: jest.fn(),
  getGlossaryPathWithAction: jest.fn(),
  getGlossaryTermsVersionsPath: jest.fn(),
  getGlossaryVersionsPath: jest.fn(),
}));

jest.mock('../../../rest/glossaryAPI', () => ({
  exportGlossaryInCSVFormat: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  getGlossariesById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
  getGlossaryTermsById: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockedGlossaryTerms })),
  moveGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
}));

const mockOnDelete = jest.fn();
const mockOnUpdateVote = jest.fn();
const mockOnUpdate = jest.fn();

const mockContext = {
  data: { displayName: 'glossaryTest' } as Glossary,
  onUpdate: mockOnUpdate,
  isVersionView: false,
  type: EntityType.GLOSSARY,
  permissions: DEFAULT_ENTITY_PERMISSION,
};

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockImplementation(() => mockContext),
}));

describe('GlossaryHeader component', () => {
  it('should render name of Glossary', () => {
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText('EntityHeader')).toBeInTheDocument();
  });

  it('should render import and export dropdown menu items only for glossary', async () => {
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    expect(screen.queryByText('label.import')).toBeInTheDocument();
    expect(screen.queryByText('label.export')).toBeInTheDocument();

    expect(
      screen.queryByText('label.change-parent-entity')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('label.style')).not.toBeInTheDocument();
  });

  it('should not render import and export dropdown menu items if no permission', async () => {
    mockGlossaryTermPermission.All = false;
    mockGlossaryTermPermission.EditAll = false;
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.queryByTestId('manage-button')).not.toBeInTheDocument();
  });

  it('should render changeParentHierarchy and style dropdown menu items only for glossaryTerm', async () => {
    mockContext.type = EntityType.GLOSSARY_TERM;
    mockContext.permissions = { ...DEFAULT_ENTITY_PERMISSION, EditAll: true };
    mockGlossaryTermPermission.All = true;
    mockGlossaryTermPermission.EditAll = true;
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    expect(screen.getByText('label.style')).toBeInTheDocument();
    expect(screen.getByText('label.change-parent-entity')).toBeInTheDocument();

    expect(screen.queryByText('label.import')).not.toBeInTheDocument();
    expect(screen.queryByText('label.export')).not.toBeInTheDocument();
  });

  it('should not render ChangeParentHierarchy component when it is close', () => {
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(
      screen.queryByText('ChangeParentHierarchyComponent')
    ).not.toBeInTheDocument();
  });

  it('should render ChangeParentHierarchy component after clicking dropdown menu item', async () => {
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(
      screen.queryByText('ChangeParentHierarchyComponent')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.change-parent-entity'));
    });

    expect(
      screen.getByText('ChangeParentHierarchyComponent')
    ).toBeInTheDocument();
  });

  it('should not render ChangeParentHierarchy component after onCancel call', async () => {
    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    expect(
      screen.queryByText('ChangeParentHierarchyComponent')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.change-parent-entity'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Cancel_Button'));
    });

    expect(
      screen.queryByText('ChangeParentHierarchyComponent')
    ).not.toBeInTheDocument();
  });

  it('should render revoke approval menu item for approved glossary term and handle confirm', async () => {
    (useGenericContext as jest.Mock).mockImplementation(() => ({
      data: {
        ...mockedGlossaryTerms[0],
        entityStatus: 'Approved',
      },
      onUpdate: mockOnUpdate,
      isVersionView: false,
      permissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        EditAll: true,
      },
      type: EntityType.GLOSSARY_TERM,
    }));

    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    expect(screen.getByText('label.revoke-approval')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('label.revoke-approval'));
    });

    // ConfirmationModal should be visible
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityStatus: 'Draft',
      })
    );
  });

  it('should render Submit for Review button in manage menu when term is Draft and trigger submit', async () => {
    (useGenericContext as jest.Mock).mockImplementation(() => ({
      data: {
        ...mockedGlossaryTerms[0],
        entityStatus: 'Draft',
      },
      onUpdate: mockOnUpdate,
      isVersionView: false,
      permissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        EditDescription: true,
      },
      type: EntityType.GLOSSARY_TERM,
    }));

    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    expect(screen.getByText('label.submit-for-review')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('label.submit-for-review'));
    });

    // ConfirmationModal should be visible
    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityStatus: EntityStatus.InReview,
      })
    );
  });

  it('should render Approve and Reject buttons in manage menu when term is InReview and trigger approve', async () => {
    (useGenericContext as jest.Mock).mockImplementation(() => ({
      data: {
        ...mockedGlossaryTerms[0],
        entityStatus: EntityStatus.InReview,
        reviewers: [{ id: 'mock-user-id', type: 'user' }],
      },
      onUpdate: mockOnUpdate,
      isVersionView: false,
      permissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        EditStatus: true,
      },
      type: EntityType.GLOSSARY_TERM,
    }));

    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    expect(screen.getByText('label.approve')).toBeInTheDocument();
    expect(screen.getByText('label.reject')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('label.approve'));
    });

    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityStatus: EntityStatus.Approved,
      })
    );
  });

  it('should trigger reject when reject button is clicked in manage menu', async () => {
    (useGenericContext as jest.Mock).mockImplementation(() => ({
      data: {
        ...mockedGlossaryTerms[0],
        entityStatus: EntityStatus.InReview,
        reviewers: [{ id: 'mock-user-id', type: 'user' }],
      },
      onUpdate: mockOnUpdate,
      isVersionView: false,
      permissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        EditStatus: true,
      },
      type: EntityType.GLOSSARY_TERM,
    }));

    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    await act(async () => {
      fireEvent.click(screen.getByText('label.reject'));
    });

    expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-button'));
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityStatus: EntityStatus.Draft,
      })
    );
  });

  it('should render Version badge with status tone and prompt for version when submitting CDE for review', async () => {
    (useGenericContext as jest.Mock).mockImplementation(() => ({
      data: {
        ...mockedGlossaryTerms[0],
        fullyQualifiedName: 'Data Dictionary.Term1',
        glossary: { name: 'Data Dictionary', displayName: 'Từ điển dữ liệu dùng chung' },
        entityStatus: EntityStatus.InReview,
        extension: { cdeVersion: '2.0-Primary' },
      },
      onUpdate: mockOnUpdate,
      permissions: { ManageAll: true },
      isVersionView: false,
    }));

    render(
      <GlossaryHeader
        isGlossary={false}
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    const versionBtn = screen.getByTestId('version-button');

    expect(versionBtn).toBeInTheDocument();
    expect(versionBtn).toHaveClass('inReview');
    expect(versionBtn).toHaveTextContent('Version: 2.0-Primary');
  });

  it('should prompt for version when submitting CDE for review and save version', async () => {
    (useGenericContext as jest.Mock).mockImplementation(() => ({
      data: {
        ...mockedGlossaryTerms[0],
        fullyQualifiedName: 'Data Dictionary.Term1',
        glossary: { name: 'Data Dictionary', displayName: 'Từ điển dữ liệu dùng chung' },
        entityStatus: EntityStatus.Draft,
        owners: [{ id: 'mock-user-id', type: 'user' }],
        extension: { cdeVersion: '1.0' },
      },
      onUpdate: mockOnUpdate,
      permissions: { ManageAll: true },
      isVersionView: false,
    }));

    render(
      <GlossaryHeader
        isGlossary={false}
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    expect(screen.getByText('label.submit-for-review')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('label.submit-for-review'));
    });

    expect(screen.getByTestId('cde-submit-for-review-modal')).toBeInTheDocument();

    const versionInput = screen.getByTestId('cde-submit-version-input');

    expect(versionInput).toHaveValue('1.0');

    fireEvent.change(versionInput, { target: { value: '1.1-Beta' } });

    await act(async () => {
      fireEvent.click(screen.getAllByText('label.submit-for-review')[1]);
    });

    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        entityStatus: EntityStatus.InReview,
        extension: expect.objectContaining({
          cdeVersion: '1.1-Beta',
        }),
      })
    );
  });

  it('should not render Approve, Reject, or Revoke buttons for Data Proposer role', async () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
      currentUser: {
        ...mockUserData,
        isAdmin: false,
        roles: [{ id: 'role-proposer', name: 'DataProposer' }],
      },
      selectedPersona: { name: 'DataProposerPersona' },
    }));

    (useGenericContext as jest.Mock).mockImplementation(() => ({
      data: {
        ...mockedGlossaryTerms[0],
        entityStatus: EntityStatus.InReview,
      },
      onUpdate: mockOnUpdate,
      isVersionView: false,
      permissions: {
        ...DEFAULT_ENTITY_PERMISSION,
        EditStatus: true,
        EditAll: true,
      },
      type: EntityType.GLOSSARY_TERM,
    }));

    render(
      <GlossaryHeader
        updateVote={mockOnUpdateVote}
        onAddGlossaryTerm={mockOnDelete}
        onDelete={mockOnDelete}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('manage-button'));
    });

    expect(screen.queryByText('label.approve')).not.toBeInTheDocument();
    expect(screen.queryByText('label.reject')).not.toBeInTheDocument();
    expect(screen.queryByText('label.revoke-approval')).not.toBeInTheDocument();
  });

  describe('suggestNextVersion', () => {
    it('should increment minor version correctly', () => {
      expect(suggestNextVersion('1.0')).toBe('1.1');
      expect(suggestNextVersion('1.1')).toBe('1.2');
      expect(suggestNextVersion('2.9')).toBe('2.10');
      expect(suggestNextVersion('0.1')).toBe('0.2');
    });

    it('should handle non-standard version strings gracefully', () => {
      expect(suggestNextVersion('1.0-alpha')).toBe('1.0-alpha.1');
      expect(suggestNextVersion('')).toBe('1.1');
    });
  });

  describe('Create Draft (Tạo bản nháp)', () => {
    it('should show "Tạo bản nháp" for Data Proposer on Approved CDE and create draft on submit', async () => {
      (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
        currentUser: {
          ...mockUserData,
          isAdmin: false,
          roles: [{ id: 'role-proposer', name: 'DataProposer' }],
        },
        selectedPersona: { name: 'DataProposerPersona' },
      }));

      (useGenericContext as jest.Mock).mockImplementation(() => ({
        data: {
          ...mockedGlossaryTerms[0],
          fullyQualifiedName: 'Data Dictionary.Term1',
          glossary: { name: 'Data Dictionary', displayName: 'Từ điển dữ liệu dùng chung' },
          entityStatus: EntityStatus.Approved,
          extension: { cdeVersion: '1.0' },
        },
        onUpdate: mockOnUpdate,
        permissions: { ManageAll: true },
        isVersionView: false,
        type: EntityType.GLOSSARY_TERM,
      }));

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('manage-button'));
      });

      expect(screen.getByText('label.create-draft')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('label.create-draft'));
      });

      expect(screen.getByTestId('cde-create-draft-modal')).toBeInTheDocument();

      const versionInput = screen.getByTestId('cde-draft-version-input');
      expect(versionInput).toHaveValue('1.1');

      await act(async () => {
        fireEvent.click(screen.getAllByText('label.create-draft')[1]);
      });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          entityStatus: EntityStatus.Draft,
          extension: expect.objectContaining({
            cdeVersion: '1.1',
          }),
        })
      );
    });

    it('should show "Tạo bản nháp" for Admin on Approved CDE', async () => {
      (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
        currentUser: {
          ...mockUserData,
          isAdmin: true,
          roles: [{ id: 'role-admin', name: 'Admin' }],
        },
        selectedPersona: undefined,
      }));

      (useGenericContext as jest.Mock).mockImplementation(() => ({
        data: {
          ...mockedGlossaryTerms[0],
          fullyQualifiedName: 'Data Dictionary.Term1',
          glossary: { name: 'Data Dictionary', displayName: 'Từ điển dữ liệu dùng chung' },
          entityStatus: EntityStatus.Approved,
          extension: { cdeVersion: '1.0' },
        },
        onUpdate: mockOnUpdate,
        permissions: { ManageAll: true },
        isVersionView: false,
        type: EntityType.GLOSSARY_TERM,
      }));

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('manage-button'));
      });

      expect(screen.getByText('label.create-draft')).toBeInTheDocument();
    });

    it('should NOT show "Tạo bản nháp" for Data Steward role', async () => {
      (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
        currentUser: {
          ...mockUserData,
          isAdmin: false,
          roles: [{ id: 'role-steward', name: 'DataSteward' }],
        },
        selectedPersona: { name: 'DataStewardPersona' },
      }));

      (useGenericContext as jest.Mock).mockImplementation(() => ({
        data: {
          ...mockedGlossaryTerms[0],
          fullyQualifiedName: 'Data Dictionary.Term1',
          glossary: { name: 'Data Dictionary', displayName: 'Từ điển dữ liệu dùng chung' },
          entityStatus: EntityStatus.Approved,
          extension: { cdeVersion: '1.0' },
        },
        onUpdate: mockOnUpdate,
        permissions: { ManageAll: true },
        isVersionView: false,
        type: EntityType.GLOSSARY_TERM,
      }));

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('manage-button'));
      });

      expect(screen.queryByText('label.create-draft')).not.toBeInTheDocument();
    });

    it('should NOT show "Tạo bản nháp" when CDE is not in Approved status', async () => {
      (useApplicationStore as unknown as jest.Mock).mockImplementation(() => ({
        currentUser: {
          ...mockUserData,
          isAdmin: false,
          roles: [{ id: 'role-proposer', name: 'DataProposer' }],
        },
        selectedPersona: { name: 'DataProposerPersona' },
      }));

      (useGenericContext as jest.Mock).mockImplementation(() => ({
        data: {
          ...mockedGlossaryTerms[0],
          fullyQualifiedName: 'Data Dictionary.Term1',
          glossary: { name: 'Data Dictionary', displayName: 'Từ điển dữ liệu dùng chung' },
          entityStatus: EntityStatus.Draft,
          extension: { cdeVersion: '1.0' },
        },
        onUpdate: mockOnUpdate,
        permissions: { ManageAll: true, EditAll: true },
        isVersionView: false,
        type: EntityType.GLOSSARY_TERM,
      }));

      render(
        <GlossaryHeader
          updateVote={mockOnUpdateVote}
          onAddGlossaryTerm={mockOnDelete}
          onDelete={mockOnDelete}
        />
      );

      await act(async () => {
        fireEvent.click(screen.getByTestId('manage-button'));
      });

      expect(screen.queryByText('label.create-draft')).not.toBeInTheDocument();
    });
  });
});
