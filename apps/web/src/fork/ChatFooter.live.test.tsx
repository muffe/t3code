import { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  refreshProviders: vi.fn(async () => undefined),
  environment: {
    connection: { phase: "connected" },
    serverConfig: {
      providers: [
        {
          instanceId: "codex",
          driver: "codex",
          enabled: true,
          installed: true,
          version: null,
          status: "ready",
          auth: { status: "authenticated" },
          checkedAt: "2026-09-11T12:00:00Z",
          models: [],
          slashCommands: [],
          skills: [],
          usageLimits: {
            checkedAt: "2026-09-11T12:00:00Z",
            windows: [
              {
                id: "weekly",
                kind: "weekly",
                label: "Weekly",
                usedPercent: 26,
                resetsAt: "2026-09-11T12:20:00Z",
              },
            ],
          },
        },
      ],
      usageLimitSources: [],
    },
  },
}));

vi.mock("../hooks/useSettings", () => ({ useEnvironmentSettings: () => true }));
vi.mock("../state/environments", () => ({ useEnvironment: () => state.environment }));
vi.mock("../state/server", () => ({ serverEnvironment: { refreshProviders: null } }));
vi.mock("../state/use-atom-command", () => ({ useAtomCommand: () => state.refreshProviders }));

import { ForkChatFooter } from "./ChatFooter";

const environmentId = EnvironmentId.make("footer-live-test");
const instanceId = ProviderInstanceId.make("codex");
let renderer: ReactTestRenderer | undefined;
const originalEnvironment = state.environment;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T12:00:00Z"));
  state.refreshProviders.mockClear();
  state.environment = originalEnvironment;
});

afterEach(async () => {
  if (renderer) await act(() => renderer?.unmount());
  renderer = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("refreshes the chat limits while open and advances the reset countdown", async () => {
  await act(() => {
    renderer = create(<ForkChatFooter environmentId={environmentId} instanceId={instanceId} />);
  });
  const barText = () => JSON.stringify(renderer?.toJSON());
  expect(barText()).toContain('"74","% left"');
  expect(barText()).toContain("in 20m");
  expect(state.refreshProviders).toHaveBeenCalledTimes(1);

  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(barText()).toContain("in 19m");
  expect(state.refreshProviders).toHaveBeenCalledTimes(1);

  await act(() => vi.advanceTimersByTimeAsync(4 * 60_000));
  expect(barText()).toContain("in 15m");
  expect(state.refreshProviders).toHaveBeenCalledTimes(2);

  const provider = state.environment.serverConfig.providers[0]!;
  state.environment = {
    ...state.environment,
    serverConfig: {
      ...state.environment.serverConfig,
      providers: [
        {
          ...provider,
          usageLimits: {
            ...provider.usageLimits,
            checkedAt: "2026-09-11T12:05:00Z",
            windows: [{ ...provider.usageLimits.windows[0]!, usedPercent: 30 }],
          },
        },
      ],
    },
  };
  await act(() =>
    renderer?.update(<ForkChatFooter environmentId={environmentId} instanceId={instanceId} />),
  );
  expect(barText()).toContain('"70","% left"');
});
