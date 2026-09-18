import { EntityStatus } from '../generated/entity/data/glossaryTerm';
import { getAuditLogs } from '../rest/auditLogAPI';
import { getApprovedCDEAuditSnapshots } from './CDEApprovedVersionUtils';

jest.mock('../rest/auditLogAPI', () => ({ getAuditLogs: jest.fn() }));

const mockGetAuditLogs = getAuditLogs as jest.Mock;

describe('getApprovedCDEAuditSnapshots', () => {
  it('recovers an approved business version missing from entity history', async () => {
    const term = { id: 'cde-1', fullyQualifiedName: 'Data Dictionary.CDE1' };
    const event = (version: string, status: EntityStatus) => ({
      entity: JSON.stringify({
        ...term,
        entityStatus: status,
        extension: { cdeVersion: version },
      }),
    });
    mockGetAuditLogs.mockResolvedValue({
      data: [
        {
          changeEventId: 'draft-13',
          changeEvent: event('1.3', EntityStatus.Draft),
        },
        {
          changeEventId: 'approved-12',
          changeEvent: event('1.2', EntityStatus.Approved),
        },
        {
          changeEventId: 'review-12',
          changeEvent: event('1.2', EntityStatus.InReview),
        },
      ],
      paging: {},
    });

    const snapshots = await getApprovedCDEAuditSnapshots(term);

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].eventId).toBe('approved-12');
    expect(
      (snapshots[0].snapshot.extension as { cdeVersion: string }).cdeVersion
    ).toBe('1.2');
    expect(mockGetAuditLogs).toHaveBeenCalledWith({
      entityType: 'glossaryTerm',
      entityFQN: term.fullyQualifiedName,
      limit: 200,
    });
  });
});
