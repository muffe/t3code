import type { DesktopBridge, DesktopThreadNotificationTarget } from "@t3tools/contracts";
import { ipcRenderer, webUtils, type IpcRendererEvent } from "electron";

import * as IpcChannels from "../ipc/channels.ts";

function isThreadNotificationTarget(value: unknown): value is DesktopThreadNotificationTarget {
  if (typeof value !== "object" || value === null) return false;
  const { environmentId, threadId } = value as { environmentId?: unknown; threadId?: unknown };
  return typeof environmentId === "string" && typeof threadId === "string";
}

export const forkDesktopBridge = {
  showThreadNotification: (input) =>
    ipcRenderer.invoke(IpcChannels.SHOW_THREAD_NOTIFICATION_CHANNEL, input),
  setAttentionBadgeCount: (count) =>
    ipcRenderer.invoke(IpcChannels.SET_ATTENTION_BADGE_COUNT_CHANNEL, count),
  onThreadNotificationClick: (listener) => {
    const wrappedListener = (_event: IpcRendererEvent, target: unknown) => {
      if (isThreadNotificationTarget(target)) listener(target);
    };
    ipcRenderer.on(IpcChannels.THREAD_NOTIFICATION_CLICK_CHANNEL, wrappedListener);
    return () => {
      ipcRenderer.removeListener(IpcChannels.THREAD_NOTIFICATION_CLICK_CHANNEL, wrappedListener);
    };
  },
  getPathForDroppedFile: (file) => {
    try {
      const path = webUtils.getPathForFile(file);
      return path.length > 0 ? path : null;
    } catch {
      return null;
    }
  },
} satisfies Pick<
  DesktopBridge,
  | "showThreadNotification"
  | "setAttentionBadgeCount"
  | "onThreadNotificationClick"
  | "getPathForDroppedFile"
>;
