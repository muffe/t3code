import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type {
  DesktopThreadNotificationInput,
  DesktopThreadNotificationKind,
} from "@t3tools/contracts";

export interface DesktopThreadAttentionSnapshot {
  readonly environmentId: EnvironmentThreadShell["environmentId"];
  readonly threadId: EnvironmentThreadShell["id"];
  readonly threadTitle: string;
  readonly completedAt: string | null;
  readonly archived: boolean;
  readonly hasPendingApprovals: boolean;
  readonly hasPendingUserInput: boolean;
}

export function snapshotDesktopThreadAttention(
  thread: EnvironmentThreadShell,
): DesktopThreadAttentionSnapshot {
  return {
    environmentId: thread.environmentId,
    threadId: thread.id,
    threadTitle: thread.title.slice(0, 200),
    completedAt: thread.latestTurn?.completedAt ?? null,
    archived: thread.archivedAt !== null,
    hasPendingApprovals: thread.hasPendingApprovals,
    hasPendingUserInput: thread.hasPendingUserInput,
  };
}

export function indexDesktopThreadAttention(
  threads: ReadonlyArray<EnvironmentThreadShell>,
): ReadonlyMap<string, DesktopThreadAttentionSnapshot> {
  const snapshots = new Map<string, DesktopThreadAttentionSnapshot>();
  for (const thread of threads) {
    const snapshot = snapshotDesktopThreadAttention(thread);
    snapshots.set(
      scopedThreadKey(scopeThreadRef(snapshot.environmentId, snapshot.threadId)),
      snapshot,
    );
  }
  return snapshots;
}

export function resolveDesktopThreadNotification(
  previous: DesktopThreadAttentionSnapshot | undefined,
  current: DesktopThreadAttentionSnapshot,
): DesktopThreadNotificationInput | null {
  if (previous === undefined || current.archived) return null;

  let kind: DesktopThreadNotificationKind | null = null;
  if (current.hasPendingApprovals && !previous.hasPendingApprovals) {
    kind = "approval";
  } else if (current.hasPendingUserInput && !previous.hasPendingUserInput) {
    kind = "input";
  } else if (
    !current.hasPendingApprovals &&
    !current.hasPendingUserInput &&
    current.completedAt !== null &&
    current.completedAt !== previous.completedAt
  ) {
    kind = "completed";
  }

  return kind === null
    ? null
    : {
        environmentId: current.environmentId,
        threadId: current.threadId,
        threadTitle: current.threadTitle,
        kind,
      };
}

export function countDesktopAttentionThreads(
  snapshots: Iterable<DesktopThreadAttentionSnapshot>,
): number {
  let count = 0;
  for (const snapshot of snapshots) {
    if (!snapshot.archived && (snapshot.hasPendingApprovals || snapshot.hasPendingUserInput)) {
      count += 1;
    }
  }
  return Math.min(count, 999);
}
