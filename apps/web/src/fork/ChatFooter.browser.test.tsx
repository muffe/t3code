import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { RegistryContext } from "@effect/atom-react";
import { Atom, AtomRegistry } from "effect/reactivity";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  enabled: true,
  refreshProviders: vi.fn(async () => undefined),
  environment: {
    connection: { phase: "connected" },
    serverConfig: { usageLimitSources: [] },
  },
}));

const provider = {
  instanceId: ProviderInstanceId.make("codex"),
  driver: ProviderDriverKind.make("codex"),
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
} satisfies ServerProvider;

vi.mock(import("../hooks/useSettings"), async (original) => ({
  ...(await original()),
  useEnvironmentSettings: ((
    _environmentId: EnvironmentId,
    selector: (settings: { readonly showUsageLimitsBar: boolean }) => unknown,
  ) => selector({ showUsageLimitsBar: state.enabled })) as never,
}));
vi.mock(import("../state/environments"), async (original) => ({
  ...(await original()),
  useEnvironment: (() => state.environment) as never,
}));
vi.mock(import("../state/server"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    serverEnvironment: {
      ...actual.serverEnvironment,
      providersValueAtom: ((id: EnvironmentId) => providerAtoms(id)) as never,
    },
  };
});
vi.mock(import("../state/use-atom-command"), async (original) => ({
  ...(await original()),
  useAtomCommand: (() => state.refreshProviders) as never,
}));

import { ForkChatFooter } from "./ChatFooter";

const environmentId = EnvironmentId.make("footer-live-test");
const instanceId = ProviderInstanceId.make("codex");
const providerAtoms = Atom.family((_id: EnvironmentId) =>
  Atom.make<ReadonlyArray<ServerProvider> | null>(null),
);
let root: Root;
let container: HTMLDivElement;
let registry: AtomRegistry.AtomRegistry;
const originalEnvironment = state.environment;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T12:00:00Z"));
  state.enabled = true;
  state.refreshProviders.mockClear();
  state.environment = originalEnvironment;
  registry = AtomRegistry.make();
  registry.set(providerAtoms(environmentId), [provider]);
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  registry.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function footer(
  targetEnvironmentId = environmentId,
  targetInstanceId: ProviderInstanceId | null = instanceId,
) {
  return (
    <RegistryContext.Provider value={registry}>
      <ForkChatFooter environmentId={targetEnvironmentId} instanceId={targetInstanceId} />
    </RegistryContext.Provider>
  );
}

// Refreshes are throttled per environment for the whole session, so this runs first.
it("refreshes the chat limits while open and advances the reset countdown", async () => {
  await act(async () => root.render(footer()));
  expect(container.textContent).toContain("74% left");
  expect(container.textContent).toContain("in 20m");
  expect(state.refreshProviders).toHaveBeenCalledTimes(1);

  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(container.textContent).toContain("in 19m");
  expect(state.refreshProviders).toHaveBeenCalledTimes(1);

  await act(() => vi.advanceTimersByTimeAsync(4 * 60_000));
  expect(container.textContent).toContain("in 15m");
  expect(state.refreshProviders).toHaveBeenCalledTimes(2);

  act(() =>
    registry.set(providerAtoms(environmentId), [
      {
        ...provider,
        usageLimits: {
          ...provider.usageLimits,
          checkedAt: "2026-09-11T12:05:00Z",
          windows: [{ ...provider.usageLimits.windows[0]!, usedPercent: 30 }],
        },
      },
    ]),
  );
  expect(container.textContent).toContain("70% left");
});

it("waits for provider snapshots and updates when they arrive", () => {
  registry.set(providerAtoms(environmentId), null);
  act(() => root.render(footer()));
  expect(container.childElementCount).toBe(0);

  act(() => registry.set(providerAtoms(environmentId), [provider]));
  expect(container.textContent).toContain("74% left");

  act(() => registry.set(providerAtoms(environmentId), []));
  expect(container.childElementCount).toBe(0);
});

it("shows the destination environment's usage when switching environments", () => {
  const remoteEnvironmentId = EnvironmentId.make("remote-footer-test");
  registry.set(providerAtoms(remoteEnvironmentId), [
    {
      ...provider,
      usageLimits: {
        ...provider.usageLimits,
        windows: [{ ...provider.usageLimits.windows[0]!, usedPercent: 80 }],
      },
    },
  ]);
  act(() => root.render(footer()));
  expect(container.textContent).toContain("74% left");

  act(() => root.render(footer(remoteEnvironmentId)));
  expect(container.textContent).toContain("20% left");

  act(() => root.render(footer()));
  expect(container.textContent).toContain("74% left");
});

it("stays hidden when the setting is disabled", () => {
  state.enabled = false;
  act(() => root.render(footer()));
  expect(container.childElementCount).toBe(0);
});

it("stays hidden while the environment is disconnected", () => {
  state.environment = { ...originalEnvironment, connection: { phase: "reconnecting" } };
  act(() => root.render(footer()));
  expect(container.childElementCount).toBe(0);
});

it("stays hidden until the selected provider is known", () => {
  act(() => root.render(footer(environmentId, null)));
  expect(container.childElementCount).toBe(0);
});
