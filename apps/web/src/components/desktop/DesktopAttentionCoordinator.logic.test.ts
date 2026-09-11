import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  countDesktopAttentionThreads,
  type DesktopThreadAttentionSnapshot,
  resolveDesktopThreadNotification,
} from "./DesktopAttentionCoordinator.logic";

function snapshot(
  overrides: Partial<DesktopThreadAttentionSnapshot> = {},
): DesktopThreadAttentionSnapshot {
  return {
    environmentId: EnvironmentId.make("local"),
    threadId: ThreadId.make("thread-1"),
    threadTitle: "Fix the sidebar",
    completedAt: null,
    archived: false,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    ...overrides,
  };
}

describe("desktop thread attention", () => {
  it("does not replay notifications for the initial shell snapshot", () => {
    expect(
      resolveDesktopThreadNotification(undefined, snapshot({ hasPendingApprovals: true })),
    ).toBeNull();
  });

  it.each([
    [{ hasPendingApprovals: true }, "approval"],
    [{ hasPendingUserInput: true }, "input"],
    [{ completedAt: "2026-09-11T10:00:00.000Z" }, "completed"],
  ] as const)("reports a new %s transition", (changes, kind) => {
    expect(resolveDesktopThreadNotification(snapshot(), snapshot(changes))?.kind).toBe(kind);
  });

  it("prioritizes an approval over completion", () => {
    expect(
      resolveDesktopThreadNotification(
        snapshot(),
        snapshot({
          completedAt: "2026-09-11T10:00:00.000Z",
          hasPendingApprovals: true,
        }),
      )?.kind,
    ).toBe("approval");
  });

  it("ignores archived transitions and counts each actionable thread once", () => {
    expect(
      resolveDesktopThreadNotification(
        snapshot(),
        snapshot({ archived: true, hasPendingUserInput: true }),
      ),
    ).toBeNull();
    expect(
      countDesktopAttentionThreads([
        snapshot({ hasPendingApprovals: true, hasPendingUserInput: true }),
        snapshot({ threadId: ThreadId.make("thread-2"), hasPendingUserInput: true }),
        snapshot({
          threadId: ThreadId.make("thread-3"),
          archived: true,
          hasPendingApprovals: true,
        }),
      ]),
    ).toBe(2);
  });

  it("caps the native badge count", () => {
    expect(
      countDesktopAttentionThreads(
        Array.from({ length: 1_001 }, (_, index) =>
          snapshot({
            threadId: ThreadId.make(`thread-${index}`),
            hasPendingApprovals: true,
          }),
        ),
      ),
    ).toBe(999);
  });
});
