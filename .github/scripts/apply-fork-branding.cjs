const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const SETTINGS_SOURCE = "apps/web/src/components/settings/SettingsPanels.tsx";
const VERSION_LINE = /^([ \t]*)<code className="([^"\n]+)">\{APP_VERSION\}<\/code>$/gm;

function applyForkBranding(source) {
  const matches = [...source.matchAll(VERSION_LINE)];
  if (matches.length !== 1) {
    throw new Error(
      `Could not apply fork branding: ${SETTINGS_SOURCE} no longer contains the expected About copy.`,
    );
  }

  const [versionLine, indent, classes] = matches[0];
  const textSize = classes
    .split(" ")
    .find((name) => name.startsWith("text-") && name !== "text-muted-foreground");
  if (!textSize) {
    throw new Error(
      `Could not apply fork branding: ${SETTINGS_SOURCE} no longer contains the expected About copy.`,
    );
  }

  const forkLabel = `${indent}<span className="${textSize} text-muted-foreground">muffe/t3code fork</span>`;
  const afterVersion = source.slice(matches[0].index + versionLine.length);
  if (afterVersion.startsWith(`\n${forkLabel}`)) return source;

  return source.replace(versionLine, `${versionLine}\n${forkLabel}`);
}

function main() {
  const sourcePath = resolve(SETTINGS_SOURCE);
  const source = readFileSync(sourcePath, "utf8");
  writeFileSync(sourcePath, applyForkBranding(source));
}

if (require.main === module) main();

module.exports = { applyForkBranding };
