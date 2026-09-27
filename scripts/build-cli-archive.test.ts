// @effect-diagnostics nodeBuiltinImport:off - Exercise the CLI against an isolated filesystem.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeChildProcess from "node:child_process";
import { expect } from "vite-plus/test";
import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { HostProcessPlatform } from "@t3tools/shared/hostProcess";

const repoRoot = NodeURL.fileURLToPath(new URL("..", import.meta.url));

// Only the dependency download is substituted. The real CLI decodes the workspace,
// stages files, strips foreign prebuilds, and invokes tar to produce the archive.
it.effect(
  "stages an archive from the real workspace config and rejects invalid build approvals",
  (context) =>
    Effect.gen(function* () {
      if ((yield* HostProcessPlatform) === "win32") return context.skip();
      yield* Effect.promise(async () => {
        const root = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-cli-archive-test-"));
        try {
          for (const dir of [
            "scripts",
            "apps/server/dist-exe",
            "apps/server/dist/client",
            "monitor",
            "bin",
          ]) {
            await NodeFSP.mkdir(NodePath.join(root, dir), { recursive: true });
          }
          for (const file of [
            "scripts/build-cli-archive.ts",
            "package.json",
            "apps/server/package.json",
          ]) {
            await NodeFSP.copyFile(NodePath.join(repoRoot, file), NodePath.join(root, file));
          }
          for (const file of [
            "node_modules",
            "scripts/node_modules",
            "scripts/lib",
            "scripts/build-desktop-artifact.ts",
            "patches",
          ]) {
            await NodeFSP.symlink(NodePath.join(repoRoot, file), NodePath.join(root, file));
          }
          await NodeFSP.writeFile(
            NodePath.join(root, "apps/server/dist-exe/t3-linux-x64"),
            "fixture executable",
          );
          await NodeFSP.writeFile(
            NodePath.join(root, "apps/server/dist/client/index.html"),
            "fixture client",
          );
          await NodeFSP.writeFile(
            NodePath.join(root, "apps/server/dist/client/index.html.map"),
            "source map",
          );
          await NodeFSP.writeFile(
            NodePath.join(root, "monitor/t3-resource-monitor"),
            "fixture monitor",
          );
          await NodeFSP.writeFile(
            NodePath.join(root, "bin/vp"),
            `#!/usr/bin/env node
import * as fs from "node:fs";
fs.copyFileSync("pnpm-workspace.yaml", process.env.T3_ARCHIVE_TEST_WORKSPACE);
for (const arch of ["linux-x64", "linux-arm64", "win32-x64"]) {
  const dir = "node_modules/node-pty/prebuilds/" + arch;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + "/pty.node", "fixture binding");
}
`,
            { mode: 0o755 },
          );
          const workspace = await NodeFSP.readFile(
            NodePath.join(repoRoot, "pnpm-workspace.yaml"),
            "utf8",
          );
          await NodeFSP.writeFile(NodePath.join(root, "pnpm-workspace.yaml"), workspace);
          const run = () =>
            NodeChildProcess.spawnSync(
              process.execPath,
              [
                NodePath.join(root, "scripts/build-cli-archive.ts"),
                "--platform",
                "linux",
                "--arch",
                "x64",
                "--version",
                "1.0.0",
                "--output-dir",
                NodePath.join(root, "release"),
                "--resource-monitor-dir",
                NodePath.join(root, "monitor"),
              ],
              {
                cwd: root,
                env: {
                  ...process.env,
                  T3_ARCHIVE_TEST_WORKSPACE: NodePath.join(root, "staged-workspace.yaml"),
                  PATH: `${NodePath.join(root, "bin")}${NodePath.delimiter}${process.env.PATH}`,
                },
                encoding: "utf8",
              },
            );
          const result = run();
          expect(result.status, result.stdout + result.stderr).toBe(0);
          const archive = NodePath.join(root, "release/t3-1.0.0-linux-x64.tar.gz");
          const listing = NodeChildProcess.spawnSync("tar", ["-tzf", archive], {
            encoding: "utf8",
          });
          expect(listing.status, listing.stderr).toBe(0);
          expect(listing.stdout).toContain("node-pty/prebuilds/linux-x64/pty.node");
          expect(listing.stdout).toContain("client/index.html");
          expect(listing.stdout).not.toMatch(
            /linux-arm64|win32-x64|index.html.map|pnpm-workspace.yaml/,
          );
          expect(
            await NodeFSP.readFile(NodePath.join(root, "staged-workspace.yaml"), "utf8"),
          ).toContain("allowBuilds:");

          await NodeFSP.unlink(NodePath.join(root, "staged-workspace.yaml"));
          await NodeFSP.writeFile(
            NodePath.join(root, "pnpm-workspace.yaml"),
            workspace.replace(
              "allowBuilds:\n",
              "allowBuilds:\n  invalid-test-package: set this to true or false\n",
            ),
          );
          expect(run().status).not.toBe(0);
          await expect(
            NodeFSP.stat(NodePath.join(root, "staged-workspace.yaml")),
          ).rejects.toThrow();
        } finally {
          await NodeFSP.rm(root, { recursive: true, force: true });
        }
      });
    }),
);
