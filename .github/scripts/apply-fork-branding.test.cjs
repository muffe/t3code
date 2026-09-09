const assert = require("node:assert/strict");
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

test("fails loudly when upstream changes the insertion point", () => {
  assert.throws(() => applyForkBranding("<span>Version changed</span>"), /expected About copy/);
});

test("does not duplicate the fork label when applied twice", () => {
  const source = `<code className="text-[11px] font-medium text-muted-foreground">{APP_VERSION}</code>`;
  const branded = applyForkBranding(`      ${source}`);

  assert.equal(applyForkBranding(branded), branded);
});
