/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 */
import APIClient from './index';
import {
  addGlossaryTerm,
  getFirstLevelGlossaryTermsPaginated,
  getGlossaryPublishPreview,
  getGlossaryTermWorkingVersion,
  searchGlossaryTermsPaginated,
  transitionGlossaryTermWorkflow,
  transitionGlossaryWorkflow,
  updateGlossaryTermWorkingVersion,
} from './glossaryAPI';

jest.mock('./index', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
}));

const client = APIClient as jest.Mocked<typeof APIClient>;

describe('F03 CDE draft API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/?parentBusinessVersion=1');
  });

  it('creates the identity and initial Draft with one POST', async () => {
    client.post.mockResolvedValue({
      data: { id: 'term-id', businessVersion: '1.0', workingRevision: 1 },
    });

    await addGlossaryTerm({
      glossary: 'Data Dictionary',
      name: 'CDE_001',
      description: 'Customer identifier',
      parentBusinessVersion: '2',
    });

    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.post).toHaveBeenCalledWith('/glossaryTerms', {
      glossary: 'Data Dictionary',
      name: 'CDE_001',
      description: 'Customer identifier',
      parentBusinessVersion: '2',
    });
    expect(client.patch).not.toHaveBeenCalled();
  });

  it('loads a working CDE from the explicitly selected Dictionary scope', async () => {
    client.get.mockResolvedValue({ data: { id: 'term-id' } });

    await getGlossaryTermWorkingVersion('term-id', '2');

    expect(client.get).toHaveBeenCalledWith('/glossaryTerms/term-id/working', {
      params: { parentBusinessVersion: '2' },
    });
  });

  it('submits a CDE using the row scope instead of the current route fallback', async () => {
    client.post.mockResolvedValue({ data: { id: 'term-id' } });

    await transitionGlossaryTermWorkflow(
      'term-id',
      'submit',
      { expectedRevision: 1 },
      '2'
    );

    expect(client.post).toHaveBeenCalledWith(
      '/glossaryTerms/term-id/working/submit',
      { expectedRevision: 1 },
      { params: { parentBusinessVersion: '2' } }
    );
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
        extension: {},
      },
      {
        params: { parentBusinessVersion: '1' },
        headers: { 'Content-Type': 'application/json' },
      }
    );
  });

  it('loads authoring rows by glossary so unpinned Drafts survive reload', async () => {
    client.get.mockResolvedValue({ data: { data: [], paging: { total: 0 } } });

    await getFirstLevelGlossaryTermsPaginated(
      'Data Dictionary',
      50,
      undefined,
      undefined,
      undefined,
      undefined,
      'data-dictionary-id'
    );

    expect(client.get).toHaveBeenCalledWith('/glossaryTerms', {
      params: expect.objectContaining({
        glossary: 'data-dictionary-id',
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

describe('F09 Data Dictionary publication API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requests a server-paginated dynamic publish preview', async () => {
    client.get.mockResolvedValue({
      data: { data: [], paging: {}, termCount: 0, evaluatedAt: 1 },
    });

    await getGlossaryPublishPreview('dictionary-id', {
      limit: 10,
      after: '10',
    });

    expect(client.get).toHaveBeenCalledWith(
      '/glossaries/dictionary-id/working/publish-preview',
      { params: { limit: 10, after: '10' } }
    );
  });

  it.each(['submit', 'reject', 'reopen', 'approve'] as const)(
    'sends only expectedRevision for %s',
    async (action) => {
      client.post.mockResolvedValue({ data: {} });

      await transitionGlossaryWorkflow('dictionary-id', action, {
        expectedRevision: 3,
        businessVersion: 'should-not-be-sent',
      });

      expect(client.post).toHaveBeenCalledWith(
        `/glossaries/dictionary-id/working/${action}`,
        { expectedRevision: 3 }
      );
    }
  );

  it('sends only businessVersion when creating the exact next Dictionary', async () => {
    client.post.mockResolvedValue({ data: { businessVersion: '2' } });

    await transitionGlossaryWorkflow('dictionary-id', 'createDraft', {
      businessVersion: '2',
      expectedRevision: 99,
      payload: { description: 'must not be sent' } as never,
    });

    expect(client.post).toHaveBeenCalledWith('/glossaries/dictionary-id/working', {
      businessVersion: '2',
    });
  });

  it('does not retain the removed F08 working terms route', async () => {
    client.get.mockResolvedValue({ data: {} });
    await getGlossaryPublishPreview('dictionary-id');

    expect(client.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/working/terms'),
      expect.anything()
    );
  });
});

describe('F12 CDE business-version search API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('serializes the immutable scope and stable filter identifiers', async () => {
    client.get.mockResolvedValue({
      data: { data: [], paging: { total: 0, limit: 15, offset: 30 } },
    });

    await searchGlossaryTermsPaginated({
      glossary: 'dictionary-id',
      parentBusinessVersion: '2',
      q: 'Dữ liệu *',
      statuses: 'Draft,Approved',
      domainIds: 'domain-id',
      ownerIds: 'owner-id',
      dataSourceTags: 'DataSource.Core',
      classificationTags: 'DataClassification.Restricted',
      sortField: 'businessVersion',
      sortOrder: 'desc',
      limit: 15,
      offset: 30,
    });

    expect(client.get).toHaveBeenCalledWith('/glossaryTerms/search', {
      params: expect.objectContaining({
        glossary: 'dictionary-id',
        parentBusinessVersion: '2',
        q: 'Dữ liệu *',
        statuses: 'Draft,Approved',
        domainIds: 'domain-id',
        ownerIds: 'owner-id',
        dataSourceTags: 'DataSource.Core',
        classificationTags: 'DataClassification.Restricted',
        sortField: 'businessVersion',
        sortOrder: 'desc',
        limit: 15,
        offset: 30,
      }),
    });
  });
});
