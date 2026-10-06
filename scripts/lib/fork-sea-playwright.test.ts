import { assert, describe, it } from "@effect/vitest";
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeModule from "node:module";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { Rolldown } from "vite-plus/pack";

import { findEsmImportsOfExternalPackages } from "./cli-executable-imports.ts";
import { seaPlaywrightPlugin } from "./fork-sea-playwright.ts";

describe("fork Playwright executable loading", () => {
  it("emits no file-backed ESM imports and lazily loads the staged runtime for every browser path", async () => {
    const entry = "/fixture/preview/ServerBrowserContexts.ts";
    const source = `
export async function shared() {
  const { chromium } = await import("playwright-core");
  return chromium.launch();
}
export async function persistent() {
  const { chromium } = await import("playwright-core");
  return chromium.launchPersistentContext();
}
export async function desktop() {
  const { chromium } = await import("playwright-core");
  return chromium.connectOverCDP();
}
`;
    const bundle = await Rolldown.rolldown({
      input: entry,
      external: (id) => id === "playwright-core" || NodeModule.isBuiltin(id),
      plugins: [
        {
          name: "browser-runtime-fixture",
          resolveId: (id) => (id === entry ? id : null),
          load: (id) => (id === entry ? source : null),
        },
        seaPlaywrightPlugin(),
      ],
    });
    const directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "fork-sea-playwright-"));
    try {
      const { output } = await bundle.generate({ format: "esm" });
      const chunk = output.find((entry) => entry.type === "chunk");
      assert.ok(chunk);
      assert.deepStrictEqual(findEsmImportsOfExternalPackages(chunk.code), []);
      const bundlePath = NodePath.join(directory, "browser.mjs");
      await NodeFSP.writeFile(bundlePath, chunk.code);
      const importScript = `const browser = await import(${JSON.stringify(NodeURL.pathToFileURL(bundlePath).href)});`;
      // Importing the module must not require Playwright before the first browser request.
      NodeChildProcess.execFileSync(process.execPath, ["--input-type=module", "-e", importScript]);
      const stagedPackage = NodePath.join(directory, "node_modules/playwright-core");
      await NodeFSP.mkdir(stagedPackage, { recursive: true });
      await NodeFSP.writeFile(
        NodePath.join(stagedPackage, "index.js"),
        'exports.chromium = { launch: () => "shared", launchPersistentContext: () => "persistent", connectOverCDP: () => "desktop" };',
      );
      const results = NodeChildProcess.execFileSync(process.execPath, [
        "--input-type=module",
        "-e",
        `${importScript} console.log(JSON.stringify(await Promise.all([browser.shared(), browser.persistent(), browser.desktop()])));`,
      ]);
      assert.deepStrictEqual(JSON.parse(results.toString()), ["shared", "persistent", "desktop"]);
    } finally {
      await bundle.close();
      await NodeFSP.rm(directory, { recursive: true, force: true });
    }
  });
});
