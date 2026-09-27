// A temporary fix must describe its exact fork delta and the upstream behavior
// that makes it unnecessary. Add passing and failing retirement fixtures before
// registering another rule; unknown fixes still require a manual merge.
const placeholder = "  msgpackr-extract: set this to true or false\n";

module.exports = [
  {
    id: "msgpackr-build-placeholder",
    path: "pnpm-workspace.yaml",
    appliesTo: (source) => source.split(placeholder).length === 2,
    apply: (source) => source.replace(placeholder, "  msgpackr-extract: true\n"),
    // The dependency must be gone entirely, not replaced by another invalid
    // allowBuilds value. This intentionally accepts only the known removal case.
    verifyUpstream: (source) => !source.includes("msgpackr-extract"),
  },
];
