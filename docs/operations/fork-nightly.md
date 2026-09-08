# Personal Windows nightlies

The `Fork Windows Nightly` workflow merges `pingdotgg/t3code:main` into this
fork's `main` every day at 03:23 UTC. It builds Windows x64 when the source differs
from the last published nightly. Run it manually from GitHub Actions for an
immediate build; select **force** to rebuild unchanged source.

Keep personal changes on this fork's `main`. Sync uses a normal merge, never a
reset or force push. A conflict fails the workflow before publication; resolve
the merge locally, push it, and rerun. A failed build leaves the previous release
available. GitHub's scheduled runs may be delayed, and inactive public forks can
have schedules disabled after 60 days.

## Initial setup

The workflow must be on the default branch, `main`, with Actions enabled. Add a
repository-scoped SSH deploy key with write access and store its private key as
the Actions secret `FORK_SYNC_SSH_KEY`. This lets upstream workflow-file changes
be merged without a personal token. The sync job disables upstream workflows in
this fork; only `Fork Windows Nightly` is used for these releases.

The build uses GitHub-hosted Linux and Windows runners. Linux builds the WSL
terminal helper; Windows packages the desktop app, bundled server, and WSL
runtime with the existing build script. No npm or hosted-web deployment runs.

## Install and update

Download the `.exe` from a published **T3 Code Fork Nightly** release in
`muffe/t3code` and install it once. These builds are unsigned, so Windows may show
an unknown-publisher or SmartScreen prompt. Keep the desktop update channel on
**Nightly**. The embedded update feed points at `muffe/t3code`, so later app
updates include this fork's changes.

The official app keeps its original update feed until replaced by a fork build.
An independently running remote server still needs its own update process.
Official T3 Connect configuration and signing credentials are not included in
this workflow; direct remote connections use the existing environment setup.

Releases are published only after the installer, blockmap, and `nightly.yml`
have all uploaded. Keep these assets together: `nightly.yml` is what the desktop
updater reads. GitHub Actions sends failures through the account's configured
workflow notifications.
