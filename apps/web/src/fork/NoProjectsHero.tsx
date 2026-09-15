import type { ReactNode } from "react";

import {
  DesktopProjectFolderDropOverlay,
  useDesktopProjectFolderDrop,
} from "../components/desktop/DesktopProjectFolderDrop";
import { SidebarInset } from "../components/ui/sidebar";
import { cn } from "../lib/utils";

export function ForkNoProjectsHeroSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const projectFolderDrop = useDesktopProjectFolderDrop();

  return (
    <SidebarInset {...projectFolderDrop.handlers} className={cn("relative", className)}>
      {children}
      <DesktopProjectFolderDropOverlay
        active={projectFolderDrop.active}
        adding={projectFolderDrop.adding}
        surface="content"
      />
    </SidebarInset>
  );
}
