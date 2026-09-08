import * as NodeChildProcess from "node:child_process";
import * as NodeHttp from "node:http";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeModule from "node:module";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { signForkMacApp } from "./sign-fork-macos.ts";

// Exercise the actual Electron/Squirrel install and relaunch with this build's
// certificate. This fixture avoids opening T3 or accessing any provider data.
const requireDesktop = NodeModule.createRequire(
  new URL("../apps/desktop/package.json", import.meta.url),
);
const electronApp = NodePath.resolve(requireDesktop("electron"), "../../..");
const directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "fork-update-test-"));
let succeed;
let fail;
const completed = new Promise((resolve, reject) => {
  succeed = resolve;
  fail = reject;
});
const archive = NodePath.join(directory, "update.zip");
const server = NodeHttp.createServer((request, response) => {
  if (request.url === "/update.zip") {
    response.setHeader("Content-Type", "application/zip");
    NodeFS.createReadStream(archive).pipe(response);
  } else if (request.url === "/success") {
    response.end("ok");
    succeed();
  } else {
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ url: `${origin}/update.zip` }));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let child;
let timer;
let removedTrust = false;
const certificate = NodePath.join(process.env.RUNNER_TEMP, "fork-signing.pem");
try {
  for (const version of ["1.0.0", "1.0.1"]) {
    const app = NodePath.join(directory, version, "Fork Update Probe.app");
    await NodeFSP.mkdir(NodePath.dirname(app), { recursive: true });
    NodeChildProcess.execFileSync("ditto", [electronApp, app]);
    const plist = NodePath.join(app, "Contents/Info.plist");
    for (const [key, value] of Object.entries({
      CFBundleIdentifier: "dev.muffe.t3code.update-probe",
      CFBundleName: "Fork Update Probe",
      CFBundleVersion: version,
      CFBundleShortVersionString: version,
    })) {
      NodeChildProcess.execFileSync("/usr/libexec/PlistBuddy", [
        "-c",
        `Set :${key} ${value}`,
        plist,
      ]);
    }
    const resources = NodePath.join(app, "Contents/Resources/app");
    await NodeFSP.mkdir(resources, { recursive: true });
    await NodeFSP.writeFile(
      NodePath.join(resources, "package.json"),
      JSON.stringify({ name: "fork-update-probe", version, main: "main.cjs" }),
    );
    await NodeFSP.writeFile(
      NodePath.join(resources, "main.cjs"),
      `
      const { app, autoUpdater } = require('electron');
      const http = require('node:http');
      app.setPath('userData', ${JSON.stringify(NodePath.join(directory, "userdata"))});
      app.whenReady().then(() => {
        if (app.getVersion() === '1.0.1') {
          http.get(${JSON.stringify(`${origin}/success`)}, response => {
            response.resume();
            response.on('end', () => app.quit());
          }).on('error', error => { console.error(error); app.exit(1); });
        } else {
          autoUpdater.on('error', error => { console.error(error); app.exit(1); });
          autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall());
          autoUpdater.setFeedURL({ url: ${JSON.stringify(origin)} });
          autoUpdater.checkForUpdates();
        }
      });
    `,
    );
    console.log(`Signing update probe ${version}`);
    await signForkMacApp(app);
    console.log(`Signed update probe ${version}`);
    if (version === "1.0.1") {
      console.log("Creating update ZIP");
      NodeChildProcess.execFileSync(
        "ditto",
        ["-c", "-k", "--zlibCompressionLevel", "0", "--keepParent", app, archive],
        { timeout: 120_000, stdio: "inherit" },
      );
      console.log("Created update ZIP");
    }
  }
  // The installed app must authenticate updates without the build runner's
  // explicit trust setting. Restore it afterwards for packaging T3 itself.
  console.log("Removing explicit certificate trust");
  NodeChildProcess.execFileSync(
    "sudo",
    [
      "-n",
      "security",
      "add-trusted-cert",
      "-d",
      "-r",
      "unspecified",
      "-p",
      "codeSign",
      "-k",
      process.env.T3CODE_FORK_MAC_SIGNING_KEYCHAIN,
      certificate,
    ],
    { timeout: 30_000, stdio: "inherit" },
  );
  removedTrust = true;
  const identities = NodeChildProcess.execFileSync(
    "security",
    ["find-identity", "-v", "-p", "codesigning", process.env.T3CODE_FORK_MAC_SIGNING_KEYCHAIN],
    { encoding: "utf8", timeout: 30_000 },
  );
  if (!identities.includes("0 valid identities found")) {
    throw new Error(`Update probe still has a trusted signing identity: ${identities}`);
  }
  console.log("Starting native update without explicit certificate trust");
  child = NodeChildProcess.spawn(
    NodePath.join(directory, "1.0.0/Fork Update Probe.app/Contents/MacOS/Electron"),
    [],
    {
      stdio: "inherit",
    },
  );
  child.on("error", fail);
  child.on("exit", (code) => {
    if (code) fail(new Error(`Update probe exited ${code}`));
  });
  timer = setTimeout(
    () => fail(new Error("Squirrel update/relaunch timed out after 120 seconds")),
    120_000,
  );
  await completed;
  console.log(
    "PASS: self-signed Electron 1.0.0 updated and relaunched as 1.0.1 through Squirrel.Mac.",
  );
} finally {
  clearTimeout(timer);
  if (child && child.exitCode === null) child.kill();
  server.closeAllConnections();
  server.close();
  if (removedTrust) {
    NodeChildProcess.execFileSync(
      "sudo",
      [
        "-n",
        "security",
        "add-trusted-cert",
        "-d",
        "-r",
        "trustRoot",
        "-p",
        "codeSign",
        "-k",
        process.env.T3CODE_FORK_MAC_SIGNING_KEYCHAIN,
        certificate,
      ],
      { timeout: 30_000, stdio: "inherit" },
    );
  }
}
