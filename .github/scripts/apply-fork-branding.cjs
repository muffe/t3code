const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const SETTINGS_SOURCE = "apps/web/src/components/settings/SettingsPanels.tsx";
const UPSTREAM_VERSION =
  '      <code className="text-[11px] font-medium text-muted-foreground">{APP_VERSION}</code>';
const FORK_VERSION = `${UPSTREAM_VERSION}
      <span className="text-[11px] text-muted-foreground">muffe/t3code fork</span>`;

function applyForkBranding(source) {
  if (source.includes(FORK_VERSION)) return source;

  if (!source.includes(UPSTREAM_VERSION)) {
    throw new Error(
      `Could not apply fork branding: ${SETTINGS_SOURCE} no longer contains the expected About copy.`,
    );
  }

  return source.replace(UPSTREAM_VERSION, FORK_VERSION);
}

function main() {
  const sourcePath = resolve(SETTINGS_SOURCE);
  const source = readFileSync(sourcePath, "utf8");
  writeFileSync(sourcePath, applyForkBranding(source));
}

if (require.main === module) main();

module.exports = { applyForkBranding };
