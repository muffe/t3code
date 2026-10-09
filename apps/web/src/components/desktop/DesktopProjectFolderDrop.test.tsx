import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { act, useLayoutEffect, type DragEvent } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const state = vi.hoisted(() => ({
  createProject: vi.fn(async () => ({ _tag: "Success" })),
  openThread: vi.fn(async () => ({ threadId: ThreadId.make("dropped-thread") })),
  toast: vi.fn(),
  getPathForFile: vi.fn(() => "/workspace/project"),
}));

vi.mock("../../hooks/useHandleNewThread", () => ({
  useNewThreadHandler: () => state.openThread,
}));
vi.mock("../../state/use-atom-command", () => ({
  useAtomCommand: () => state.createProject,
}));
vi.mock("../../state/projects", () => ({ projectEnvironment: { create: null } }));
vi.mock("../../state/entities", () => ({
  readProjects: () => [],
  waitForProject: async () => undefined,
}));
vi.mock("../../state/environments", () => ({
  usePrimaryEnvironment: () => ({
    environmentId: EnvironmentId.make("folder-drop"),
    connection: { phase: "connected" },
    serverConfig: { environment: { platform: { os: "linux" } } },
  }),
}));
vi.mock("../../lib/utils", () => ({
  cn: (...classes: string[]) => classes.join(" "),
  newProjectId: () => ProjectId.make("dropped-project"),
}));
vi.mock("../ui/toast", () => ({
  stackedThreadToast: (input: unknown) => input,
  toastManager: { add: state.toast },
}));

import { useDesktopProjectFolderDrop } from "./DesktopProjectFolderDrop";

let renderer: ReactTestRenderer | undefined;
let drop: ReturnType<typeof useDesktopProjectFolderDrop>;

function DropTarget() {
  const result = useDesktopProjectFolderDrop();
  useLayoutEffect(() => {
    drop = result;
  });
  return null;
}

function drag(isDirectory: boolean | null) {
  const entry = vi.fn(() => (isDirectory === null ? null : { isDirectory }));
  const file = new File([], "project");
  const getAsFile = vi.fn(() => file);
  const event = {
    dataTransfer: {
      types: ["Files"],
      items: [{ kind: "file", webkitGetAsEntry: entry, getAsFile }],
      dropEffect: "none",
    },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
  return { event, entry, getAsFile, reactEvent: event as unknown as DragEvent<HTMLElement> };
}

beforeEach(async () => {
  vi.clearAllMocks();
  state.getPathForFile.mockReset().mockReturnValue("/workspace/project");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("window", {
    desktopBridge: {
      getPathForFile: state.getPathForFile,
      getClientPlatform: () => "linux",
    },
  });
  await act(() => {
    renderer = create(<DropTarget />);
  });
});

afterEach(async () => {
  await act(() => renderer?.unmount());
  renderer = undefined;
  vi.unstubAllGlobals();
});

it("accepts protected file drags, then imports the directory using its desktop path", async () => {
  const hover = drag(null);
  await act(() => drop.handlers.onDragEnterCapture?.(hover.reactEvent));
  await act(() => drop.handlers.onDragOverCapture?.(hover.reactEvent));
  expect(hover.event.preventDefault).toHaveBeenCalled();
  expect(hover.event.dataTransfer.dropEffect).toBe("copy");
  expect(drop.active).toBe(true);
  expect(hover.entry).not.toHaveBeenCalled();
  expect(hover.getAsFile).not.toHaveBeenCalled();

  const directory = drag(true);
  await act(() => drop.handlers.onDropCapture?.(directory.reactEvent));
  expect(directory.event.preventDefault).toHaveBeenCalled();
  expect(state.createProject).toHaveBeenCalledWith({
    environmentId: EnvironmentId.make("folder-drop"),
    input: expect.objectContaining({ workspaceRoot: "/workspace/project" }),
  });
  expect(state.openThread).toHaveBeenCalledWith({
    environmentId: EnvironmentId.make("folder-drop"),
    projectId: ProjectId.make("dropped-project"),
  });
  expect(drop.active).toBe(false);
  expect(drop.adding).toBe(false);
});

it("clears the hover when a regular file is dropped without importing it", async () => {
  await act(() => drop.handlers.onDragOverCapture?.(drag(null).reactEvent));
  const file = drag(false);
  await act(() => drop.handlers.onDropCapture?.(file.reactEvent));
  expect(state.createProject).not.toHaveBeenCalled();
  expect(state.openThread).not.toHaveBeenCalled();
  expect(file.event.preventDefault).not.toHaveBeenCalled();
  expect(drop.active).toBe(false);
});

it.each(["empty", "throw"])(
  "reports a %s desktop path without creating a project",
  async (failure) => {
    state.getPathForFile.mockImplementation(() => {
      if (failure === "throw") throw new Error("No native path");
      return "";
    });
    await act(() => drop.handlers.onDropCapture?.(drag(true).reactEvent));
    expect(state.createProject).not.toHaveBeenCalled();
    expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    expect(drop.adding).toBe(false);
  },
);
