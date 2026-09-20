import { EntityStatus } from '../generated/entity/data/glossaryTerm';
import { getAuditLogs } from '../rest/auditLogAPI';
import { getBusinessVersion } from './BusinessVersionUtils';
import {
  getApprovedCDEAuditSnapshots,
  getCDEAuditSnapshots,
} from './CDEApprovedVersionUtils';

jest.mock('../rest/auditLogAPI', () => ({ getAuditLogs: jest.fn() }));

const mockGetAuditLogs = getAuditLogs as jest.Mock;

describe('getApprovedCDEAuditSnapshots', () => {
  it('recovers an approved business version missing from entity history', async () => {
    const term = { id: 'cde-1', fullyQualifiedName: 'Data Dictionary.CDE1' };
    const event = (version: string, status: EntityStatus) => ({
      entity: JSON.stringify({
        ...term,
        entityStatus: status,
        extension: { version: version },
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
      (snapshots[0].snapshot.extension as { version: string }).version
    ).toBe('1.2');
    expect(mockGetAuditLogs).toHaveBeenCalledWith({
      entityType: 'glossaryTerm',
      entityFQN: term.fullyQualifiedName,
      limit: 200,
    });
  });

  it('returns draft and approved business versions for the All filter', async () => {
    const term = { id: 'cde-1', fullyQualifiedName: 'Data Dictionary.CDE1' };
    const legacyVersionField = ['cde', 'Version'].join('');
    const event = (
      version: string,
      status: EntityStatus,
      legacy = false
    ) => ({
      entity: JSON.stringify({
        ...term,
        entityStatus: status,
        extension: legacy
          ? { [legacyVersionField]: version }
          : { version },
      }),
    });
    mockGetAuditLogs.mockResolvedValue({
      data: [
        {
          changeEventId: 'draft-12',
          changeEvent: event('1.2', EntityStatus.Draft, true),
        },
        {
          changeEventId: 'approved-11',
          changeEvent: event('1.1', EntityStatus.Approved),
        },
        {
          changeEventId: 'approved-10',
          changeEvent: event('1.0', EntityStatus.Approved),
        },
      ],
      paging: {},
    });

    const snapshots = await getCDEAuditSnapshots(term);

    expect(
      snapshots.map(({ snapshot }) => getBusinessVersion(snapshot.extension))
    ).toEqual(['1.2', '1.1', '1.0']);
    expect(snapshots.map(({ snapshot }) => snapshot.entityStatus)).toEqual([
      EntityStatus.Draft,
      EntityStatus.Approved,
      EntityStatus.Approved,
    ]);
  });
});
