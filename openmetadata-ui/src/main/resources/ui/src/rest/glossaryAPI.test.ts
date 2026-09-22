/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
import APIClient from './index';
import {
  addGlossaryTerm,
  getFirstLevelGlossaryTermsPaginated,
  updateGlossaryTermWorkingVersion,
} from './glossaryAPI';

jest.mock('./index', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
}));

const client = APIClient as jest.Mocked<typeof APIClient>;

describe('F03 CDE draft API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates the identity and initial Draft with one POST', async () => {
    client.post.mockResolvedValue({
      data: { id: 'term-id', businessVersion: '1.0', workingRevision: 1 },
    });

    await addGlossaryTerm({
      glossary: 'Data Dictionary',
      name: 'CDE_001',
      description: 'Customer identifier',
    });

    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith('/glossaryTerms', {
      glossary: 'Data Dictionary',
      name: 'CDE_001',
      description: 'Customer identifier',
    });
    expect(client.patch).not.toHaveBeenCalled();
  });

  it('sends only the complete mutable allowlist when saving', async () => {
    client.patch.mockResolvedValue({ data: { workingRevision: 2 } });

    await updateGlossaryTermWorkingVersion('term-id', 1, {
      id: 'term-id',
      name: 'immutable',
      fullyQualifiedName: 'Data Dictionary.immutable',
      businessVersion: '9.9',
      workingRevision: 99,
      entityStatus: 'In Review',
      displayName: 'Tên nghiệp vụ',
      description: 'Meaning',
      owners: [],
      reviewers: [],
      domains: [],
      tags: [],
      extension: undefined,
    } as never);

    expect(client.patch).toHaveBeenCalledWith(
      '/glossaryTerms/term-id/working',
      {
        expectedRevision: 1,
        displayName: 'Tên nghiệp vụ',
        description: 'Meaning',
        owners: [],
        reviewers: [],
        domains: [],
        tags: [],
        extension: null,
      }
    );
  });

  it('loads authoring rows by glossary so unpinned Drafts survive reload', async () => {
    client.get.mockResolvedValue({ data: { data: [], paging: { total: 0 } } });

    await getFirstLevelGlossaryTermsPaginated('Data Dictionary');

    expect(client.get).toHaveBeenCalledWith('/glossaryTerms', {
      params: expect.objectContaining({
        glossary: 'Data Dictionary',
      }),
    });
    expect(client.get).not.toHaveBeenCalledWith(
      '/glossaryTerms',
      expect.objectContaining({
        params: expect.objectContaining({ directChildrenOf: 'Data Dictionary' }),
      })
    );
  });
});
