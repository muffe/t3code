const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { applyForkBranding } = require("./apply-fork-branding.cjs");

test("marks the desktop About version as a muffe fork build", () => {
  const source = `<span>Version</span>
      <code className="text-[11px] font-medium text-muted-foreground">{APP_VERSION}</code>`;

  assert.equal(
    applyForkBranding(source),
    `<span>Version</span>
      <code className="text-[11px] font-medium text-muted-foreground">{APP_VERSION}</code>
      <span className="text-[11px] text-muted-foreground">muffe/t3code fork</span>`,
  );
});

test("brands the About version after upstream changes its typography", () => {
  const source = `<span>Version</span>
      <code className="text-2xs font-medium text-muted-foreground">{APP_VERSION}</code>`;

  assert.equal(
    applyForkBranding(source),
    `<span>Version</span>
      <code className="text-2xs font-medium text-muted-foreground">{APP_VERSION}</code>
      <span className="text-2xs text-muted-foreground">muffe/t3code fork</span>`,
  );
});

test("fails loudly when upstream changes the insertion point", () => {
  assert.throws(() => applyForkBranding("<span>Version changed</span>"), /expected About copy/);
});

test("does not duplicate the fork label when applied twice", () => {
  const source = `<code className="text-[11px] font-medium text-muted-foreground">{APP_VERSION}</code>`;
  const branded = applyForkBranding(`      ${source}`);

  assert.equal(applyForkBranding(branded), branded);
});

test("--check validates branding without changing the source", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fork-branding-check-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourcePath = path.join(root, "apps/web/src/components/settings/SettingsPanels.tsx");
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  const source =
    '      <code className="text-2xs font-medium text-muted-foreground">{APP_VERSION}</code>\n';
  fs.writeFileSync(sourcePath, source);
  const runCheck = () =>
    spawnSync(process.execPath, [path.join(__dirname, "apply-fork-branding.cjs"), "--check"], {
      cwd: root,
      encoding: "utf8",
    });

  assert.equal(runCheck().status, 0);
  assert.equal(fs.readFileSync(sourcePath, "utf8"), source);
  fs.writeFileSync(sourcePath, "About copy changed\n");
  const invalid = runCheck();
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /expected About copy/);
});
