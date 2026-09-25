// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { build } from "vite-plus/pack";
import { assert, it } from "vite-plus/test";

import { findEsmImportsOfExternalPackages } from "./cli-executable-imports.ts";
import { isExternalCliDependency, shouldBundleCliDependency } from "./cli-external-packages.ts";

it("bundles the Cursor credential reader without file-backed ESM imports", async () => {
  const directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-cursor-bundle-"));
  try {
    await build({
      config: false,
      entry: [
        NodeURL.fileURLToPath(
          new URL("../../apps/server/src/provider/cursorCredentialStore.ts", import.meta.url),
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
    const bundle = await NodeFSP.readFile(
      NodePath.join(directory, "cursorCredentialStore.mjs"),
      "utf8",
    );
    assert.deepStrictEqual(findEsmImportsOfExternalPackages(bundle), []);
  } finally {
    await NodeFSP.rm(directory, { recursive: true, force: true });
  }
});
