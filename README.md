# T3 Code

This fork is kept for contributions to [T3 Code](https://github.com/pingdotgg/t3code). The official nightlies now provide the persistent usage limits I wanted, and I have switched back to upstream.

Custom fork builds, automatic upstream syncs, and CI repairs have been disabled. The repository stays active for bug-fix branches and upstream pull requests. Existing fork releases are no longer maintained.

- [Upstream project](https://github.com/pingdotgg/t3code)
- [Official releases and nightlies](https://github.com/pingdotgg/t3code/releases)
- [Current user guides](https://github.com/pingdotgg/t3code/tree/main/docs/user)

## Usage limits in upstream

In the official nightly, enable **Usage** under **Settings → Appearance → Thread details**, or right-click the thread details card. It shows the selected provider account's remaining allowance and the thread's context usage. Hover a limit to see reset times and pace. Available limits depend on the provider and account.

The display lives in the thread details card rather than below the chat. See the [upstream usage guide](https://github.com/pingdotgg/t3code/blob/main/docs/user/usage.md).

## Switching from this fork

Download the official desktop nightly from the [upstream releases](https://github.com/pingdotgg/t3code/releases) and replace the fork installation with it. Fork desktop builds use their own update feed, so selecting Nightly in a fork build does not switch it to the official distribution.

Update independently running remote servers separately. The [upstream updating guide](https://github.com/pingdotgg/t3code/blob/main/docs/user/updating.md) covers desktop and server updates.

## Contributing upstream

Start new bug-fix branches from the current upstream `main` so they do not include this fork's customizations. Follow the [upstream contribution guide](https://github.com/pingdotgg/t3code/blob/main/CONTRIBUTING.md).

## What this fork added

- Provider limits below the chat, with remaining percentages and reset times.
- Dropping a folder onto the desktop sidebar or empty project screen to add or reopen a project.
- Automated Windows x64 and macOS Apple Silicon nightlies following upstream.

The folder-drop addition remains specific to this fork. I did not use it, so it is not a reason for me to keep maintaining separate builds.
