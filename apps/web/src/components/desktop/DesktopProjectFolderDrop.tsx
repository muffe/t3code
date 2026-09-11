import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { FolderPlusIcon } from "lucide-react";
import { useCallback, useRef, useState, type DragEventHandler, type HTMLAttributes } from "react";

import { handleDesktopAppActivationRequest } from "../../desktopAppActivation";
import { useNewThreadHandler } from "../../hooks/useHandleNewThread";
import { cn, newProjectId } from "../../lib/utils";
import { findProjectByPath, inferProjectTitleFromPath } from "../../lib/projectPaths";
import { readProjects, waitForProject } from "../../state/entities";
import { usePrimaryEnvironment } from "../../state/environments";
import { projectEnvironment } from "../../state/projects";
import { useAtomCommand } from "../../state/use-atom-command";
import { stackedThreadToast, toastManager } from "../ui/toast";
import {
  getSingleDroppedDirectoryFile,
  isSingleDirectoryDrop,
  parseDesktopActivationPlatform,
} from "./DesktopProjectFolderDrop.logic";

function showFolderDropError(error: unknown): void {
  toastManager.add(
    stackedThreadToast({
      type: "error",
      title: "Couldn’t add project",
      description:
        error instanceof Error && error.message.trim().length > 0 ? error.message : "Try again.",
    }),
  );
}

export interface DesktopProjectFolderDropState {
  readonly active: boolean;
  readonly adding: boolean;
  readonly handlers: Pick<
    HTMLAttributes<HTMLElement>,
    "onDragEnterCapture" | "onDragLeaveCapture" | "onDragOverCapture" | "onDropCapture"
  >;
}

export function useDesktopProjectFolderDrop(): DesktopProjectFolderDropState {
  const primaryEnvironment = usePrimaryEnvironment();
  const createProject = useAtomCommand(projectEnvironment.create, { reportFailure: false });
  const openThread = useNewThreadHandler();
  const [active, setActive] = useState(false);
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);
  const bridge = window.desktopBridge;

  const accepts = useCallback(
    (dataTransfer: DataTransfer) =>
      typeof bridge?.getPathForDroppedFile === "function" && isSingleDirectoryDrop(dataTransfer),
    [bridge],
  );

  const onDragEnterCapture: DragEventHandler<HTMLElement> = useCallback(
    (event) => {
      if (!accepts(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      setActive(true);
    },
    [accepts],
  );

  const onDragOverCapture: DragEventHandler<HTMLElement> = useCallback(
    (event) => {
      if (!accepts(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      setActive(true);
    },
    [accepts],
  );

  const onDragLeaveCapture: DragEventHandler<HTMLElement> = useCallback((event) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setActive(false);
  }, []);

  const onDropCapture: DragEventHandler<HTMLElement> = useCallback(
    (event) => {
      const file = getSingleDroppedDirectoryFile(event.dataTransfer);
      if (file === null || typeof bridge?.getPathForDroppedFile !== "function") return;
      event.preventDefault();
      event.stopPropagation();
      setActive(false);
      if (addingRef.current) return;

      const workspaceRoot = bridge.getPathForDroppedFile(file);
      const platform = parseDesktopActivationPlatform(bridge.getClientPlatform?.() ?? null);
      if (workspaceRoot === null || platform === null) {
        showFolderDropError(new Error("T3 Code could not read that folder’s desktop path."));
        return;
      }

      addingRef.current = true;
      setAdding(true);
      void handleDesktopAppActivationRequest(
        {
          version: 1,
          requestId: `folder-drop-${Date.now()}`,
          type: "open-workspace",
          workspaceRoot,
          platform,
        },
        {
          getTarget: () => {
            if (
              primaryEnvironment?.connection.phase !== "connected" ||
              primaryEnvironment.serverConfig === null
            ) {
              return null;
            }
            return {
              environmentId: primaryEnvironment.environmentId,
              platform: primaryEnvironment.serverConfig.environment.platform.os,
            };
          },
          findProject: (environmentId, path) =>
            findProjectByPath(
              readProjects().filter((project) => project.environmentId === environmentId),
              path,
            ) ?? null,
          createProject: async (environmentId, path) => {
            const projectId = newProjectId();
            const result = await createProject({
              environmentId,
              input: {
                projectId,
                title: inferProjectTitleFromPath(path),
                workspaceRoot: path,
                createWorkspaceRootIfMissing: false,
                defaultModelSelection: null,
              },
            });
            if (result._tag === "Failure") {
              const error = squashAtomCommandFailure(result);
              throw error instanceof Error
                ? error
                : new Error("T3 Code could not add the project.");
            }
            return projectId;
          },
          waitForProject: async (projectRef) => {
            await waitForProject(projectRef);
          },
          openThread,
        },
      )
        .then((response) => {
          if (!response.ok) showFolderDropError(new Error(response.message));
        })
        .catch(showFolderDropError)
        .finally(() => {
          addingRef.current = false;
          setAdding(false);
        });
    },
    [bridge, createProject, openThread, primaryEnvironment],
  );

  return {
    active,
    adding,
    handlers: {
      onDragEnterCapture,
      onDragLeaveCapture,
      onDragOverCapture,
      onDropCapture,
    },
  };
}

export function DesktopProjectFolderDropOverlay({
  active,
  adding,
  surface,
}: {
  readonly active: boolean;
  readonly adding: boolean;
  readonly surface: "sidebar" | "content";
}) {
  if (!active && !adding) return null;
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-2 z-50 flex items-center justify-center rounded-lg border border-dashed",
        surface === "sidebar"
          ? "border-sidebar-primary/45 bg-sidebar/95 text-sidebar-foreground"
          : "border-primary/45 bg-background/95 text-foreground",
      )}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <FolderPlusIcon className="size-4" />
        {adding ? "Adding project…" : "Drop to add project"}
      </div>
    </div>
  );
}
