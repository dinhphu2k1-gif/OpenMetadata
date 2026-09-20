import {
  GlossaryTerm,
  EntityStatus,
} from '../generated/entity/data/glossaryTerm';
import { getAuditLogs } from '../rest/auditLogAPI';
import { getBusinessVersion } from './BusinessVersionUtils';

export interface CDEAuditSnapshot {
  snapshot: GlossaryTerm;
  eventId: string;
}

const getCDEAuditSnapshotsByStatus = async (
  term: Pick<GlossaryTerm, 'id' | 'fullyQualifiedName'>,
  statuses?: Set<EntityStatus>
): Promise<CDEAuditSnapshot[]> => {
  const snapshots = new Map<string, CDEAuditSnapshot>();
  let after: string | undefined;

  do {
    const response = await getAuditLogs({
      entityType: 'glossaryTerm',
      entityFQN: term.fullyQualifiedName,
      limit: 200,
      ...(after ? { after } : {}),
    });

    for (const entry of response.data ?? []) {
      try {
        const event =
          entry.changeEvent ??
          (entry.rawEventJson ? JSON.parse(entry.rawEventJson) : undefined);
        const raw = event?.entity;
        const snapshot = (typeof raw === 'string' ? JSON.parse(raw) : raw) as
          | GlossaryTerm
          | undefined;
        if (!snapshot || snapshot.id !== term.id) {
          continue;
        }
        if (
          statuses &&
          (!snapshot.entityStatus || !statuses.has(snapshot.entityStatus))
        ) {
          continue;
        }
        const businessVersion = getBusinessVersion(snapshot.extension);
        if (!snapshots.has(businessVersion)) {
          snapshots.set(businessVersion, {
            snapshot,
            eventId: entry.changeEventId ?? String(event?.id ?? ''),
          });
        }
      } catch {
        // Older audit rows can contain a partial entity; continue to the next event.
      }
    }
    after = response.paging?.after;
  } while (after);

  return Array.from(snapshots.values());
};

/** Read the latest workflow state of every business version from audit logs. */
export const getCDEAuditSnapshots = (
  term: Pick<GlossaryTerm, 'id' | 'fullyQualifiedName'>
) => getCDEAuditSnapshotsByStatus(term);

/** Read approved business versions that session consolidation may have omitted from /versions. */
export const getApprovedCDEAuditSnapshots = (
  term: Pick<GlossaryTerm, 'id' | 'fullyQualifiedName'>
) =>
  getCDEAuditSnapshotsByStatus(term, new Set([EntityStatus.Approved]));
