import * as Effect from "effect/Effect";

import * as DesktopIpc from "../ipc/DesktopIpc.ts";
import { setAttentionBadgeCount, showThreadNotification } from "../ipc/methods/attention.ts";

export const installForkDesktopIpcHandlers = Effect.fn("desktop.ipc.installForkHandlers")(
  function* () {
    const ipc = yield* DesktopIpc.DesktopIpc;
    yield* ipc.handle(showThreadNotification);
    yield* ipc.handle(setAttentionBadgeCount);
  },
);
