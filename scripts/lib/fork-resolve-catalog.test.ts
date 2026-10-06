import { assert, describe, it } from "@effect/vitest";

import { resolveCatalogDependencies } from "./resolve-catalog.ts";

describe("fork catalog override resolution", () => {
  it("resolves version-qualified targets without changing the override selectors", () => {
    assert.deepStrictEqual(
      resolveCatalogDependencies(
        {
          "undici@^8": "catalog:",
          "ws@^8": "catalog:",
          "@clerk/backend@^3": "catalog:",
          "@scope/parent@^1>undici@^8": "catalog:",
          "parent@^1>@clerk/backend@^3": "catalog:",
          "@clerk/backend": "catalog:",
          "react-dom@^19": "catalog:react",
          "undici@^7": "7.16.0",
        },
        { undici: "8.11.2", ws: "8.22.0", "@clerk/backend": "3.18.1", react: "19.2.0" },
        "apps/server",
      ),
      {
        "undici@^8": "8.11.2",
        "ws@^8": "8.22.0",
        "@clerk/backend@^3": "3.18.1",
        "@scope/parent@^1>undici@^8": "8.11.2",
        "parent@^1>@clerk/backend@^3": "3.18.1",
        "@clerk/backend": "3.18.1",
        "react-dom@^19": "19.2.0",
        "undici@^7": "7.16.0",
      },
    );
  });

  it("reports the package name when a qualified target is absent from the catalog", () => {
    assert.throws(
      () => resolveCatalogDependencies({ "parent@^1>missing@^8": "catalog:" }, {}, "apps/server"),
      /Expected key 'missing' in root workspace catalog/,
    );
  });
});
