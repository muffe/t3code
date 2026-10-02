import type { SettingsSearchItem } from "../components/settings/settingsSearch";

export const FORK_SETTINGS_SEARCH_ITEMS = [
  {
    id: "usage-limits-bar",
    title: "Show usage limits below chat",
    to: "/settings/general",
    searchTerms: ["provider quota remaining reset info bar composer usage limits"],
  },
] as const satisfies ReadonlyArray<SettingsSearchItem>;
