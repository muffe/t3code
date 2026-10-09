import type { DesktopAppActivationPlatform } from "@t3tools/contracts";

type DirectoryDropTransfer = Pick<DataTransfer, "items" | "types">;

function droppedEntry(item: DataTransferItem): FileSystemEntry | null {
  try {
    return typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
  } catch {
    return null;
  }
}

/** Hover can inspect item metadata, but directory entries are readable only on drop. */
export function isSingleFileDrag(dataTransfer: DirectoryDropTransfer): boolean {
  if (!Array.from(dataTransfer.types).includes("Files") || dataTransfer.items.length !== 1) {
    return false;
  }
  const item = dataTransfer.items[0];
  return item?.kind === "file";
}

export function isSingleDirectoryDrop(dataTransfer: DirectoryDropTransfer): boolean {
  return (
    isSingleFileDrag(dataTransfer) && droppedEntry(dataTransfer.items[0]!)?.isDirectory === true
  );
}

export function getSingleDroppedDirectoryFile(dataTransfer: DirectoryDropTransfer): File | null {
  if (!isSingleDirectoryDrop(dataTransfer)) return null;
  return dataTransfer.items[0]?.getAsFile() ?? null;
}

export function parseDesktopActivationPlatform(
  value: string | null,
): DesktopAppActivationPlatform | null {
  return value === "darwin" || value === "linux" || value === "win32" ? value : null;
}
