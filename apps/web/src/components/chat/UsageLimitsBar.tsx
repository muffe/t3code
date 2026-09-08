import type {
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
import { useMemo, useState } from "react";

import { RedactedSensitiveText } from "../settings/RedactedSensitiveText";
import { barColor } from "../usage/UsageLimits";

/** Reads the same provider snapshots as Limits, without polling from the composer. */
export function UsageLimitsBar({
  instanceId,
  providers,
  sources,
}: {
  readonly instanceId: ProviderInstanceId;
  readonly providers: readonly ServerProvider[];
  readonly sources: UsageLimitSourceSnapshots;
}) {
  const [openedAt] = useState(() => Date.now());
  const report = useMemo(
    () => collectProviderUsageLimits(instanceId, providers, sources, openedAt),
    [instanceId, providers, sources, openedAt],
  );
  if (!report || (report.accounts.length === 0 && report.notices.length === 0)) return null;
  // Advance countdowns with fresh snapshots instead of running a repaint timer.
  const now = report.accounts.reduce(
    (latest, account) => Math.max(latest, Date.parse(account.limits.checkedAt) || openedAt),
    openedAt,
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
            <div key={account.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-0.5">
              {report.accounts.length > 1 ? (
                <RedactedSensitiveText
                  value={account.displayName || account.email || account.id}
                  ariaLabel="Toggle account label visibility"
                  revealTooltip="Click to reveal account"
                  hideTooltip="Click to hide account"
                  className="max-w-32 truncate text-xs"
                />
              ) : null}
              {notice ? (
                <span>{notice}</span>
              ) : (
                account.limits.windows.map((window) => {
                  const remaining = remainingPercent(window);
                  const reset = formatResetsIn(window, now);
                  return (
                    <span key={window.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>{window.label}</span>
                      <span aria-hidden className="h-1 w-10 overflow-hidden rounded-full bg-muted">
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
                      {reset ? <span className="tabular-nums">{reset}</span> : null}
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
