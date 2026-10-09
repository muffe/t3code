# T3 Code

**T3 Code with provider limits below the chat, folder-drop project setup, and desktop nightlies that follow upstream.**

This is a personal fork of [T3 Code by T3 Tools](https://github.com/pingdotgg/t3code). T3 Code lets you control coding agents through desktop, web, and mobile clients using your existing provider subscriptions. This fork adds a few conveniences for daily use and publishes its own desktop builds.

[Download fork nightlies](https://github.com/muffe/t3code/releases) · [Original project](https://github.com/pingdotgg/t3code) · [User guides](./docs/README.md)

## Why this fork exists

The goal is to keep remaining provider limits visible while working and make opening a project as simple as dropping its folder into the app. Automated desktop builds keep these additions available alongside incoming upstream changes.

Most of the app comes from upstream. The fork keeps its additions small and continues to merge upstream improvements rather than maintaining a separate product direction.

## What is different?

| Area             | Original T3 Code                         | This fork                                                                                                                                    |
| ---------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider limits  | Limits view and `/usage-limits` in chat. | Remaining percentages and reset times also appear below the chat, refreshed while it is visible.                                             |
| Adding projects  | Use the existing Add project flow.       | Drop a folder onto the desktop sidebar or empty project screen to add or reopen a project and open a thread.                                 |
| Desktop releases | Official builds and update feeds.        | Own nightlies for **Windows x64** and **macOS Apple Silicon**, with an update feed pointing to `muffe/t3code`.                               |
| Upstream updates | Developed in `pingdotgg/t3code`.         | A scheduled workflow checks upstream three times daily and publishes a new nightly when the source changes and both platform builds succeed. |

The limits bar uses the provider data already available to T3 Code; availability depends on the provider and account. It is part of this fork's web and desktop UI. Folder drops require the desktop app and a folder path accessible to its primary environment. For a project on another machine, use Add project with that environment's path.

The limits bar is enabled by default. Toggle it in **Settings → General → Show usage limits below chat**.

The fork does not publish a separate mobile app or hosted web app. The [official iOS](https://apps.apple.com/us/app/t3-code-remote-claude-more/id6787819824) and [Android](https://play.google.com/store/apps/details?id=com.t3tools.t3code) clients remain available for remote access; the UI additions above are for web and desktop.

## Install this fork

1. Open [this fork's Releases](https://github.com/muffe/t3code/releases) and choose a **T3 Code Fork Nightly** release.
2. Download the Windows **`.exe`** or macOS Apple Silicon **arm64 `.dmg`** and install it manually once.
3. Keep the desktop update channel on **Nightly** to receive subsequent builds from this fork.

Windows builds are unsigned. macOS builds use a persistent self-signed certificate and are not notarized, so either OS may require approval on first launch. macOS passkeys are unavailable in these builds; use another configured sign-in method.

An official desktop installation must be replaced manually with a fork build before it can use the fork's update feed. Independently running remote servers need their own updates. See [fork nightly operations](./docs/operations/fork-nightly.md) for signing and update details.

**The installers at `t3.codes`, `npx t3@latest`, and the standard package-manager packages install the original T3 Code.** Use the releases above to get this fork. There are no fork Linux desktop releases or fork npm releases from this workflow; use the source checkout for those environments.

### Provider setup

Install and authenticate at least one provider before use:

- **Codex:** install [Codex CLI](https://developers.openai.com/codex/cli), then run `codex login`.
- **Claude:** install [Claude Code](https://claude.com/product/claude-code), then run `claude auth login`.
- **Cursor:** install [Cursor CLI](https://cursor.com/cli), then run `agent login`.
- **Grok Build:** install [Grok Build CLI](https://x.ai/cli), then run `grok login`.
- **OpenCode:** install [OpenCode](https://opencode.ai), then run `opencode auth login`.
- **Antigravity:** enable it in Settings, then use **Install Antigravity** and **Sign in with Google**. No CLI is required.

## Run from source

Install [Vite+](https://viteplus.dev/guide/) to get the `vp` command:

```bash
# macOS / Linux
curl -fsSL https://vite.plus | bash
```

```powershell
# Windows
irm https://vite.plus/ps1 | iex
```

Then clone this fork, install dependencies, and start the server and web client:

```bash
git clone https://github.com/muffe/t3code.git
cd t3code
vp i
vp run dev
```

For desktop development, use `vp run dev:desktop`. See [development setup](./docs/operations/development.md) for the full workflow.

## Documentation and contributions

Most upstream guides also apply to this fork:

- [Install and first run](./docs/user/install.md) describes the original distribution; use the fork installation instructions above for these builds.
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Appearance preferences](./docs/user/appearance.md)
- [Remote access](./docs/user/remote-access.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- [Background service](./docs/user/background-service.md)

For maintaining the fork, see [nightly builds and upstream sync](./docs/operations/fork-nightly.md). The sync always keeps this fork's README, including when upstream changes merge without a conflict.

Report issues specific to these additions or builds in [muffe/t3code](https://github.com/muffe/t3code/issues). For contributions to the original project, read [CONTRIBUTING.md](./CONTRIBUTING.md) and follow its upstream process.

T3 Code is built by the [upstream maintainers and contributors](https://github.com/pingdotgg/t3code). This repository contains the personal additions and build automation described above.
