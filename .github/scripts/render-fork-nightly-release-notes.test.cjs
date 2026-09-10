const assert = require("node:assert/strict");
const test = require("node:test");
const { renderReleaseNotes } = require("./render-fork-nightly-release-notes.cjs");

test("lists changes without comparison or build details", () => {
  const notes = renderReleaseNotes({
    repository: "muffe/t3code",
    previousTag: "v1.2.3-nightly.20260908.1001",
    commits: [
      {
        subject: "fix(web): keep the composer responsive",
        sha: "abc123456789",
        shortSha: "abc1234",
      },
    ],
  });

  assert.match(notes, /## Changes/);
  assert.match(notes, /fix\(web\): keep the composer responsive/);
  assert.doesNotMatch(notes, /Compare all changes/);
  assert.doesNotMatch(notes, /Build details/);
});

test("describes a forced rebuild without inventing changes", () => {
  const notes = renderReleaseNotes({
    repository: "muffe/t3code",
    previousTag: "previous-nightly",
    commits: [],
  });

  assert.match(notes, /No non-merge commits/);
});

test("handles the first fork nightly without a comparison", () => {
  const notes = renderReleaseNotes({
    repository: "muffe/t3code",
    previousTag: "",
    commits: [],
  });

  assert.match(notes, /First automated nightly/);
  assert.doesNotMatch(notes, /Compare all changes/);
});
