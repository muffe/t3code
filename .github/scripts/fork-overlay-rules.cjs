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
      kind: "before",
      anchor: '        <SettingsRow\n          {...searchableSetting("composer-rich-text")}',
      text: "        <ForkSettings.ForkUsageLimitsSettingsRow />\n\n",
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
        "  proactivePanelsEnabled: Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),\n",
      text: "  ...ForkSettings.FORK_CHAT_SETTINGS_FIELDS,\n",
    },
    {
      kind: "after",
      anchor: "  proactivePanelsEnabled: Schema.optionalKey(Schema.Boolean),\n",
      text: "  ...ForkSettings.FORK_CHAT_SETTINGS_PATCH_FIELDS,\n",
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
