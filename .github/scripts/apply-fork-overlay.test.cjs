const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { applyForkOverlay } = require("./apply-fork-overlay.cjs");
const scriptPath = path.join(__dirname, "apply-fork-overlay.cjs");

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

test("reapplies the fork settings search extension to upstream source", () => {
  const upstream = `import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { commandLabel } from "./KeybindingsSettings.logic";

export const SETTINGS_SEARCH_ITEMS = [
  {
    id: "archive",
    title: "Archived threads",
    to: "/settings/archived",
  },
] as const satisfies ReadonlyArray<SettingsSearchItem>;
`;

  assert.equal(
    applyForkOverlay("apps/web/src/components/settings/settingsSearch.ts", upstream),
    `import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";
import { FORK_SETTINGS_SEARCH_ITEMS } from "../../fork/settingsSearch";
import { commandLabel } from "./KeybindingsSettings.logic";

export const SETTINGS_SEARCH_ITEMS = [
  {
    id: "archive",
    title: "Archived threads",
    to: "/settings/archived",
  },
  ...FORK_SETTINGS_SEARCH_ITEMS,
] as const satisfies ReadonlyArray<SettingsSearchItem>;
`,
  );
});

test("reapplies the fork chat footer to upstream source", () => {
  const upstream = `import { usageLimitsBannerItem } from "./chat/ComposerUsageLimits";
import { derivePendingRequests } from "@t3tools/client-runtime/pending-requests";

export function ChatView() {
  return (
                    <ComposerSurface.Shell>
                      <ComposerSurface.Host />
                    </ComposerSurface.Shell>
                    <div aria-hidden className="composer-safe-area" />
  );
}
`;

  assert.equal(
    applyForkOverlay("apps/web/src/components/ChatView.tsx", upstream),
    `import { usageLimitsBannerItem } from "./chat/ComposerUsageLimits";
import { ForkChatFooter } from "../fork/ChatFooter";
import { derivePendingRequests } from "@t3tools/client-runtime/pending-requests";

export function ChatView() {
  return (
                    <ComposerSurface.Shell>
                      <ComposerSurface.Host />
                    </ComposerSurface.Shell>
                    <ForkChatFooter
                      environmentId={environmentId}
                      instanceId={activeProviderInstanceId}
                    />
                    <div aria-hidden className="composer-safe-area" />
  );
}
`,
  );
});

test("reapplies the fork desktop preload bridge", () => {
  const upstream = `import { contextBridge, ipcRenderer } from "electron";

import * as IpcChannels from "./ipc/channels.ts";

contextBridge.exposeInMainWorld("desktopBridge", {
  probeRemoteEditors: () => ipcRenderer.invoke(IpcChannels.PROBE_REMOTE_EDITORS_CHANNEL),
  pasteAsText: () => ipcRenderer.invoke(IpcChannels.PASTE_AS_TEXT_CHANNEL),
});
`;

  assert.equal(
    applyForkOverlay("apps/desktop/src/preload.ts", upstream),
    `import { contextBridge, ipcRenderer } from "electron";

import { forkDesktopBridge } from "./fork/preloadBridge.ts";
import * as IpcChannels from "./ipc/channels.ts";

contextBridge.exposeInMainWorld("desktopBridge", {
  probeRemoteEditors: () => ipcRenderer.invoke(IpcChannels.PROBE_REMOTE_EDITORS_CHANNEL),
  ...forkDesktopBridge,
  pasteAsText: () => ipcRenderer.invoke(IpcChannels.PASTE_AS_TEXT_CHANNEL),
});
`,
  );
});

test("reapplies the fork desktop bridge contract", () => {
  const upstream = `import type {
  SourceControlRepositoryInfo,
} from "./sourceControl.ts";
import type {
  DesktopAppActivationRequest,
} from "./desktopAppActivation.ts";

export interface ContextMenuItem<T extends string = string> {
  id: T;
}

export interface DesktopBridge {
  openExternal: (url: string) => Promise<boolean>;
}
`;

  assert.equal(
    applyForkOverlay("packages/contracts/src/ipc.ts", upstream),
    `import type {
  SourceControlRepositoryInfo,
} from "./sourceControl.ts";
import type { ForkDesktopBridge } from "./forkDesktop.ts";
import type {
  DesktopAppActivationRequest,
} from "./desktopAppActivation.ts";

export * from "./forkDesktop.ts";

export interface ContextMenuItem<T extends string = string> {
  id: T;
}

export interface DesktopBridge extends ForkDesktopBridge {
  openExternal: (url: string) => Promise<boolean>;
}
`,
  );
});

test("applying an overlay twice is a no-op", () => {
  const upstream = `import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";

export const SETTINGS_SEARCH_ITEMS = [
] as const satisfies ReadonlyArray<SettingsSearchItem>;
`;
  const once = applyForkOverlay("apps/web/src/components/settings/settingsSearch.ts", upstream);

  assert.equal(applyForkOverlay("apps/web/src/components/settings/settingsSearch.ts", once), once);
});

test("rejects unsupported conflicts and recognizable files with missing anchors", () => {
  assert.throws(
    () => applyForkOverlay("apps/web/src/components/Unknown.tsx", ""),
    /unsupported path/,
  );
  assert.throws(
    () => applyForkOverlay("apps/desktop/src/preload.ts", ""),
    /missing desktop IPC imports/,
  );
});

test("--check reports fork overlay drift", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-overlay-check-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const relativePath = "apps/web/src/components/settings/settingsSearch.ts";
  fs.mkdirSync(path.join(root, path.dirname(relativePath)), { recursive: true });
  fs.writeFileSync(
    path.join(root, relativePath),
    `import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";

export const SETTINGS_SEARCH_ITEMS = [
] as const satisfies ReadonlyArray<SettingsSearchItem>;
`,
  );

  const result = spawnSync(process.execPath, [scriptPath, "--check", relativePath], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /fork overlay drift/);
});

test("--write resolves a known conflict from upstream and stages the result", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-overlay-write-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const relativePath = "apps/web/src/components/settings/settingsSearch.ts";
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Fork Overlay Test");
  git(root, "config", "user.email", "fork-overlay@example.com");
  const source = (
    title,
    overlay = false,
  ) => `import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";
${overlay ? 'import { FORK_SETTINGS_SEARCH_ITEMS } from "../../fork/settingsSearch";\n' : ""}
export const SETTINGS_SEARCH_ITEMS = [
  { title: "${title}" },
${overlay ? "  ...FORK_SETTINGS_SEARCH_ITEMS,\n" : ""}] as const satisfies ReadonlyArray<SettingsSearchItem>;
`;
  fs.writeFileSync(absolutePath, source("base"));
  git(root, "add", relativePath);
  git(root, "commit", "-m", "base");
  git(root, "checkout", "-b", "upstream");
  fs.writeFileSync(absolutePath, source("upstream"));
  git(root, "commit", "-am", "upstream change");
  git(root, "checkout", "main");
  fs.writeFileSync(absolutePath, source("base", true));
  git(root, "commit", "-am", "fork change");
  const merge = spawnSync("git", ["merge", "upstream"], { cwd: root, encoding: "utf8" });
  assert.equal(merge.status, 1);

  const result = spawnSync(process.execPath, [scriptPath, "--write"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(absolutePath, "utf8"), source("upstream", true));
  assert.equal(git(root, "diff", "--name-only", "--diff-filter=U"), "");
  assert.equal(git(root, "diff", "--cached", "--name-only"), `${relativePath}\n`);
});

test("--write retires the temporary msgpackr build fix when upstream removes it", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-overlay-msgpackr-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const relativePath = "pnpm-workspace.yaml";
  const absolutePath = path.join(root, relativePath);
  const source = (msgpackrLine) => `allowBuilds:
  electron: true
${msgpackrLine}  sharp: true
`;
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Fork Overlay Test");
  git(root, "config", "user.email", "fork-overlay@example.com");
  fs.writeFileSync(absolutePath, source("  msgpackr-extract: set this to true or false\n"));
  git(root, "add", relativePath);
  git(root, "commit", "-m", "base");
  git(root, "checkout", "-b", "upstream");
  fs.writeFileSync(absolutePath, source(""));
  git(root, "commit", "-am", "remove placeholder");
  git(root, "checkout", "main");
  fs.writeFileSync(absolutePath, source("  msgpackr-extract: true\n"));
  git(root, "commit", "-am", "fix placeholder");
  const merge = spawnSync("git", ["merge", "upstream"], { cwd: root, encoding: "utf8" });
  assert.equal(merge.status, 1);

  const result = spawnSync(process.execPath, [scriptPath, "--write"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(absolutePath, "utf8"), source(""));
  assert.equal(git(root, "diff", "--name-only", "--diff-filter=U"), "");
  assert.equal(git(root, "diff", "--cached", "--name-only"), `${relativePath}\n`);
});

test("--write refuses to discard fork changes outside the overlay", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-overlay-guard-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const relativePath = "apps/web/src/components/settings/settingsSearch.ts";
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Fork Overlay Test");
  git(root, "config", "user.email", "fork-overlay@example.com");
  const source = (
    title,
    overlay = false,
  ) => `import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";
${overlay ? 'import { FORK_SETTINGS_SEARCH_ITEMS } from "../../fork/settingsSearch";\n' : ""}
export const SETTINGS_SEARCH_ITEMS = [
  { title: "${title}" },
${overlay ? "  ...FORK_SETTINGS_SEARCH_ITEMS,\n" : ""}] as const satisfies ReadonlyArray<SettingsSearchItem>;
`;
  fs.writeFileSync(absolutePath, source("base"));
  git(root, "add", relativePath);
  git(root, "commit", "-m", "base");
  git(root, "checkout", "-b", "upstream");
  fs.writeFileSync(absolutePath, source("upstream"));
  git(root, "commit", "-am", "upstream change");
  git(root, "checkout", "main");
  fs.writeFileSync(absolutePath, source("fork-only change", true));
  git(root, "commit", "-am", "fork change");
  const merge = spawnSync("git", ["merge", "upstream"], { cwd: root, encoding: "utf8" });
  assert.equal(merge.status, 1);

  const result = spawnSync(process.execPath, [scriptPath, "--write"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /outside the fork overlay/);
  assert.equal(git(root, "diff", "--name-only", "--diff-filter=U"), `${relativePath}\n`);
});
