// A temporary fix must describe its exact fork delta and the upstream behavior
// that makes it unnecessary. Add passing and failing retirement fixtures before
// registering another rule; unknown fixes still require a manual merge.
const obsoleteMarkdownSelector =
  "react-native-enriched-markdown@file:apps/mobile/deps/react-native-enriched-markdown-1.2.0-t3.9.tgz";
const obsoleteMarkdownApproval = `  ${obsoleteMarkdownSelector}: set this to true or false\n`;

module.exports = [
  {
    id: "obsolete-markdown-build-placeholder",
    path: "pnpm-workspace.yaml",
    appliesTo: (source) => source.split(obsoleteMarkdownApproval).length === 2,
    apply: (source) => source.replace(obsoleteMarkdownApproval, ""),
    // The replacement tarball already has approval. Retire only when upstream
    // removes the obsolete selector, rather than replacing its invalid value.
    verifyUpstream: (source) => !source.includes(obsoleteMarkdownSelector),
  },
];
