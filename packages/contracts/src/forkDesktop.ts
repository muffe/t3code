export interface ForkDesktopBridge {
  /** Resolve an OS path for a dropped Electron File without exposing Node APIs. */
  getPathForDroppedFile?: (file: File) => string | null;
}
