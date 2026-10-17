import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { RegistryContext } from "@effect/atom-react";
import { Atom, AtomRegistry } from "effect/reactivity";
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
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

vi.mock("../hooks/useSettings", () => ({ useEnvironmentSettings: () => true }));
vi.mock("../state/environments", () => ({ useEnvironment: () => state.environment }));
vi.mock("../state/server", () => ({
  EMPTY_SERVER_PROVIDERS: [],
  serverEnvironment: {
    refreshProviders: null,
    providersValueAtom: (id: EnvironmentId) => providerAtoms(id),
  },
}));
vi.mock("../state/use-atom-command", () => ({ useAtomCommand: () => state.refreshProviders }));

import { ForkChatFooter } from "./ChatFooter";

const environmentId = EnvironmentId.make("footer-live-test");
const instanceId = ProviderInstanceId.make("codex");
const providerAtoms = Atom.family((_id: EnvironmentId) =>
  Atom.make<ReadonlyArray<ServerProvider> | null>(null),
);
let renderer: ReactTestRenderer | undefined;
let registry: AtomRegistry.AtomRegistry;
const originalEnvironment = state.environment;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T12:00:00Z"));
  state.refreshProviders.mockClear();
  state.environment = originalEnvironment;
  registry = AtomRegistry.make();
  registry.set(providerAtoms(environmentId), [provider]);
});

afterEach(async () => {
  if (renderer) await act(() => renderer?.unmount());
  renderer = undefined;
  registry.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function footer(targetEnvironmentId = environmentId) {
  return (
    <RegistryContext.Provider value={registry}>
      <ForkChatFooter environmentId={targetEnvironmentId} instanceId={instanceId} />
    </RegistryContext.Provider>
  );
}

async function mountFooter() {
  await act(() => {
    renderer = create(footer());
  });
}

it("refreshes the chat limits while open and advances the reset countdown", async () => {
  await mountFooter();
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

  await act(() =>
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
  expect(barText()).toContain('"70","% left"');
});

it("waits for provider snapshots and updates when they arrive", async () => {
  registry.set(providerAtoms(environmentId), null);
  await mountFooter();
  expect(renderer?.toJSON()).toBeNull();

  await act(() => registry.set(providerAtoms(environmentId), [provider]));
  expect(JSON.stringify(renderer?.toJSON())).toContain('"74","% left"');

  await act(() => registry.set(providerAtoms(environmentId), []));
  expect(renderer?.toJSON()).toBeNull();
});

it("shows the destination environment's usage when switching environments", async () => {
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
  await mountFooter();
  expect(JSON.stringify(renderer?.toJSON())).toContain('"74","% left"');

  await act(() => renderer?.update(footer(remoteEnvironmentId)));
  expect(JSON.stringify(renderer?.toJSON())).toContain('"20","% left"');

  await act(() => renderer?.update(footer()));
  expect(JSON.stringify(renderer?.toJSON())).toContain('"74","% left"');
});
