import type { Rolldown } from "vite-plus/pack";

/** Playwright stays on disk beside the executable, where SEA can load it through require. */
export function seaPlaywrightPlugin(): Rolldown.Plugin {
  return {
    name: "fork-sea-playwright",
    transform(source, id) {
      if (!id.replaceAll("\\", "/").endsWith("/preview/ServerBrowserContexts.ts")) return null;
      // Type queries such as `typeof import(...)` must remain TypeScript types.
      const dynamicImport = 'await import("playwright-core")';
      if (!source.includes(dynamicImport)) return null;
      return {
        code:
          'import * as ForkNodeModule from "node:module";\n' +
          "const forkRequirePlaywright = ForkNodeModule.createRequire(import.meta.url);\n" +
          source.replaceAll(
            dynamicImport,
            'await Promise.resolve().then(() => forkRequirePlaywright("playwright-core"))',
          ),
        map: null,
      };
    },
  };
}
