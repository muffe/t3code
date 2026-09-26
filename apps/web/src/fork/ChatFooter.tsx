import type {
  EnvironmentId,
  ProviderInstanceId,
  ServerProvider,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import {
  collectProviderUsageLimits,
  formatResetsIn,
  limitsNotice,
  remainingPercent,
} from "@t3tools/shared/usageLimits";
import { refreshUsageLimits } from "@t3tools/client-runtime/state/usage";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import { RedactedSensitiveText } from "../components/settings/RedactedSensitiveText";
import { barColor } from "../components/usage/UsageLimits";
import { useEnvironmentSettings } from "../hooks/useSettings";
import { useEnvironment } from "../state/environments";
import { serverEnvironment } from "../state/server";
import { useAtomCommand } from "../state/use-atom-command";

const COUNTDOWN_TICK_MS = 60_000;

const EMPTY_USAGE_LIMIT_SOURCES: UsageLimitSourceSnapshots = [];

export function ForkChatFooter({
  environmentId,
  instanceId,
}: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId | null;
}) {
  const enabled = useEnvironmentSettings(environmentId, (settings) => settings.showUsageLimitsBar);
  const environment = useEnvironment(environmentId);
  const serverConfig = environment?.serverConfig ?? null;

  if (
    !enabled ||
    instanceId === null ||
    environment?.connection.phase !== "connected" ||
    serverConfig === null
  ) {
    return null;
  }

  return (
    <ProviderUsageLimitsBar
      key={`${environmentId}:${instanceId}`}
      environmentId={environmentId}
      instanceId={instanceId}
      providers={serverConfig.providers}
      sources={serverConfig.usageLimitSources ?? EMPTY_USAGE_LIMIT_SOURCES}
    />
  );
}

/** Reads the same provider snapshots as Limits while the composer is visible. */
function ProviderUsageLimitsBar({
  environmentId,
  instanceId,
  providers,
  sources,
}: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId;
  readonly providers: readonly ServerProvider[];
  readonly sources: UsageLimitSourceSnapshots;
}) {
  const [now, setNow] = useState(() => Date.now());
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const refresh = useEffectEvent(() => {
    void refreshUsageLimits(
      environmentId,
      () => refreshProviders({ environmentId, input: {} }),
      true,
    );
  });
  useEffect(() => {
    const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
    const tick = () => {
      if (!visible()) return;
      setNow(Date.now());
      refresh();
    };
    tick();
    const timer = setInterval(tick, COUNTDOWN_TICK_MS);
    const onVisibilityChange = () => {
      if (visible()) tick();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    return () => {
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, []);
  const report = useMemo(
    () => collectProviderUsageLimits(instanceId, providers, sources, now),
    [instanceId, providers, sources, now],
  );
  if (!report || (report.accounts.length === 0 && report.notices.length === 0)) return null;
  const displayNow = report.accounts.reduce(
    (latest, account) => Math.max(latest, Date.parse(account.limits.checkedAt) || now),
    now,
  );

  return (
    <section
      aria-label="Provider usage limits"
      className="pointer-events-auto mx-[1.375rem] mt-2 flex max-h-24 items-start gap-3 overflow-y-auto px-4 text-xs text-muted-foreground"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {report.accounts.map((account) => {
          const notice = limitsNotice(account.limits);
          return (
            <div key={account.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-0.5">
              {report.accounts.length > 1 ? (
                <RedactedSensitiveText
                  value={account.displayName || account.email || account.id}
                  ariaLabel="Toggle account label visibility"
                  revealTooltip="Click to reveal account"
                  hideTooltip="Click to hide account"
                  className="max-w-32 shrink-0 truncate text-xs"
                />
              ) : null}
              {notice ? (
                <span>{notice}</span>
              ) : (
                account.limits.windows.map((window) => {
                  const remaining = remainingPercent(window);
                  const reset = formatResetsIn(window, displayNow);
                  return (
                    <span
                      key={window.id}
                      className="flex shrink-0 items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>{window.label}</span>
                      <span aria-hidden className="h-1 w-6 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${remaining}%`,
                            backgroundColor: barColor(account.driver),
                          }}
                        />
                      </span>
                      <span className="font-medium text-foreground tabular-nums">
                        {remaining}% left
                      </span>
                      {reset ? (
                        <span aria-label={reset} className="tabular-nums">
                          {reset.replace(/^resets in /, "in ")}
                        </span>
                      ) : null}
                    </span>
                  );
                })
              )}
            </div>
          );
        })}
        {report.notices.map((notice) => (
          <span key={notice}>{notice}</span>
        ))}
      </div>
    </section>
  );
}
