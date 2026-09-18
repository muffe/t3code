// @effect-diagnostics nodeBuiltinImport:off - Reads the checked-in workspace configuration.
import * as NodeFS from "node:fs";

import * as Schema from "effect/Schema";
import { expect, it } from "vite-plus/test";

import { fromYaml } from "@t3tools/shared/schemaYaml";
import { CliArchiveWorkspaceConfig } from "./build-cli-archive.ts";

it("accepts the checked-in workspace configuration used to stage runtime externals", () => {
  const workspaceConfig = NodeFS.readFileSync(
    new URL("../pnpm-workspace.yaml", import.meta.url),
    "utf8",
  );

  expect(() =>
    Schema.decodeSync(fromYaml(CliArchiveWorkspaceConfig))(workspaceConfig),
  ).not.toThrow();
});
