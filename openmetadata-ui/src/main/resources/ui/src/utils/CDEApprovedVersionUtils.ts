import {
  GlossaryTerm,
  EntityStatus,
} from '../generated/entity/data/glossaryTerm';
import { getAuditLogs } from '../rest/auditLogAPI';

export interface ApprovedCDEAuditSnapshot {
  snapshot: GlossaryTerm;
  eventId: string;
}

/** Read approved business versions that session consolidation may have omitted from /versions. */
export const getApprovedCDEAuditSnapshots = async (
  term: Pick<GlossaryTerm, 'id' | 'fullyQualifiedName'>
): Promise<ApprovedCDEAuditSnapshot[]> => {
  const snapshots = new Map<string, ApprovedCDEAuditSnapshot>();
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
        if (
          snapshot?.id !== term.id ||
          snapshot.entityStatus !== EntityStatus.Approved
        ) {
          continue;
        }
        const extension = snapshot.extension as
          | { cdeVersion?: string; version?: string; phien_ban?: string }
          | undefined;
        const businessVersion = String(
          extension?.cdeVersion ??
            extension?.version ??
            extension?.phien_ban ??
            '1.0'
        );
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
