// @effect-diagnostics nodeBuiltinImport:off - Tests exercise the bundle and staged Node runtime directly.
import { assert, it } from "@effect/vitest";
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { build } from "vite-plus/pack";

import { findEsmImportsOfExternalPackages } from "./cli-executable-imports.ts";
import { isExternalCliDependency, shouldBundleCliDependency } from "./cli-external-packages.ts";

it("loads the staged Playwright runtime lazily for shared, persistent and desktop browser contexts", async () => {
  const directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-playwright-bundle-"));
  try {
    await build({
      config: false,
      entry: [
        NodeURL.fileURLToPath(
          new URL("../../apps/server/src/preview/ServerBrowserContexts.ts", import.meta.url),
        ),
      ],
      outDir: directory,
      format: "esm",
      sourcemap: false,
      deps: {
        alwaysBundle: shouldBundleCliDependency,
        neverBundle: isExternalCliDependency,
      },
      logLevel: "silent",
    });
    const bundlePath = NodePath.join(directory, "ServerBrowserContexts.mjs");
    assert.deepStrictEqual(
      findEsmImportsOfExternalPackages(await NodeFSP.readFile(bundlePath, "utf8")),
      [],
    );
    const importScript = `const browser = await import(${JSON.stringify(NodeURL.pathToFileURL(bundlePath).href)});`;
    NodeChildProcess.execFileSync(process.execPath, ["--input-type=module", "-e", importScript]);

    // Only the disk-backed runtime is substituted; all three callers come from the real server bundle.
    const stagedPackage = NodePath.join(directory, "node_modules/playwright-core");
    await NodeFSP.mkdir(stagedPackage, { recursive: true });
    await NodeFSP.writeFile(
      NodePath.join(stagedPackage, "index.js"),
      `const context = (kind) => ({ kind, on() {}, pages: () => [], close: async () => {} });
exports.chromium = {
  launch: async () => ({ on() {}, newContext: async () => context("shared"), close: async () => {} }),
  launchPersistentContext: async () => context("persistent"),
  connectOverCDP: async () => ({ contexts: () => [{ pages: () => [{ kind: "desktop" }] }] }),
};`,
    );
    const results = NodeChildProcess.execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      `${importScript}
const contexts = new browser.ServerBrowserContexts({
  profilesDir: ${JSON.stringify(NodePath.join(directory, "profiles"))},
  executable: async () => "/fixture/chromium",
});
const shared = await contexts.contextFor("agent", "isolated");
const persistent = await contexts.contextFor("human");
const desktop = await contexts.connectDesktopPage("http://fixture");
await contexts.close();
console.log(JSON.stringify([shared.kind, persistent.kind, desktop.page.kind]));`,
    ]);
    assert.deepStrictEqual(JSON.parse(results.toString()), ["shared", "persistent", "desktop"]);
  } finally {
    await NodeFSP.rm(directory, { recursive: true, force: true });
  }
});
