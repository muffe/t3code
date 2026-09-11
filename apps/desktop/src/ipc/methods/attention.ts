import {
  DesktopAttentionBadgeCountSchema,
  DesktopThreadNotificationInputSchema,
  DesktopThreadNotificationTargetSchema,
} from "@t3tools/contracts";
import { HostProcessPlatform } from "@t3tools/shared/hostProcess";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as Electron from "electron";

import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import * as DesktopWindow from "../../window/DesktopWindow.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";
import {
  desktopAttentionBadgeDescription,
  desktopThreadNotificationBody,
} from "./attention.logic.ts";

const WINDOWS_ATTENTION_BADGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAa0lEQVR4nK2TwQ3AIAhFnYRp/igsw3wMwt1Le6EJMbTGwuFdiDwBcRgwKmRBMkAMUAOmox6jnYA94Xph+plUwB+JK7wKaHNzVglFgRwkP0gU6A+BRsFJ+bGNPkG5hfIQy89YXqSWVW75TMfccw8RM4MM3zoAAAAASUVORK5CYII=";

const liveNotifications = new Set<Electron.Notification>();

function setNativeAttentionBadge(platform: NodeJS.Platform, count: number): void {
  if (platform === "win32") {
    const icon =
      count > 0 ? Electron.nativeImage.createFromDataURL(WINDOWS_ATTENTION_BADGE_DATA_URL) : null;
    const description = count > 0 ? desktopAttentionBadgeDescription(count) : "";
    for (const window of Electron.BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.setOverlayIcon(icon, description);
    }
    return;
  }

  Electron.app.setBadgeCount(count);
}

export const showThreadNotification = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.SHOW_THREAD_NOTIFICATION_CHANNEL,
  payload: DesktopThreadNotificationInputSchema,
  result: Schema.Boolean,
  handler: Effect.fn("desktop.ipc.attention.showThreadNotification")(function* (input) {
    const electronWindow = yield* ElectronWindow.ElectronWindow;
    const desktopWindow = yield* DesktopWindow.DesktopWindow;
    const currentWindow = yield* electronWindow.currentMainOrFirst;
    if (Option.isSome(currentWindow) && currentWindow.value.isFocused()) return false;
    if (!Electron.Notification.isSupported()) return false;
    const runFork = Effect.runForkWith(yield* Effect.context<never>());

    return yield* Effect.sync(() => {
      try {
        const notification = new Electron.Notification({
          title: input.threadTitle,
          body: desktopThreadNotificationBody(input.kind),
        });
        const target = {
          environmentId: input.environmentId,
          threadId: input.threadId,
        } satisfies typeof DesktopThreadNotificationTargetSchema.Type;
        const release = () => liveNotifications.delete(notification);
        notification.once("close", release);
        notification.once("click", () => {
          release();
          runFork(
            desktopWindow.activate.pipe(
              Effect.andThen(
                electronWindow.sendAll(IpcChannels.THREAD_NOTIFICATION_CLICK_CHANNEL, target),
              ),
              Effect.ignoreCause,
            ),
          );
        });
        liveNotifications.add(notification);
        notification.show();
        return true;
      } catch {
        return false;
      }
    });
  }),
});

export const setAttentionBadgeCount = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.SET_ATTENTION_BADGE_COUNT_CHANNEL,
  payload: DesktopAttentionBadgeCountSchema,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.attention.setBadgeCount")(function* (count) {
    const platform = yield* HostProcessPlatform;
    return yield* Effect.sync(() => {
      try {
        setNativeAttentionBadge(platform, count);
      } catch {
        // Unsupported desktop integrations are soft failures: the renderer
        // still owns the durable setting and can retry on its next update.
      }
    });
  }),
});
