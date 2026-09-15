import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";

import { ClientSettingsPatch, ClientSettingsSchema } from "./settings.ts";

const decodeClientSettings = Schema.decodeUnknownSync(ClientSettingsSchema);
const decodeClientSettingsPatch = Schema.decodeUnknownSync(ClientSettingsPatch);

describe("ClientSettings desktop attention", () => {
  it("disables native attention signals by default", () => {
    const settings = decodeClientSettings({});
    expect(settings.desktopNotificationsEnabled).toBe(false);
    expect(settings.desktopAttentionBadgeEnabled).toBe(false);
  });

  it("accepts explicit opt-in desktop attention patches", () => {
    expect(
      decodeClientSettingsPatch({
        desktopNotificationsEnabled: true,
        desktopAttentionBadgeEnabled: true,
      }),
    ).toMatchObject({
      desktopNotificationsEnabled: true,
      desktopAttentionBadgeEnabled: true,
    });
  });
});
