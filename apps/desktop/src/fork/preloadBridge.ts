import type { DesktopBridge } from "@t3tools/contracts";
import { webUtils } from "electron";

export const forkDesktopBridge = {
  getPathForDroppedFile: (file) => {
    try {
      const path = webUtils.getPathForFile(file);
      return path.length > 0 ? path : null;
    } catch {
      return null;
    }
  },
} satisfies Pick<DesktopBridge, "getPathForDroppedFile">;
