import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { RegistryContext } from "@effect/atom-react";
import { Atom, AtomRegistry } from "effect/reactivity";
import { expect, it, vi } from "vite-plus/test";

import { act, fakeTimers, render } from "../../test/render";

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

import "~/index.css";

const environmentId = EnvironmentId.make("footer-live-test");
const instanceId = ProviderInstanceId.make("codex");
const providerAtoms = Atom.family((_id: EnvironmentId) =>
  Atom.make<ReadonlyArray<ServerProvider> | null>(null),
);
const connectedEnvironment = state.environment;

function setup({ enabled = true, environment = connectedEnvironment } = {}) {
  state.enabled = enabled;
  state.environment = environment;
  state.refreshProviders.mockClear();
  const timers = fakeTimers();
  vi.setSystemTime(new Date("2026-09-11T12:00:00Z"));
  const registry = AtomRegistry.make();
  registry.set(providerAtoms(environmentId), [provider]);
  const footer = (
    targetEnvironmentId = environmentId,
    targetInstanceId: ProviderInstanceId | null = instanceId,
  ) => (
    <RegistryContext.Provider value={registry}>
      <ForkChatFooter environmentId={targetEnvironmentId} instanceId={targetInstanceId} />
    </RegistryContext.Provider>
  );
  return {
    registry,
    footer,
    [Symbol.dispose]() {
      registry.dispose();
      timers[Symbol.dispose]();
    },
  };
}

// The footer reads no route, so these mount without the test router.
const mount = (ui: React.ReactNode) => render(ui, { router: false });

// Refreshes are throttled per environment for the whole session, so this runs first.
it("refreshes the chat limits while open and advances the reset countdown", async () => {
  using test = setup();
  await using screen = await mount(test.footer());
  expect(screen.container.textContent).toContain("74% left");
  expect(screen.container.textContent).toContain("in 20m");
  expect(state.refreshProviders).toHaveBeenCalledTimes(1);

  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(screen.container.textContent).toContain("in 19m");
  expect(state.refreshProviders).toHaveBeenCalledTimes(1);

  await act(() => vi.advanceTimersByTimeAsync(4 * 60_000));
  expect(screen.container.textContent).toContain("in 15m");
  expect(state.refreshProviders).toHaveBeenCalledTimes(2);

  await act(() =>
    test.registry.set(providerAtoms(environmentId), [
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
  expect(screen.container.textContent).toContain("70% left");
});

it("waits for provider snapshots and updates when they arrive", async () => {
  using test = setup();
  test.registry.set(providerAtoms(environmentId), null);
  await using screen = await mount(test.footer());
  expect(screen.container.childElementCount).toBe(0);

  await act(() => test.registry.set(providerAtoms(environmentId), [provider]));
  expect(screen.container.textContent).toContain("74% left");

  await act(() => test.registry.set(providerAtoms(environmentId), []));
  expect(screen.container.childElementCount).toBe(0);
});

it("shows the destination environment's usage when switching environments", async () => {
  using test = setup();
  const remoteEnvironmentId = EnvironmentId.make("remote-footer-test");
  test.registry.set(providerAtoms(remoteEnvironmentId), [
    {
      ...provider,
      usageLimits: {
        ...provider.usageLimits,
        windows: [{ ...provider.usageLimits.windows[0]!, usedPercent: 80 }],
      },
    },
  ]);
  await using screen = await mount(test.footer());
  expect(screen.container.textContent).toContain("74% left");

  await screen.rerender(test.footer(remoteEnvironmentId));
  expect(screen.container.textContent).toContain("20% left");

  await screen.rerender(test.footer());
  expect(screen.container.textContent).toContain("74% left");
});

it("drops detail instead of wrapping when the row gets narrow", async () => {
  using test = setup();
  await using screen = await mount(<div style={{ width: 800 }}>{test.footer()}</div>);
  const frame = screen.container.firstElementChild as HTMLElement;
  const row = screen.container.querySelector<HTMLElement>("[class*='group/usage']")!;
  const content = row.firstElementChild!;
  expect(row).not.toHaveAttribute("data-no-bar");

  frame.style.width = "200px";
  await vi.waitFor(() => expect(row).toHaveAttribute("data-no-left"));
  expect(row).toHaveAttribute("data-no-bar");
  expect(row).not.toHaveAttribute("data-no-reset");
  expect(content.getBoundingClientRect().width).toBeLessThanOrEqual(
    row.getBoundingClientRect().width,
  );

  frame.style.width = "800px";
  await vi.waitFor(() => expect(row).not.toHaveAttribute("data-no-bar"));
  expect(row).not.toHaveAttribute("data-no-left");
});

it("stays hidden when the setting is disabled", async () => {
  using test = setup({ enabled: false });
  await using screen = await mount(test.footer());
  expect(screen.container.childElementCount).toBe(0);
});

it("stays hidden while the environment is disconnected", async () => {
  using test = setup({
    environment: { ...connectedEnvironment, connection: { phase: "reconnecting" } },
  });
  await using screen = await mount(test.footer());
  expect(screen.container.childElementCount).toBe(0);
});

it("stays hidden until the selected provider is known", async () => {
  using test = setup();
  await using screen = await mount(test.footer(environmentId, null));
  expect(screen.container.childElementCount).toBe(0);
});
