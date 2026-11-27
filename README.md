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

Every push and pull request builds the Windows installer in GitHub Actions.
Download it from the run's **Artifacts** section.

## Roadmap

1. Project setup (this)
2. v1: multiple IMAP accounts, combined live inbox, read, archive
3. Daily use for a week, fix what gets in the way
4. v2: Claude integration, choose sender account, view source, wishlist
