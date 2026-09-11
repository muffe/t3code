import { describe, expect, it } from "vite-plus/test";

import {
  desktopAttentionBadgeDescription,
  desktopThreadNotificationBody,
} from "./attention.logic.ts";

describe("desktop attention copy", () => {
  it.each([
    ["completed", "Finished working."],
    ["approval", "Waiting for your approval."],
    ["input", "Waiting for your input."],
  ] as const)("describes a %s notification", (kind, expected) => {
    expect(desktopThreadNotificationBody(kind)).toBe(expected);
  });

  it("pluralizes the taskbar badge description", () => {
    expect(desktopAttentionBadgeDescription(1)).toBe("1 thread needs attention");
    expect(desktopAttentionBadgeDescription(3)).toBe("3 threads need attention");
  });
});
