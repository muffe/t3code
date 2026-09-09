const { execFileSync } = require("node:child_process");
const { writeFileSync } = require("node:fs");

function releaseUrl(repository, tag) {
  return `https://github.com/${repository}/releases/tag/${encodeURIComponent(tag)}`;
}

function commitUrl(repository, sha) {
  return `https://github.com/${repository}/commit/${sha}`;
}

function renderReleaseNotes({ repository, previousTag, buildSha, version, commits }) {
  const shortSha = buildSha.slice(0, 7);
  const lines = [];

  if (previousTag) {
    lines.push(
      `Changes since [${previousTag}](${releaseUrl(repository, previousTag)}):`,
      "",
      "## Changes",
      "",
    );
    if (commits.length === 0) {
      lines.push("No non-merge commits. This is a rebuild of the previous source state.");
    } else {
      lines.push(
        ...commits.map(
          ({ subject, sha, shortSha: commitShortSha }) =>
            `- ${subject} ([\`${commitShortSha}\`](${commitUrl(repository, sha)}))`,
        ),
      );
    }
    lines.push(
      "",
      `[Compare all changes](https://github.com/${repository}/compare/${encodeURIComponent(previousTag)}...${buildSha})`,
    );
  } else {
    lines.push("First automated nightly published by this fork.");
  }

  lines.push(
    "",
    "## Build details",
    "",
    `- Version: \`${version}\``,
    `- Source: [\`${shortSha}\`](${commitUrl(repository, buildSha)})`,
    "- Windows x64 installer: unsigned",
    "- macOS arm64 build: self-signed and not notarized",
    "",
  );

  return lines.join("\n");
}

function readCommits(previousTag, buildSha) {
  if (!previousTag) return [];

  const output = execFileSync(
    "git",
    ["log", "--no-merges", "--format=%H%x09%h%x09%s", `${previousTag}..${buildSha}`],
    { encoding: "utf8" },
  ).trim();
  if (!output) return [];

  return output.split("\n").map((line) => {
    const [sha, shortSha, ...subjectParts] = line.split("\t");
    return { sha, shortSha, subject: subjectParts.join("\t") };
  });
}

function main() {
  const outputPath = process.argv[2];
  const { GITHUB_REPOSITORY, PREVIOUS_RELEASE_TAG, BUILD_SHA, RELEASE_VERSION } = process.env;
  if (!outputPath || !GITHUB_REPOSITORY || !BUILD_SHA || !RELEASE_VERSION) {
    throw new Error(
      "Usage: render-fork-nightly-release-notes.cjs <output-path> with GITHUB_REPOSITORY, BUILD_SHA, and RELEASE_VERSION set.",
    );
  }

  const previousTag = PREVIOUS_RELEASE_TAG || "";
  writeFileSync(
    outputPath,
    renderReleaseNotes({
      repository: GITHUB_REPOSITORY,
      previousTag,
      buildSha: BUILD_SHA,
      version: RELEASE_VERSION,
      commits: readCommits(previousTag, BUILD_SHA),
    }),
  );
}

if (require.main === module) main();

module.exports = { renderReleaseNotes };
