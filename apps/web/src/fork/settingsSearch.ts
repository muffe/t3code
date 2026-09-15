import type { SettingsSearchItem } from "../components/settings/settingsSearch";

export const FORK_SETTINGS_SEARCH_ITEMS = [
  {
    id: "usage-limits-bar",
    title: "Show usage limits below chat",
    to: "/settings/general",
    searchTerms: ["provider quota remaining reset info bar composer usage limits"],
  },
  {
    id: "desktop-notifications",
    title: "Desktop notifications",
    to: "/settings/general",
    searchTerms: ["native operating system background finished approval input alert"],
    desktopOnly: true,
  },
  {
    id: "desktop-attention-badge",
    title: "Dock and taskbar badge",
    to: "/settings/general",
    searchTerms: ["waiting approval input attention icon count overlay"],
    desktopOnly: true,
  },
] as const satisfies ReadonlyArray<SettingsSearchItem>;
