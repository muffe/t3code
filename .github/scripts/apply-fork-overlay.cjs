#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SETTINGS_SEARCH_PATH = "apps/web/src/components/settings/settingsSearch.ts";
const CHAT_VIEW_PATH = "apps/web/src/components/ChatView.tsx";
const DESKTOP_PRELOAD_PATH = "apps/desktop/src/preload.ts";
const IPC_CONTRACT_PATH = "packages/contracts/src/ipc.ts";
const PNPM_WORKSPACE_PATH = "pnpm-workspace.yaml";
const MSGPACKR_PLACEHOLDER = "  msgpackr-extract: set this to true or false\n";
const MSGPACKR_FORK_FIX = "  msgpackr-extract: true\n";
const OVERLAY_PATHS = [
  SETTINGS_SEARCH_PATH,
  CHAT_VIEW_PATH,
  DESKTOP_PRELOAD_PATH,
  IPC_CONTRACT_PATH,
];

function insertAfter(source, anchor, addition, description) {
  if (source.includes(addition)) return source;
  const index = source.indexOf(anchor);
  if (index === -1) {
    throw new Error(`Cannot apply fork overlay: missing ${description}.`);
  }
  const insertionPoint = index + anchor.length;
  return `${source.slice(0, insertionPoint)}${addition}${source.slice(insertionPoint)}`;
}

function insertBefore(source, anchor, addition, description) {
  if (source.includes(addition)) return source;
  const index = source.indexOf(anchor);
  if (index === -1) {
    throw new Error(`Cannot apply fork overlay: missing ${description}.`);
  }
  return `${source.slice(0, index)}${addition}${source.slice(index)}`;
}

function replaceOnce(source, anchor, replacement, description) {
  if (source.includes(replacement)) return source;
  const index = source.indexOf(anchor);
  if (index === -1) {
    throw new Error(`Cannot apply fork overlay: missing ${description}.`);
  }
  return `${source.slice(0, index)}${replacement}${source.slice(index + anchor.length)}`;
}

function applySettingsSearchOverlay(source) {
  const withImport = insertAfter(
    source,
    'import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";\n',
    'import { FORK_SETTINGS_SEARCH_ITEMS } from "../../fork/settingsSearch";\n',
    "settings search import anchor",
  );
  return insertBefore(
    withImport,
    "] as const satisfies ReadonlyArray<SettingsSearchItem>;",
    "  ...FORK_SETTINGS_SEARCH_ITEMS,\n",
    "settings search catalog terminator",
  );
}

function applyChatViewOverlay(source) {
  const withImport = insertAfter(
    source,
    'import { usageLimitsBannerItem } from "./chat/ComposerUsageLimits";\n',
    'import { ForkChatFooter } from "../fork/ChatFooter";\n',
    "chat footer import anchor",
  );
  return insertAfter(
    withImport,
    "                    </ComposerSurface.Shell>\n",
    `                    <ForkChatFooter
                      environmentId={environmentId}
                      instanceId={activeProviderInstanceId}
                    />
`,
    "composer shell",
  );
}

function applyDesktopPreloadOverlay(source) {
  const withImport = insertBefore(
    source,
    'import * as IpcChannels from "./ipc/channels.ts";\n',
    'import { forkDesktopBridge } from "./fork/preloadBridge.ts";\n',
    "desktop IPC imports",
  );
  return insertBefore(
    withImport,
    "  pasteAsText:",
    "  ...forkDesktopBridge,\n",
    "desktop paste bridge",
  );
}

function applyIpcContractOverlay(source) {
  const withImport = insertBefore(
    source,
    "import type {\n  DesktopAppActivationRequest,",
    'import type { ForkDesktopBridge } from "./forkDesktop.ts";\n',
    "desktop activation imports",
  );
  const withExport = insertBefore(
    withImport,
    "export interface ContextMenuItem",
    'export * from "./forkDesktop.ts";\n\n',
    "context menu contract",
  );
  return replaceOnce(
    withExport,
    "export interface DesktopBridge {",
    "export interface DesktopBridge extends ForkDesktopBridge {",
    "desktop bridge contract",
  );
}

function applyForkOverlay(path, source) {
  if (path === SETTINGS_SEARCH_PATH) return applySettingsSearchOverlay(source);
  if (path === CHAT_VIEW_PATH) return applyChatViewOverlay(source);
  if (path === DESKTOP_PRELOAD_PATH) return applyDesktopPreloadOverlay(source);
  if (path === IPC_CONTRACT_PATH) return applyIpcContractOverlay(source);
  throw new Error(`Cannot apply fork overlay: unsupported path ${path}.`);
}

function checkForkOverlay(root, paths = OVERLAY_PATHS) {
  const drifted = [];
  for (const relativePath of paths) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    if (applyForkOverlay(relativePath, source) !== source) drifted.push(relativePath);
  }
  if (drifted.length > 0) {
    throw new Error(`fork overlay drift detected:\n${drifted.join("\n")}`);
  }
}

function resolveForkConflict(relativePath, base, ours, upstream) {
  if (relativePath === PNPM_WORKSPACE_PATH) {
    // Retire the one-night fork fix for upstream's invalid placeholder once
    // upstream removes that dependency from the build allowlist.
    const expectedOurs = replaceOnce(
      base,
      MSGPACKR_PLACEHOLDER,
      MSGPACKR_FORK_FIX,
      "msgpackr build placeholder",
    );
    if (expectedOurs !== ours) {
      throw new Error(
        `Cannot apply fork overlay: ${relativePath} has fork changes outside the temporary msgpackr fix.`,
      );
    }
    if (upstream.includes(MSGPACKR_PLACEHOLDER)) {
      throw new Error(
        `Cannot apply fork overlay: ${relativePath} still has the upstream msgpackr placeholder.`,
      );
    }
    return upstream;
  }

  const expectedOurs = applyForkOverlay(relativePath, base);
  if (expectedOurs !== ours) {
    throw new Error(
      `Cannot apply fork overlay: ${relativePath} has fork changes outside the fork overlay.`,
    );
  }
  return applyForkOverlay(relativePath, upstream);
}

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function writeForkOverlay(root) {
  const conflicted = git(root, ["diff", "--name-only", "--diff-filter=U", "-z"])
    .split("\0")
    .filter(Boolean);
  if (conflicted.length === 0) {
    throw new Error("Cannot apply fork overlay: no unmerged paths.");
  }
  for (const relativePath of conflicted) {
    if (!OVERLAY_PATHS.includes(relativePath) && relativePath !== PNPM_WORKSPACE_PATH) {
      throw new Error(`Cannot apply fork overlay: unsupported path ${relativePath}.`);
    }
  }

  const resolved = conflicted.map((relativePath) => {
    const base = git(root, ["show", `:1:${relativePath}`]);
    const ours = git(root, ["show", `:2:${relativePath}`]);
    const upstream = git(root, ["show", `:3:${relativePath}`]);
    return [relativePath, resolveForkConflict(relativePath, base, ours, upstream)];
  });
  for (const [relativePath, source] of resolved) {
    fs.writeFileSync(path.join(root, relativePath), source);
    git(root, ["add", "--", relativePath]);
  }

  const remaining = git(root, ["diff", "--name-only", "--diff-filter=U"]);
  if (remaining !== "") {
    throw new Error(`Cannot apply fork overlay: unresolved paths remain:\n${remaining}`);
  }
}

function main(args, root) {
  const [mode, ...paths] = args;
  if (mode === "--check") {
    checkForkOverlay(root, paths.length > 0 ? paths : OVERLAY_PATHS);
    return;
  }
  if (mode === "--write" && paths.length === 0) {
    writeForkOverlay(root);
    return;
  }
  throw new Error("Usage: apply-fork-overlay.cjs --check [path ...] | --write");
}

if (require.main === module) {
  try {
    main(process.argv.slice(2), process.cwd());
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = { applyForkOverlay, checkForkOverlay, writeForkOverlay };
