import type { ReactElement } from "react";
import { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { reactHookHarness as hooks } from "../test/reactHookHarness";

const state = vi.hoisted(() => ({
  enabled: true,
  environmentId: null as EnvironmentId | null,
  environment: null as {
    readonly connection: { readonly phase: string };
    readonly serverConfig: {
      readonly providers: readonly [];
      readonly usageLimitSources: Record<string, never>;
    } | null;
  } | null,
}));

vi.mock("react/compiler-runtime", async () => {
  const { reactHookHarness } = await import("../test/reactHookHarness");
  return { c: reactHookHarness.useMemoCache };
});

vi.mock("../hooks/useSettings", () => ({
  useEnvironmentSettings: (
    environmentId: EnvironmentId,
    selector: (settings: { readonly showUsageLimitsBar: boolean }) => unknown,
  ) => {
    state.environmentId = environmentId;
    return selector({ showUsageLimitsBar: state.enabled });
  },
}));

vi.mock("../state/environments", () => ({
  useEnvironment: () => state.environment,
}));

import { ForkChatFooter } from "./ChatFooter";

const environmentId = EnvironmentId.make("environment-test");
const instanceId = ProviderInstanceId.make("codex");

function renderBar(providerInstanceId: ProviderInstanceId | null = instanceId) {
  hooks.beginRender();
  return ForkChatFooter({ environmentId, instanceId: providerInstanceId }) as ReactElement | null;
}

describe("ForkChatFooter", () => {
  beforeEach(() => {
    hooks.reset();
    state.enabled = true;
    state.environmentId = null;
    state.environment = {
      connection: { phase: "connected" },
      serverConfig: { providers: [], usageLimitSources: {} },
    };
  });

  it("renders through its environment-scoped interface when usage limits are available", () => {
    expect(renderBar()).not.toBeNull();
    expect(state.environmentId).toBe(environmentId);
  });

  it("stays hidden when the setting is disabled", () => {
    state.enabled = false;

    expect(renderBar()).toBeNull();
  });

  it("stays hidden while the environment is disconnected", () => {
    state.environment = {
      connection: { phase: "reconnecting" },
      serverConfig: { providers: [], usageLimitSources: {} },
    };

    expect(renderBar()).toBeNull();
  });

  it("stays hidden until the selected provider is known", () => {
    expect(renderBar(null)).toBeNull();
  });
});
