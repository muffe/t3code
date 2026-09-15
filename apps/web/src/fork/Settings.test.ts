import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { FORK_SETTINGS_DEFAULTS, getChangedForkSettingLabels } from "./Settings";

describe("fork settings restore", () => {
  it("reports only changed desktop attention settings", () => {
    expect(getChangedForkSettingLabels(DEFAULT_UNIFIED_SETTINGS)).toEqual([]);
    expect(
      getChangedForkSettingLabels({
        ...DEFAULT_UNIFIED_SETTINGS,
        desktopNotificationsEnabled: !DEFAULT_UNIFIED_SETTINGS.desktopNotificationsEnabled,
      }),
    ).toEqual(["Desktop notifications"]);
    expect(
      getChangedForkSettingLabels({
        ...DEFAULT_UNIFIED_SETTINGS,
        desktopAttentionBadgeEnabled: !DEFAULT_UNIFIED_SETTINGS.desktopAttentionBadgeEnabled,
      }),
    ).toEqual(["Dock and taskbar badge"]);
  });

  it("restores every fork-owned attention setting", () => {
    expect(FORK_SETTINGS_DEFAULTS).toEqual({
      desktopNotificationsEnabled: DEFAULT_UNIFIED_SETTINGS.desktopNotificationsEnabled,
      desktopAttentionBadgeEnabled: DEFAULT_UNIFIED_SETTINGS.desktopAttentionBadgeEnabled,
    });
  });
});
