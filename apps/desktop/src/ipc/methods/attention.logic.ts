import type { DesktopThreadNotificationKind } from "@t3tools/contracts";

export function desktopThreadNotificationBody(kind: DesktopThreadNotificationKind): string {
  switch (kind) {
    case "approval":
      return "Waiting for your approval.";
    case "input":
      return "Waiting for your input.";
    case "completed":
      return "Finished working.";
  }
}

export function desktopAttentionBadgeDescription(count: number): string {
  return count === 1 ? "1 thread needs attention" : `${count} threads need attention`;
}
