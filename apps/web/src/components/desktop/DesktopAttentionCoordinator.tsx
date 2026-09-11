import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { useClientSettings, useClientSettingsHydrated } from "../../hooks/useSettings";
import { useAllEnvironmentShellsBootstrapped, useThreadShells } from "../../state/entities";
import { buildThreadRouteParams } from "../../threadRoutes";
import {
  countDesktopAttentionThreads,
  indexDesktopThreadAttention,
  resolveDesktopThreadNotification,
  type DesktopThreadAttentionSnapshot,
} from "./DesktopAttentionCoordinator.logic";

export function DesktopAttentionCoordinator() {
  const navigate = useNavigate();
  const threads = useThreadShells();
  const shellsBootstrapped = useAllEnvironmentShellsBootstrapped();
  const settingsHydrated = useClientSettingsHydrated();
  const notificationsEnabled = useClientSettings(
    (settings) => settings.desktopNotificationsEnabled,
  );
  const badgeEnabled = useClientSettings((settings) => settings.desktopAttentionBadgeEnabled);
  const previousRef = useRef<ReadonlyMap<string, DesktopThreadAttentionSnapshot> | null>(null);
  const badgeCountRef = useRef<number | null>(null);
  const bridge = window.desktopBridge;

  useEffect(() => {
    const subscribe = bridge?.onThreadNotificationClick;
    if (typeof subscribe !== "function") return;
    return subscribe((target) => {
      const threadRef = scopeThreadRef(target.environmentId, target.threadId);
      void navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(threadRef),
      });
    });
  }, [bridge, navigate]);

  useEffect(() => {
    const ready = settingsHydrated && shellsBootstrapped;
    const next = ready ? indexDesktopThreadAttention(threads) : null;
    const previous = previousRef.current;
    previousRef.current = next;

    if (next !== null && previous !== null && notificationsEnabled) {
      for (const [key, current] of next) {
        const notification = resolveDesktopThreadNotification(previous.get(key), current);
        if (notification !== null) {
          void bridge?.showThreadNotification?.(notification).catch(() => undefined);
        }
      }
    }

    const badgeCount =
      next !== null && badgeEnabled ? countDesktopAttentionThreads(next.values()) : 0;
    if (badgeCountRef.current !== badgeCount) {
      badgeCountRef.current = badgeCount;
      void bridge?.setAttentionBadgeCount?.(badgeCount).catch(() => undefined);
    }
  }, [badgeEnabled, bridge, notificationsEnabled, settingsHydrated, shellsBootstrapped, threads]);

  useEffect(
    () => () => {
      void bridge?.setAttentionBadgeCount?.(0).catch(() => undefined);
    },
    [bridge],
  );

  return null;
}
