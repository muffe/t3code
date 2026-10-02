import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import { ClientSettingsPatch, ClientSettingsSchema } from "./settings.ts";

const decodeClientSettings = Schema.decodeUnknownSync(ClientSettingsSchema);
const decodeClientSettingsPatch = Schema.decodeUnknownSync(ClientSettingsPatch);

describe("ClientSettings fork preferences", () => {
  it("shows usage limits by default and accepts a patch to hide them", () => {
    expect(decodeClientSettings({}).showUsageLimitsBar).toBe(true);
    expect(decodeClientSettingsPatch({ showUsageLimitsBar: false })).toMatchObject({
      showUsageLimitsBar: false,
    });
  });

  it.each(["off", "notifications", "sound", "notifications-and-sound"] as const)(
    "discards retired desktop attention settings and preserves notification mode %s",
    (notificationMode) => {
      const settings = decodeClientSettings({
        notificationMode,
        desktopNotificationsEnabled: true,
        desktopAttentionBadgeEnabled: true,
        showUsageLimitsBar: false,
      });

      expect(settings.notificationMode).toBe(notificationMode);
      expect(settings.showUsageLimitsBar).toBe(false);
      expect(settings).not.toHaveProperty("desktopNotificationsEnabled");
      expect(settings).not.toHaveProperty("desktopAttentionBadgeEnabled");
    },
  );

  it("drops retired desktop attention patches", () => {
    const patch = decodeClientSettingsPatch({
      desktopNotificationsEnabled: true,
      desktopAttentionBadgeEnabled: true,
    });

    expect(patch).not.toHaveProperty("desktopNotificationsEnabled");
    expect(patch).not.toHaveProperty("desktopAttentionBadgeEnabled");
  });
});
