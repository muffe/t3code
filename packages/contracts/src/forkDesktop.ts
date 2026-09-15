import * as Schema from "effect/Schema";

import { EnvironmentId, ThreadId, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const DesktopThreadNotificationKindSchema = Schema.Literals([
  "completed",
  "approval",
  "input",
]);
export type DesktopThreadNotificationKind = typeof DesktopThreadNotificationKindSchema.Type;

export const DesktopThreadNotificationTargetSchema = Schema.Struct({
  environmentId: EnvironmentId,
  threadId: ThreadId,
});
export type DesktopThreadNotificationTarget = typeof DesktopThreadNotificationTargetSchema.Type;

export const DesktopThreadNotificationInputSchema = Schema.Struct({
  ...DesktopThreadNotificationTargetSchema.fields,
  threadTitle: TrimmedNonEmptyString.check(Schema.isMaxLength(200)),
  kind: DesktopThreadNotificationKindSchema,
});
export type DesktopThreadNotificationInput = typeof DesktopThreadNotificationInputSchema.Type;

export const DesktopAttentionBadgeCountSchema = Schema.Int.check(
  Schema.isBetween({ minimum: 0, maximum: 999 }),
);
export type DesktopAttentionBadgeCount = typeof DesktopAttentionBadgeCountSchema.Type;

export interface ForkDesktopBridge {
  /** Optional while older desktop shells can host a newer web client. */
  showThreadNotification?: (input: DesktopThreadNotificationInput) => Promise<boolean>;
  /** Optional while older desktop shells can host a newer web client. */
  setAttentionBadgeCount?: (count: DesktopAttentionBadgeCount) => Promise<void>;
  /** Optional while older desktop shells can host a newer web client. */
  onThreadNotificationClick?: (
    listener: (target: DesktopThreadNotificationTarget) => void,
  ) => () => void;
  /** Resolve an OS path for a dropped Electron File without exposing Node APIs. */
  getPathForDroppedFile?: (file: File) => string | null;
}
