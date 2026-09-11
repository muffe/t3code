import { describe, expect, it } from "vite-plus/test";

import {
  isSingleDirectoryDrop,
  parseDesktopActivationPlatform,
} from "./DesktopProjectFolderDrop.logic";

function transfer(entries: ReadonlyArray<{ kind: string; isDirectory: boolean }>) {
  const items = entries.map(({ kind, isDirectory }) => ({
    kind,
    webkitGetAsEntry: () => ({ isDirectory }),
  }));
  return {
    types: ["Files"],
    items: Object.assign(items, { length: items.length }),
  } as unknown as Pick<DataTransfer, "items" | "types">;
}

describe("desktop project folder drops", () => {
  it("accepts exactly one directory", () => {
    expect(isSingleDirectoryDrop(transfer([{ kind: "file", isDirectory: true }]))).toBe(true);
    expect(
      isSingleDirectoryDrop(
        transfer([
          { kind: "file", isDirectory: true },
          { kind: "file", isDirectory: true },
        ]),
      ),
    ).toBe(false);
  });

  it("does not claim regular file drops", () => {
    expect(isSingleDirectoryDrop(transfer([{ kind: "file", isDirectory: false }]))).toBe(false);
  });

  it("accepts only Electron activation platforms", () => {
    expect(parseDesktopActivationPlatform("win32")).toBe("win32");
    expect(parseDesktopActivationPlatform("android")).toBeNull();
  });
});
