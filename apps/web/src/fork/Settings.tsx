import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts";

import { SettingResetButton, SettingsRow } from "../components/settings/settingsLayout";
import { searchableSetting } from "../components/settings/settingsSearch";
import {
  useScopedSettings,
  useUpdateScopedSettings,
} from "../components/settings/useScopedSettings";
import { Switch } from "../components/ui/switch";

export function ForkUsageLimitsSettingsRow() {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();

  return (
    <SettingsRow
      {...searchableSetting("usage-limits-bar")}
      description="Show remaining provider limits and reset times below the chat composer."
      resetAction={
        settings.showUsageLimitsBar !== DEFAULT_UNIFIED_SETTINGS.showUsageLimitsBar ? (
          <SettingResetButton
            label="usage limits bar"
            onClick={() =>
              updateSettings({
                showUsageLimitsBar: DEFAULT_UNIFIED_SETTINGS.showUsageLimitsBar,
              })
            }
          />
        ) : null
      }
      control={
        <Switch
          checked={settings.showUsageLimitsBar}
          onCheckedChange={(checked) => updateSettings({ showUsageLimitsBar: Boolean(checked) })}
          aria-label="Show usage limits below chat"
        />
      }
    />
  );
}
