import type {
  EnvironmentId,
  ProviderInstanceId,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import {
  collectProviderUsageLimits,
  formatResetsIn,
  limitsNotice,
  remainingPercent,
} from "@t3tools/shared/usageLimits";
import { refreshUsageLimits } from "@t3tools/client-runtime/state/usage";
import { useEffect, useEffectEvent, useState } from "react";

import { RedactedSensitiveText } from "../components/settings/RedactedSensitiveText";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../components/ui/tooltip";
import { barColor } from "../components/usage/UsageLimits";
import { useEnvironmentSettings } from "../hooks/useSettings";
import { observeResize } from "../lib/observeResize";
import { useEnvironment } from "../state/environments";
import { EMPTY_SERVER_PROVIDERS, serverEnvironment } from "../state/server";
import { useAtomCommand } from "../state/use-atom-command";

const COUNTDOWN_TICK_MS = 60_000;

const EMPTY_USAGE_LIMIT_SOURCES: UsageLimitSourceSnapshots = [];

const compactReset = (reset: string) =>
  reset.replace(/^resets momentarily$/i, "in <1m").replace(/^resets /i, "");

// Least useful first: the bar repeats the percentage, and the reset time matters most.
const COMPACT_STEPS = ["data-no-bar", "data-no-left", "data-no-reset"] as const;

/** Keeps a row of usage windows on one line by dropping detail until it fits. */
function fitUsageWindows(row: HTMLDivElement | null) {
  const content = row?.firstElementChild;
  if (!row || !content) return;
  const fit = () => {
    for (const step of COMPACT_STEPS) row.removeAttribute(step);
    for (const step of COMPACT_STEPS) {
      if (content.getBoundingClientRect().width <= row.getBoundingClientRect().width) return;
      row.setAttribute(step, "");
    }
  };
  fit();
  return observeResize([row, content], fit);
}

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
      sources={serverConfig.usageLimitSources ?? EMPTY_USAGE_LIMIT_SOURCES}
    />
  );
}

/** Reads the same provider snapshots as Limits while the composer is visible. */
function ProviderUsageLimitsBar({
  environmentId,
  instanceId,
  sources,
}: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId;
  readonly sources: UsageLimitSourceSnapshots;
}) {
  const providers =
    useAtomValue(serverEnvironment.providersValueAtom(environmentId)) ?? EMPTY_SERVER_PROVIDERS;
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
  // oxlint-disable-next-line t3code/react-effect-budget -- owns the countdown interval and visibilitychange listener
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
  const report = collectProviderUsageLimits(instanceId, providers, sources, now);
  if (!report || (report.accounts.length === 0 && report.notices.length === 0)) return null;
  const displayNow = report.accounts.reduce(
    (latest, account) => Math.max(latest, Date.parse(account.limits.checkedAt) || now),
    now,
  );

  return (
    <section
      aria-label="Provider usage limits"
      className="surface-glass pointer-events-auto mx-[1.375rem] mt-2 flex max-h-24 items-start gap-3 overflow-y-auto rounded-xl px-2 py-1 text-xs text-muted-foreground"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {report.accounts.map((account) => {
          const notice = limitsNotice(account.limits);
          return (
            <div key={account.id} className="flex min-w-0 items-center gap-x-3 py-0.5">
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
                <TruncatedNotice text={notice} />
              ) : (
                <div ref={fitUsageWindows} className="group/usage min-w-0 flex-1 overflow-hidden">
                  <div className="flex w-max items-center gap-x-3">
                    {account.limits.windows.map((window) => {
                      const remaining = remainingPercent(window);
                      const reset = formatResetsIn(window, displayNow);
                      return (
                        <span
                          key={window.id}
                          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap"
                        >
                          <span>{window.label}</span>
                          <span
                            aria-hidden
                            className="h-1 w-6 overflow-hidden rounded-full bg-muted group-data-[no-bar]/usage:hidden"
                          >
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${remaining}%`,
                                backgroundColor: barColor(account.driver),
                              }}
                            />
                          </span>
                          <span className="font-medium text-foreground tabular-nums">
                            {remaining}%
                            <span className="group-data-[no-left]/usage:hidden"> left</span>
                          </span>
                          {reset ? (
                            <span
                              aria-label={reset}
                              className="tabular-nums group-data-[no-reset]/usage:hidden"
                            >
                              {compactReset(reset)}
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {report.notices.map((notice) => (
          <TruncatedNotice key={notice} text={notice} />
        ))}
      </div>
    </section>
  );
}

function TruncatedNotice({ text }: { readonly text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="min-w-0 truncate" />}>{text}</TooltipTrigger>
      <TooltipPopup side="top">{text}</TooltipPopup>
    </Tooltip>
  );
}
