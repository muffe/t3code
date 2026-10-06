// A temporary fix must describe its exact fork delta and the upstream behavior
// that makes it unnecessary. Add passing and failing retirement fixtures before
// registering another rule; unknown fixes still require a manual merge.
const placeholder = "  msgpackr-extract: set this to true or false\n";
const catalogLookup =
  '      const lookupKey = catalogKey.length > 0 ? catalogKey : (name.split(">").at(-1) ?? name);\n';
const qualifiedCatalogLookup = `      const targetName = name.split(">").at(-1) ?? name;
      const versionIndex = targetName.indexOf("@", 1);
      const packageName = versionIndex === -1 ? targetName : targetName.slice(0, versionIndex);
      const lookupKey = catalogKey.length > 0 ? catalogKey : packageName;
`;

module.exports = [
  {
    id: "catalog-version-qualified-overrides",
    path: "scripts/lib/resolve-catalog.ts",
    appliesTo: (source) => source.split(catalogLookup).length === 2,
    apply: (source) => source.replace(catalogLookup, qualifiedCatalogLookup),
    // Retire only for this known normalization, including preservation of scoped names.
    // A different upstream implementation still needs a manual merge and behavior check.
    verifyUpstream: (source) =>
      !source.includes(catalogLookup) && source.includes(qualifiedCatalogLookup),
  },
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
