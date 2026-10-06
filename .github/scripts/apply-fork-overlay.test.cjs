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

test("desktop bridge export anchor stays unique beside its schema type", () => {
  const upstream = `import type {
  DesktopAppActivationRequest,
} from "./desktopAppActivation.ts";

export interface ContextMenuItem<T extends string = string> {
  id: T;
}
export interface ContextMenuItemSchemaType {
  id: string;
}
export interface DesktopBridge {
  openExternal: (url: string) => Promise<boolean>;
}
`;

  assert.match(
    applyForkOverlay("packages/contracts/src/ipc.ts", upstream),
    /export \* from "\.\/forkDesktop\.ts";\n\nexport interface ContextMenuItem</,
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
    /missing or ambiguous desktop IPC imports/,
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

test("--audit accepts declared fork edits and rejects cleanly merged extras", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-overlay-audit-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const relativePath = "apps/web/src/components/settings/settingsSearch.ts";
  const sourcePath = path.join(root, relativePath);
  const source = `import { DEFAULT_KEYBINDINGS } from "@t3tools/shared/keybindings";

export const SETTINGS_SEARCH_ITEMS = [
] as const satisfies ReadonlyArray<SettingsSearchItem>;
`;
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Fork Overlay Test");
  git(root, "config", "user.email", "fork-overlay@example.com");
  fs.writeFileSync(sourcePath, source);
  fs.writeFileSync(path.join(root, "shared.txt"), "upstream\n");
  fs.writeFileSync(
    path.join(root, "pnpm-workspace.yaml"),
    "  msgpackr-extract: set this to true or false\n",
  );
  fs.writeFileSync(path.join(root, "AGENTS.md"), "upstream policy\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "upstream");
  const upstreamRef = git(root, "rev-parse", "HEAD").trim();

  fs.writeFileSync(sourcePath, applyForkOverlay(relativePath, source));
  fs.writeFileSync(path.join(root, "fork-owned.txt"), "fork feature\n");
  fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), "  msgpackr-extract: true\n");
  fs.writeFileSync(path.join(root, "AGENTS.md"), "fork policy\n");
  git(root, "add", ".");
  git(root, "commit", "-m", "declared fork changes");
  const audit = () =>
    spawnSync(process.execPath, [scriptPath, "--audit", upstreamRef], {
      cwd: root,
      encoding: "utf8",
    });
  assert.equal(audit().status, 0);

  fs.appendFileSync(sourcePath, "// unregistered edit\n");
  git(root, "commit", "-am", "extra overlay edit");
  const extraOverlay = audit();
  assert.equal(extraOverlay.status, 1);
  assert.match(extraOverlay.stderr, /unregistered fork changes.*settingsSearch\.ts/s);

  git(root, "reset", "--hard", "HEAD~1");
  fs.writeFileSync(path.join(root, "shared.txt"), "fork edit\n");
  git(root, "commit", "-am", "unknown shared edit");
  const unknownPath = audit();
  assert.equal(unknownPath.status, 1);
  assert.match(unknownPath.stderr, /unregistered fork changes.*shared\.txt/s);
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

const nightlyWorkflow = fs.readFileSync(
  path.join(__dirname, "../workflows/fork-nightly.yml"),
  "utf8",
);
// Exercise the workflow's actual merge block so a clean merge cannot bypass preservation.
const nightlyMergeBlock = nightlyWorkflow
  .match(/^ {10}(if ! git merge --no-ff[\s\S]*?)(?=^ {10}node .* --check)/m)[1]
  .replaceAll(
    "node .github/scripts/apply-fork-overlay.cjs",
    '"$FORK_OVERLAY_NODE" "$FORK_OVERLAY_SCRIPT"',
  );

const baseReadme = `# T3 Code\n\n${"Shared documentation.\n".repeat(12)}\nOriginal install instructions.\n`;
const forkReadme = baseReadme.replace("# T3 Code", "# T3 Code · personal fork");

for (const { name, ours, upstream, mergeFails } of [
  {
    name: "conflicting upstream README edits",
    ours: forkReadme,
    upstream: baseReadme.replace("# T3 Code", "# Official T3 Code"),
    mergeFails: true,
  },
  {
    name: "cleanly merged upstream README edits",
    ours: forkReadme,
    upstream: baseReadme.replace(
      "Original install instructions.",
      "New upstream install instructions.",
    ),
    mergeFails: false,
  },
  {
    name: "upstream-only README edits",
    ours: baseReadme,
    upstream: baseReadme.replace(
      "Original install instructions.",
      "New upstream install instructions.",
    ),
    mergeFails: false,
  },
  {
    name: "upstream README deletion with a modified fork README",
    ours: forkReadme,
    upstream: null,
    mergeFails: true,
  },
  {
    name: "clean upstream README deletion",
    ours: baseReadme,
    upstream: null,
    mergeFails: false,
  },
]) {
  test(`nightly sync preserves the fork README after ${name}`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-readme-sync-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const readmePath = path.join(root, "README.md");
    git(root, "init", "-b", "main");
    git(root, "config", "user.name", "Fork Overlay Test");
    git(root, "config", "user.email", "fork-overlay@example.com");
    fs.writeFileSync(readmePath, baseReadme);
    fs.writeFileSync(path.join(root, "shared.txt"), "base\n");
    git(root, "add", ".");
    git(root, "commit", "-m", "base");
    git(root, "checkout", "-b", "upstream");
    if (upstream === null) fs.unlinkSync(readmePath);
    else fs.writeFileSync(readmePath, upstream);
    fs.writeFileSync(path.join(root, "shared.txt"), "upstream improvement\n");
    git(root, "commit", "-am", "upstream changes");
    const upstreamRef = git(root, "rev-parse", "HEAD").trim();
    git(root, "checkout", "main");
    fs.writeFileSync(readmePath, ours);
    fs.writeFileSync(path.join(root, "fork-owned.txt"), "fork feature\n");
    git(root, "add", ".");
    git(root, "commit", "-m", "fork changes");
    const forkRef = git(root, "rev-parse", "HEAD").trim();
    const sync = () =>
      spawnSync("bash", ["-c", `set -euo pipefail\n${nightlyMergeBlock}`], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          base_sha: forkRef,
          upstream_sha: upstreamRef,
          FORK_OVERLAY_NODE: process.execPath,
          FORK_OVERLAY_SCRIPT: scriptPath,
        },
      });

    const result = sync();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.includes("CONFLICT"), mergeFails);
    const mergedRef = git(root, "rev-parse", "HEAD").trim();
    assert.equal(git(root, "show", "HEAD:README.md"), ours);
    assert.equal(fs.readFileSync(readmePath, "utf8"), ours);
    assert.equal(git(root, "show", "HEAD:shared.txt"), "upstream improvement\n");
    assert.equal(git(root, "rev-parse", "HEAD^1").trim(), forkRef);
    assert.equal(git(root, "rev-parse", "HEAD^2").trim(), upstreamRef);
    assert.equal(git(root, "status", "--porcelain"), "");
    const audit = spawnSync(process.execPath, [scriptPath, "--audit", upstreamRef], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(audit.status, 0, audit.stderr);

    // Running sync again with the same upstream must not create another commit.
    const repeated = sync();
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal(git(root, "rev-parse", "HEAD").trim(), mergedRef);
    assert.equal(git(root, "status", "--porcelain"), "");
  });
}

test("--write preserves upstream edits when restoring the fork no-projects surface", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-overlay-no-projects-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const relativePath = "apps/web/src/components/NoProjectsHero.tsx";
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  git(root, "init", "-b", "main");
  git(root, "config", "user.name", "Fork Overlay Test");
  git(root, "config", "user.email", "fork-overlay@example.com");
  const source = ({
    overlay = false,
    redundantStyles = true,
  }) => `import { ${overlay ? "ForkNoProjectsHeroSurface" : "SidebarInset"} } from "${overlay ? "../fork/NoProjectsHero" : "./ui/sidebar"}";

export function NoProjectsHero() {
  return (
    <${overlay ? "ForkNoProjectsHeroSurface" : "SidebarInset"} className="h-dvh${redundantStyles ? " bg-background text-foreground" : ""}">
      Add project
    </${overlay ? "ForkNoProjectsHeroSurface" : "SidebarInset"}>
  );
}
`;
  fs.writeFileSync(absolutePath, source({}));
  git(root, "add", relativePath);
  git(root, "commit", "-m", "base");
  git(root, "checkout", "-b", "upstream");
  fs.writeFileSync(absolutePath, source({ redundantStyles: false }));
  git(root, "commit", "-am", "remove redundant styles");
  git(root, "checkout", "main");
  fs.writeFileSync(absolutePath, source({ overlay: true }));
  git(root, "commit", "-am", "add fork surface");
  const merge = spawnSync("git", ["merge", "upstream"], { cwd: root, encoding: "utf8" });
  assert.equal(merge.status, 1);

  const result = spawnSync(process.execPath, [scriptPath, "--write"], {
    cwd: root,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    fs.readFileSync(absolutePath, "utf8"),
    source({ overlay: true, redundantStyles: false }),
  );
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

const integrationRules = require("./fork-overlay-rules.cjs");
const temporaryFixes = require("./fork-temporary-fixes.cjs");
const { resolveForkConflict } = require("./apply-fork-overlay.cjs");
const repoRoot = path.resolve(__dirname, "../..");
// Pinned upstream source exercises real integration locations, independent of
// the rule definitions. This commit is an ancestor of the fork's main branch.
const upstreamFixture = "a727d1d97690c9bb12cee5760e91cfd1aa7c017d";

// Keep the historical fixture independent of the current rule definitions,
// but remove the desktop attention integration retired in favor of upstream.
const retiredAttentionFixtureEdits = {
  "apps/web/src/components/settings/SettingsPanels.tsx": [
    "  const changedForkSettingLabels = ForkSettings.getChangedForkSettingLabels(settings);\n",
    "      ...changedForkSettingLabels,\n",
    "      changedForkSettingLabels,\n",
    "      ...ForkSettings.FORK_SETTINGS_DEFAULTS,\n",
    "      {isElectron ? <ForkSettings.ForkDesktopAttentionSettingsSection /> : null}\n\n",
  ],
  "packages/contracts/src/settings.ts": [
    "  ...ForkSettings.FORK_DESKTOP_SETTINGS_FIELDS,\n",
    "  ...ForkSettings.FORK_DESKTOP_SETTINGS_PATCH_FIELDS,\n",
  ],
};

for (const relativePath of Object.keys(integrationRules)) {
  test(`--write preserves upstream edits in ${relativePath}`, (t) => {
    const base = git(repoRoot, "show", `${upstreamFixture}:${relativePath}`);
    let ours = git(repoRoot, "show", `e8eddd930:${relativePath}`);
    for (const edit of retiredAttentionFixtureEdits[relativePath] ?? []) {
      assert.equal(ours.split(edit).length, 2);
      ours = ours.replace(edit, "");
    }
    assert.equal(applyForkOverlay(relativePath, base), ours);
    assert.equal(applyForkOverlay(relativePath, ours), ours);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-integration-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    git(root, "init", "-b", "main");
    git(root, "config", "user.name", "Fork Overlay Test");
    git(root, "config", "user.email", "fork-overlay@example.com");
    fs.writeFileSync(file, base);
    git(root, "add", relativePath);
    git(root, "commit", "-m", "base");
    git(root, "checkout", "-b", "upstream");
    // Competing edits to the first line force a real conflict. All integration
    // points below it must survive when the upstream file is reconstructed.
    const upstream = `// upstream change\n${base}`;
    fs.writeFileSync(file, upstream);
    git(root, "commit", "-am", "upstream change");
    git(root, "checkout", "main");
    fs.writeFileSync(file, `// unexpected fork change\n${ours}`);
    git(root, "commit", "-am", "fork integration plus unregistered edit");
    assert.equal(spawnSync("git", ["merge", "upstream"], { cwd: root }).status, 1);
    const rejected = spawnSync(process.execPath, [scriptPath, "--write"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /outside the fork overlay/);
    assert.notEqual(git(root, "diff", "--name-only", "--diff-filter=U"), "");

    // Supply the genuine fork side of the same unmerged index to test recovery.
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: root,
      input: ours,
      encoding: "utf8",
    }).trim();
    execFileSync("git", ["update-index", "--index-info"], {
      cwd: root,
      input: `100644 ${blob} 2\t${relativePath}\n`,
    });
    const result = spawnSync(process.execPath, [scriptPath, "--write"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(file, "utf8"), `// upstream change\n${ours}`);
    assert.equal(git(root, "diff", "--name-only", "--diff-filter=U"), "");
  });
}

test("rejects ambiguous integration anchors", () => {
  const source = 'import * as IpcChannels from "./ipc/channels.ts";\n';
  assert.throws(
    () => applyForkOverlay("apps/desktop/src/preload.ts", source + source),
    /ambiguous/,
  );
});

test("temporary fix retirement requires both the exact fork delta and an upstream fix", () => {
  const fix = temporaryFixes.find((fix) => fix.id === "msgpackr-build-placeholder");
  const base = "allowBuilds:\n  msgpackr-extract: set this to true or false\n  electron: true\n";
  const ours = fix.apply(base);
  const upstream = "allowBuilds:\n  electron: true\n  sharp: true\n";
  assert.equal(resolveForkConflict(fix.path, base, ours, upstream), upstream);
  for (const value of ["set this to true or false", "maybe", "false", "true"]) {
    const notRetired = `allowBuilds:\n  msgpackr-extract: ${value}\n`;
    assert.throws(() => resolveForkConflict(fix.path, base, ours, notRetired), /retirement check/);
  }
  assert.throws(
    () => resolveForkConflict(fix.path, base, `${ours}extra: true\n`, upstream),
    /outside the temporary fix/,
  );
  assert.throws(
    () => resolveForkConflict(fix.path, "unrecognized base", ours, upstream),
    /unsupported path/,
  );
});

test("catalog selector fix retires only after upstream handles version-qualified targets", () => {
  const fix = temporaryFixes.find((fix) => fix.id === "catalog-version-qualified-overrides");
  assert.ok(fix);
  const base = git(repoRoot, "show", "e5a2e7ed4:scripts/lib/resolve-catalog.ts");
  const ours = fix.apply(base);
  const upstream = `// upstream changes\n${ours}`;
  assert.equal(resolveForkConflict(fix.path, base, ours, upstream), upstream);
  assert.throws(() => resolveForkConflict(fix.path, base, ours, base), /retirement check/);
  assert.throws(
    () => resolveForkConflict(fix.path, base, `${ours}// unrelated fork edit\n`, upstream),
    /outside the temporary fix/,
  );
  assert.equal(fix.appliesTo(ours), false);
  assert.equal(fix.verifyUpstream(base), false);
  assert.equal(
    fix.verifyUpstream(ours.replace('targetName.indexOf("@", 1)', 'targetName.indexOf("@")')),
    false,
  );
});

test("catalog selector fix accepts upstream's equivalent package-name normalization", () => {
  const fix = temporaryFixes.find((fix) => fix.id === "catalog-version-qualified-overrides");
  const base = git(repoRoot, "show", "e5a2e7ed4:scripts/lib/resolve-catalog.ts");
  const ours = fix.apply(base);
  const upstream = base.replace(
    '      const lookupKey = catalogKey.length > 0 ? catalogKey : (name.split(">").at(-1) ?? name);\n',
    `      const selector = name.split(">").at(-1) ?? name;
      const versionIndex = selector.indexOf("@", 1);
      const packageName = versionIndex === -1 ? selector : selector.slice(0, versionIndex);
      const lookupKey = catalogKey.length > 0 ? catalogKey : packageName;
`,
  );
  assert.equal(resolveForkConflict(fix.path, base, ours, upstream), upstream);
  assert.throws(
    () =>
      resolveForkConflict(
        fix.path,
        base,
        ours,
        upstream.replace('selector.indexOf("@", 1)', 'selector.indexOf("@")'),
      ),
    /retirement check/,
  );
  assert.throws(
    () => resolveForkConflict(fix.path, base, `${ours}// unrelated fork edit\n`, upstream),
    /outside the temporary fix/,
  );
});

test("retiring a temporary fix preserves a permanent overlay in the same file", () => {
  const relativePath = "apps/desktop/src/preload.ts";
  const base = `import * as IpcChannels from "./ipc/channels.ts";
const temporaryValue = "broken";
const bridge = {
  pasteAsText: () => {},
};
`;
  const fix = {
    id: "test-only-preload-fix",
    path: relativePath,
    appliesTo: (source) => source.includes('temporaryValue = "broken"'),
    apply: (source) => source.replace('temporaryValue = "broken"', 'temporaryValue = "fork-fix"'),
    verifyUpstream: (source) => source.includes('temporaryValue = "upstream-fix"'),
  };
  temporaryFixes.push(fix);
  try {
    const ours = applyForkOverlay(relativePath, fix.apply(base));
    const upstream = base.replace('temporaryValue = "broken"', 'temporaryValue = "upstream-fix"');
    assert.equal(
      resolveForkConflict(relativePath, base, ours, upstream),
      applyForkOverlay(relativePath, upstream),
    );
    assert.throws(() => resolveForkConflict(relativePath, base, ours, base), /retirement check/);
    assert.throws(
      () => resolveForkConflict(relativePath, base, ours + "// unknown fork edit", upstream),
      /outside the temporary fix/,
    );
  } finally {
    temporaryFixes.pop();
  }
});
