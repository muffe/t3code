#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SETTINGS_SEARCH_PATH = "apps/web/src/components/settings/settingsSearch.ts";
const CHAT_VIEW_PATH = "apps/web/src/components/ChatView.tsx";
const NO_PROJECTS_HERO_PATH = "apps/web/src/components/NoProjectsHero.tsx";
const DESKTOP_PRELOAD_PATH = "apps/desktop/src/preload.ts";
const IPC_CONTRACT_PATH = "packages/contracts/src/ipc.ts";
const integrationRules = require("./fork-overlay-rules.cjs");
const temporaryFixes = require("./fork-temporary-fixes.cjs");
// Fork policy and CI wiring are maintained directly instead of as source overlays.
const FORK_POLICY_PATHS = new Set([".github/workflows/ci.yml", "AGENTS.md"]);
// The fork README is kept in full, even when upstream edits merge cleanly.
const FORK_README_PATH = "README.md";
const OVERLAY_PATHS = [
  SETTINGS_SEARCH_PATH,
  CHAT_VIEW_PATH,
  NO_PROJECTS_HERO_PATH,
  DESKTOP_PRELOAD_PATH,
  IPC_CONTRACT_PATH,
  ...Object.keys(integrationRules),
];

function insertAfter(source, anchor, addition, description) {
  if (source.includes(addition)) return source;
  const index = source.indexOf(anchor);
  if (index === -1 || source.indexOf(anchor, index + anchor.length) !== -1) {
    throw new Error(`Cannot apply fork overlay: missing or ambiguous ${description}.`);
  }
  const insertionPoint = index + anchor.length;
  return `${source.slice(0, insertionPoint)}${addition}${source.slice(insertionPoint)}`;
}

function insertBefore(source, anchor, addition, description) {
  if (source.includes(addition)) return source;
  const index = source.indexOf(anchor);
  if (index === -1 || source.indexOf(anchor, index + anchor.length) !== -1) {
    throw new Error(`Cannot apply fork overlay: missing or ambiguous ${description}.`);
  }
  return `${source.slice(0, index)}${addition}${source.slice(index)}`;
}

function replaceOnce(source, anchor, replacement, description) {
  if (source.includes(replacement)) return source;
  const index = source.indexOf(anchor);
  if (index === -1 || source.indexOf(anchor, index + anchor.length) !== -1) {
    throw new Error(`Cannot apply fork overlay: missing or ambiguous ${description}.`);
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

function applyNoProjectsHeroOverlay(source) {
  const withImport = replaceOnce(
    source,
    'import { SidebarInset } from "./ui/sidebar";',
    'import { ForkNoProjectsHeroSurface } from "../fork/NoProjectsHero";',
    "no-projects surface import",
  );
  const withOpeningTag = replaceOnce(
    withImport,
    "<SidebarInset",
    "<ForkNoProjectsHeroSurface",
    "no-projects surface opening tag",
  );
  return replaceOnce(
    withOpeningTag,
    "</SidebarInset>",
    "</ForkNoProjectsHeroSurface>",
    "no-projects surface closing tag",
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
    "export interface ContextMenuItem<T extends string = string> {",
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
  if (Object.hasOwn(integrationRules, path)) {
    for (const { kind, anchor, text } of integrationRules[path]) {
      const apply = kind === "after" ? insertAfter : kind === "before" ? insertBefore : replaceOnce;
      source = apply(source, anchor, text, `${path} integration anchor`);
    }
    return source;
  }
  if (path === SETTINGS_SEARCH_PATH) return applySettingsSearchOverlay(source);
  if (path === CHAT_VIEW_PATH) return applyChatViewOverlay(source);
  if (path === NO_PROJECTS_HERO_PATH) return applyNoProjectsHeroOverlay(source);
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
  // A temporary fix may be retired only when it explains every fork edit and
  // its explicit upstream behavior check passes. Never choose upstream by path alone.
  const fixes = temporaryFixes.filter((fix) => fix.path === relativePath);
  const withOverlay = (source) =>
    OVERLAY_PATHS.includes(relativePath) ? applyForkOverlay(relativePath, source) : source;
  for (const fix of fixes) {
    if (!fix.appliesTo(base)) continue;
    if (withOverlay(fix.apply(base)) !== ours) {
      throw new Error(`Cannot retire ${fix.id}: fork changes outside the temporary fix.`);
    }
    if (!fix.verifyUpstream(upstream)) {
      throw new Error(`Cannot retire ${fix.id}: upstream has not satisfied its retirement check.`);
    }
    return withOverlay(upstream);
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

function auditForkDelta(root, upstreamRef) {
  const changedPaths = git(root, [
    "diff",
    "--no-renames",
    "--name-only",
    "--diff-filter=MDT",
    "-z",
    upstreamRef,
    "HEAD",
  ])
    .split("\0")
    .filter(Boolean);
  const unexpected = [];
  for (const relativePath of changedPaths) {
    if (FORK_POLICY_PATHS.has(relativePath) || relativePath === FORK_README_PATH) continue;
    const hasOverlay = OVERLAY_PATHS.includes(relativePath);
    const fixes = temporaryFixes.filter((candidate) => candidate.path === relativePath);
    if (!hasOverlay && fixes.length === 0) {
      unexpected.push(relativePath);
      continue;
    }
    const upstream = git(root, ["show", `${upstreamRef}:${relativePath}`]);
    const actualPath = path.join(root, relativePath);
    const actual = fs.existsSync(actualPath) ? fs.readFileSync(actualPath, "utf8") : null;
    const fix = fixes.find((candidate) => candidate.appliesTo(upstream));
    let expected = fix ? fix.apply(upstream) : upstream;
    if (hasOverlay) expected = applyForkOverlay(relativePath, expected);
    if (actual !== expected) unexpected.push(relativePath);
  }
  if (unexpected.length > 0) {
    throw new Error(`unregistered fork changes in upstream-owned files:\n${unexpected.join("\n")}`);
  }
}

function writeForkOverlay(root) {
  const conflicted = git(root, ["diff", "--name-only", "--diff-filter=U", "-z"])
    .split("\0")
    .filter(Boolean);
  if (conflicted.length === 0) {
    throw new Error("Cannot apply fork overlay: no unmerged paths.");
  }
  for (const relativePath of conflicted) {
    if (
      relativePath !== FORK_README_PATH &&
      !OVERLAY_PATHS.includes(relativePath) &&
      !temporaryFixes.some((fix) => fix.path === relativePath)
    ) {
      throw new Error(`Cannot apply fork overlay: unsupported path ${relativePath}.`);
    }
  }

  const resolved = conflicted.map((relativePath) => {
    if (relativePath === FORK_README_PATH) {
      return [relativePath, git(root, ["show", `:2:${relativePath}`])];
    }
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
  if (mode === "--audit" && paths.length === 1) {
    auditForkDelta(root, paths[0]);
    return;
  }
  if (mode === "--write" && paths.length === 0) {
    writeForkOverlay(root);
    return;
  }
  throw new Error(
    "Usage: apply-fork-overlay.cjs --check [path ...] | --audit <upstream-ref> | --write",
  );
}

if (require.main === module) {
  try {
    main(process.argv.slice(2), process.cwd());
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  applyForkOverlay,
  auditForkDelta,
  checkForkOverlay,
  writeForkOverlay,
  resolveForkConflict,
};
