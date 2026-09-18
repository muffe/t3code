# Personal desktop nightlies

The `Fork Desktop Nightly` workflow merges `pingdotgg/t3code:main` into this
fork every four hours at 23 minutes past the hour. It builds Windows x64 and
macOS arm64 when the source differs from the last published nightly. Run it
manually from GitHub Actions for an immediate build; select **force** to rebuild
unchanged source.

Keep personal changes on this fork's `main`. Sync creates a normal merge on the
temporary `fork-nightly-candidate` branch and rebuilds the fork's small,
documented integration points on top of the upstream versions. Unknown conflicts
still fail loudly and require a local merge. So do known files with fork changes
outside the declared overlay, preventing the resolver from silently discarding
new work. The workflow promotes the tested commit to `main` only after every
platform build succeeds, and only if `main` has not moved in the meantime. A
failed build therefore leaves both `main` and the previous release untouched;
the candidate branch remains available for inspection. GitHub's scheduled runs
may be delayed, and inactive public forks can have schedules disabled after 60
days.

## Initial setup

The workflow must be on the default branch, `main`, with Actions enabled. Add a
repository-scoped SSH deploy key with write access and store its private key as
the Actions secret `FORK_SYNC_SSH_KEY`. This lets upstream workflow-file changes
be merged without a personal token. The sync job disables upstream workflows in
this fork; only `Fork Desktop Nightly` is used for these releases.

The build uses GitHub-hosted Linux, Windows, and Apple Silicon macOS runners. Linux builds the WSL
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
The workflow enables T3 Connect with the public production identifiers from
`.env.example`. macOS passkeys remain unavailable because the self-signed fork
certificate cannot carry Apple's Associated Domains entitlement; use another
configured sign-in method instead. Direct remote connections continue to use
the existing environment setup.

Releases are published only after the installer, blockmap, and `nightly.yml`
have all uploaded. Keep these assets together: `nightly.yml` is what the desktop
updater reads. GitHub Actions sends failures through the account's configured
workflow notifications.

## macOS signing

Apple Silicon builds use a persistent self-signed code-signing certificate.
Store its base64-encoded PKCS#12 file as `FORK_MAC_CERTIFICATE` and its password
as `FORK_MAC_CERTIFICATE_PASSWORD` in repository Actions secrets. The certificate
common name is `T3 Code Fork`; keep the certificate and private key across builds.
Replacing them can prevent existing installations from accepting updates.

The Mac job imports the certificate into a temporary keychain and signs T3
before creating its DMG and ZIP. It verifies the packaged app and deletes the
temporary keychain. No Apple account, notarization, or Associated Domains
provisioning profile is used. The fork signing hook does not disable Squirrel's
signature verification.

Install the arm64 DMG manually once and keep the channel on **Nightly**.
The app is not notarized: macOS may require explicit approval in Privacy &
Security before its first launch. The packaged signature check does not reproduce this Gatekeeper first-launch
flow on a user's Mac. The official installation cannot
update directly to our different signing identity.

Mac updates require the ZIP and `nightly-mac.yml`; the DMG is for installation.
Both platforms must succeed before the combined release is published.
