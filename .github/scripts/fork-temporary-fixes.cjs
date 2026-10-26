// A temporary fix must describe its exact fork delta and the upstream behavior
// that makes it unnecessary. Add passing and failing retirement fixtures before
// registering another rule; unknown fixes still require a manual merge.
const zeroButtonCancel = `    if ((event.buttons & 1) === 0) {
      if (this.phase === "dragging") this.props.options.onDrop?.(coordinates);
      return this.cancel();
    }
`;
const pendingPressRelease = 'if (this.phase === "pending") return this.finish(false);';
const zeroButtonRelease = `    if ((event.buttons & 1) === 0) {
      // A press that never dragged is a click; ending it as a release keeps that click.
      ${pendingPressRelease}
      this.props.options.onDrop?.(coordinates);
      return this.cancel();
    }
`;

module.exports = [
  {
    id: "sidebar-pending-press-click",
    path: "apps/web/src/components/Sidebar.pointer.ts",
    appliesTo: (source) => source.split(zeroButtonCancel).length === 2,
    apply: (source) => source.replace(zeroButtonCancel, zeroButtonRelease),
    // Proposed upstream in pingdotgg/t3code#25442. Retire only once upstream ends a pending
    // press as a release; a different upstream fix still needs a manual merge and click check.
    verifyUpstream: (source) =>
      !source.includes(zeroButtonCancel) && source.includes(pendingPressRelease),
  },
];
