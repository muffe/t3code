// Exact integration edits on upstream-owned files. Keep feature logic in fork modules.
module.exports = {
  "apps/web/src/components/AppSidebarLayout.tsx": [
    {
      kind: "after",
      anchor: 'import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";\n',
      text: 'import {\n  DesktopProjectFolderDropOverlay,\n  useDesktopProjectFolderDrop,\n} from "./desktop/DesktopProjectFolderDrop";\n',
    },
    {
      kind: "after",
      anchor:
        "  const [sidebarWidth, setSidebarWidth] = useState(readInitialThreadSidebarWidth);\n",
      text: "  const projectFolderDrop = useDesktopProjectFolderDrop();\n",
    },
    {
      kind: "after",
      anchor: "        <Sidebar\n",
      text: "          {...projectFolderDrop.handlers}\n",
    },
    {
      kind: "after",
      anchor: "          <SidebarRail onDoubleClick={resetSidebarWidth} />\n",
      text: '          <DesktopProjectFolderDropOverlay\n            active={projectFolderDrop.active}\n            adding={projectFolderDrop.adding}\n            surface="sidebar"\n          />\n',
    },
  ],
  "apps/web/src/components/settings/SettingsPanels.tsx": [
    {
      kind: "after",
      anchor: 'import { PanelAnimationsPreview } from "./PanelAnimationsPreview";\n',
      text: 'import * as ForkSettings from "../../fork/Settings";\n',
    },
    {
      kind: "after",
      anchor:
        "  const isBackgroundActivityDirty = hasChangedBackgroundActivitySettings(settings);\n",
      text: "  const changedForkSettingLabels = ForkSettings.getChangedForkSettingLabels(settings);\n",
    },
    {
      kind: "after",
      anchor:
        '      ...(settings.confirmQuit !== DEFAULT_UNIFIED_SETTINGS.confirmQuit ? ["Quit shortcut"] : []),\n',
      text: "      ...changedForkSettingLabels,\n",
    },
    {
      kind: "after",
      anchor: "      settings.confirmQuit,\n",
      text: "      changedForkSettingLabels,\n",
    },
    {
      kind: "after",
      anchor: "      confirmQuit: DEFAULT_UNIFIED_SETTINGS.confirmQuit,\n",
      text: "      ...ForkSettings.FORK_SETTINGS_DEFAULTS,\n",
    },
    {
      kind: "before",
      anchor: '        <SettingsRow\n          {...searchableSetting("composer-rich-text")}',
      text: "        <ForkSettings.ForkUsageLimitsSettingsRow />\n\n",
    },
    {
      kind: "before",
      anchor: '      <SettingsSection id="projects-and-threads" title="Projects & threads">',
      text: "      {isElectron ? <ForkSettings.ForkDesktopAttentionSettingsSection /> : null}\n\n",
    },
  ],
  "packages/contracts/src/settings.ts": [
    {
      kind: "after",
      anchor: 'import { PullRequestMergeMethod } from "./pullRequest.ts";\n',
      text: 'import * as ForkSettings from "./forkSettings.ts";\n',
    },
    {
      kind: "after",
      anchor:
        "    Schema.withDecodingDefault(Effect.succeed(DEFAULT_QUIT_CONFIRMATION_MODE)),\n  ),\n",
      text: "  ...ForkSettings.FORK_DESKTOP_SETTINGS_FIELDS,\n",
    },
    {
      kind: "after",
      anchor:
        "  proactivePanelsEnabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),\n",
      text: "  ...ForkSettings.FORK_CHAT_SETTINGS_FIELDS,\n",
    },
    {
      kind: "after",
      anchor: "  confirmQuit: Schema.optionalKey(QuitConfirmationMode),\n",
      text: "  ...ForkSettings.FORK_DESKTOP_SETTINGS_PATCH_FIELDS,\n",
    },
    {
      kind: "after",
      anchor: "  proactivePanelsEnabled: Schema.optionalKey(Schema.Boolean),\n",
      text: "  ...ForkSettings.FORK_CHAT_SETTINGS_PATCH_FIELDS,\n",
    },
  ],
  "apps/desktop/src/ipc/DesktopIpcHandlers.ts": [
    {
      kind: "after",
      anchor:
        'import { getWslState, setWslBackendEnabled, setWslDistro, setWslOnly } from "./methods/wsl.ts";\n',
      text: 'import { installForkDesktopIpcHandlers } from "../fork/installIpcHandlers.ts";\n',
    },
    {
      kind: "after",
      anchor: "  yield* ipc.handle(probeRemoteEditors);\n",
      text: "  yield* installForkDesktopIpcHandlers();\n",
    },
  ],
  "apps/desktop/src/ipc/channels.ts": [
    {
      kind: "before",
      anchor: 'export const PICK_FOLDER_CHANNEL = "desktop:pick-folder";\n',
      text: 'export * from "../fork/channels.ts";\n\n',
    },
  ],
  "apps/web/src/routes/__root.tsx": [
    {
      kind: "after",
      anchor:
        'import { DesktopAppActivationCoordinator } from "../components/desktop/DesktopAppActivationCoordinator";\n',
      text: 'import { DesktopAttentionCoordinator } from "../components/desktop/DesktopAttentionCoordinator";\n',
    },
    {
      kind: "after",
      anchor:
        "          {primaryEnvironmentAuthenticated ? <DesktopAppActivationCoordinator /> : null}\n",
      text: "          {primaryEnvironmentAuthenticated && isElectron ? <DesktopAttentionCoordinator /> : null}\n",
    },
  ],
  "scripts/build-desktop-artifact.ts": [
    {
      kind: "after",
      anchor:
        '  if (platform === "mac") {\n    const path = yield* Path.Path;\n    const repoRoot = yield* RepoRoot;\n',
      text: '    // Personal fork certificates do not carry Apple\'s passkey entitlements.\n    const forkSigning = !signed && Boolean(process.env.T3CODE_FORK_MAC_SIGNING_IDENTITY);\n    if (forkSigning) {\n      buildConfig.afterPack = path.join(repoRoot, "scripts/sign-fork-macos.ts");\n    }\n',
    },
    {
      kind: "after",
      anchor: "    buildConfig.mac = {\n",
      text: "      ...(forkSigning ? { identity: null, notarize: false } : {}),\n",
    },
  ],
  "apps/web/src/desktopAppActivation.ts": [
    {
      kind: "replace",
      anchor:
        "      `The command path is for ${requestPlatform}, but the desktop app's primary environment uses ${target.platform}. Cross-platform path mapping is not supported.`,\n",
      text: "      `The workspace path is for ${requestPlatform}, but the desktop app's primary environment uses ${target.platform}. Use Add project to choose a path for that environment.`,\n",
    },
  ],
};
