import { DEFAULT_UNIFIED_SETTINGS, type UnifiedSettings } from "@t3tools/contracts";

import {
  SettingResetButton,
  SettingsRow,
  SettingsSection,
} from "../components/settings/settingsLayout";
import { searchableSetting } from "../components/settings/settingsSearch";
import {
  useScopedSettings,
  useUpdateScopedSettings,
} from "../components/settings/useScopedSettings";
import { Switch } from "../components/ui/switch";

const NO_CHANGED_SETTINGS: readonly string[] = [];
const DESKTOP_NOTIFICATION_CHANGED = ["Desktop notifications"] as const;
const DESKTOP_BADGE_CHANGED = ["Dock and taskbar badge"] as const;
const DESKTOP_ATTENTION_CHANGED = ["Desktop notifications", "Dock and taskbar badge"] as const;

export const FORK_SETTINGS_DEFAULTS = {
  desktopNotificationsEnabled: DEFAULT_UNIFIED_SETTINGS.desktopNotificationsEnabled,
  desktopAttentionBadgeEnabled: DEFAULT_UNIFIED_SETTINGS.desktopAttentionBadgeEnabled,
} satisfies Partial<UnifiedSettings>;

export function getChangedForkSettingLabels(settings: UnifiedSettings): readonly string[] {
  const notificationsChanged =
    settings.desktopNotificationsEnabled !== DEFAULT_UNIFIED_SETTINGS.desktopNotificationsEnabled;
  const badgeChanged =
    settings.desktopAttentionBadgeEnabled !== DEFAULT_UNIFIED_SETTINGS.desktopAttentionBadgeEnabled;

  if (notificationsChanged && badgeChanged) return DESKTOP_ATTENTION_CHANGED;
  if (notificationsChanged) return DESKTOP_NOTIFICATION_CHANGED;
  if (badgeChanged) return DESKTOP_BADGE_CHANGED;
  return NO_CHANGED_SETTINGS;
}

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

export function ForkDesktopAttentionSettingsSection() {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();

  return (
    <SettingsSection id="desktop-attention" title="Desktop attention">
      <SettingsRow
        {...searchableSetting("desktop-notifications")}
        description="Notify you when a background thread finishes or needs approval or input."
        resetAction={
          settings.desktopNotificationsEnabled !==
          DEFAULT_UNIFIED_SETTINGS.desktopNotificationsEnabled ? (
            <SettingResetButton
              label="desktop notifications"
              onClick={() =>
                updateSettings({
                  desktopNotificationsEnabled: DEFAULT_UNIFIED_SETTINGS.desktopNotificationsEnabled,
                })
              }
            />
          ) : null
        }
        control={
          <Switch
            checked={settings.desktopNotificationsEnabled}
            onCheckedChange={(checked) =>
              updateSettings({ desktopNotificationsEnabled: Boolean(checked) })
            }
            aria-label="Desktop notifications"
          />
        }
      />
      <SettingsRow
        {...searchableSetting("desktop-attention-badge")}
        description="Show when threads are waiting for your approval or input."
        resetAction={
          settings.desktopAttentionBadgeEnabled !==
          DEFAULT_UNIFIED_SETTINGS.desktopAttentionBadgeEnabled ? (
            <SettingResetButton
              label="dock and taskbar badge"
              onClick={() =>
                updateSettings({
                  desktopAttentionBadgeEnabled:
                    DEFAULT_UNIFIED_SETTINGS.desktopAttentionBadgeEnabled,
                })
              }
            />
          ) : null
        }
        control={
          <Switch
            checked={settings.desktopAttentionBadgeEnabled}
            onCheckedChange={(checked) =>
              updateSettings({ desktopAttentionBadgeEnabled: Boolean(checked) })
            }
            aria-label="Dock and taskbar badge"
          />
        }
      />
    </SettingsSection>
  );
}
