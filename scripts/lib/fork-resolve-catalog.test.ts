import { assert, describe, it } from "@effect/vitest";

import { resolveCatalogDependencies } from "./resolve-catalog.ts";

describe("fork catalog override coverage", () => {
  it("resolves named catalogs for qualified selectors and leaves concrete versions alone", () => {
    assert.deepStrictEqual(
      resolveCatalogDependencies(
        { "react-dom@^19": "catalog:react", "undici@^7": "7.16.0" },
        { react: "19.2.0" },
        "apps/server",
      ),
      { "react-dom@^19": "19.2.0", "undici@^7": "7.16.0" },
    );
  });

  it("reports the package name when a qualified target is absent from the catalog", () => {
    assert.throws(
      () => resolveCatalogDependencies({ "parent@^1>missing@^8": "catalog:" }, {}, "apps/server"),
      /Expected key 'missing' in root workspace catalog/,
    );
  });
});
