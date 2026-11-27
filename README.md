# Ember Mail

A personal desktop email client for Windows with Claude built in.

Ember Mail is the main place to manage mail on the PC, with an Inbox Zero flow:
mails that are read and done get archived, never deleted. Spark stays the viewer
on the phone. Both work on the same IMAP mailboxes, so actions sync both ways.

## Stack

- Electron + React + TypeScript, built with [electron-vite](https://electron-vite.org)
- Windows installer via electron-builder (NSIS)

## Development

```bash
npm install
npm run dev        # start the app with hot reload
npm run lint
npm run typecheck
npm run build:win  # build the Windows installer into dist/
```

## Releases and updates

- Every pull request builds the Windows installer in GitHub Actions. Download it
  from the run's **Artifacts** section.
- Every merge to `main` publishes a new version to
  [Releases](https://github.com/ManekenT/ember-mail/releases), numbered
  `<major>.<minor>.<build>`. Bump major/minor in `package.json` by hand when you want.
- The installed app checks for a new release on startup and every 4 hours,
  downloads it in the background, and installs it when you next quit the app.
  Install once from the latest release, and updates arrive on their own.
- The installer is unsigned, so Windows SmartScreen warns on the first install:
  choose **More info → Run anyway**.

## Roadmap

1. Project setup (this)
2. v1: multiple IMAP accounts, combined live inbox, read, archive
3. Daily use for a week, fix what gets in the way
4. v2: Claude integration, choose sender account, view source, wishlist
