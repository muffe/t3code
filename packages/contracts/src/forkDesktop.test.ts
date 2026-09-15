import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { DesktopAttentionBadgeCountSchema, DesktopThreadNotificationInputSchema } from "./ipc.ts";

describe("fork desktop IPC schemas", () => {
  it("accepts a bounded notification payload", () => {
    expect(
      Schema.decodeSync(DesktopThreadNotificationInputSchema)({
        environmentId: "environment-test",
        threadId: "thread-test",
        threadTitle: "Review the nightly",
        kind: "approval",
      }),
    ).toEqual({
      environmentId: "environment-test",
      threadId: "thread-test",
      threadTitle: "Review the nightly",
      kind: "approval",
    });
  });

  it("rejects badge counts outside the desktop shell range", () => {
    const decode = Schema.decodeUnknownSync(DesktopAttentionBadgeCountSchema);

    expect(decode(999)).toBe(999);
    expect(() => decode(-1)).toThrow();
    expect(() => decode(1_000)).toThrow();
  });
});
