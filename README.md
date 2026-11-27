# Ember Mail

A personal desktop email client for Windows with Claude built in.

Ember Mail is the main place to manage mail on the PC, with an Inbox Zero flow:
mails that are read and done get archived, never deleted. Spark stays the viewer
on the phone. Both work on the same IMAP mailboxes, so actions sync both ways.

## Stack

- Electron + React + TypeScript, built with [electron-vite](https://electron-vite.org)
- Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (add components with `npx shadcn@latest add <name>`; if a new component imports `cn` from `"cn"`, change it to `@renderer/lib/utils` and don't keep the `cn` npm package), dark theme by default, Geist font
- Windows installer via electron-builder (NSIS)

## Development

```bash
npm install
npm run dev        # start the app with hot reload
npm run lint
npm run typecheck
npm run build:win  # build the Windows installer into dist/
```

## Using it

- **Add account** in the sidebar: any IMAP account. The connection is tested before
  saving, and the password is stored encrypted by Windows (Electron `safeStorage`).
- The combined inbox stays live over IMAP IDLE, and new mail shows a Windows
  notification. Clicking it opens the mail.
- **Archive** moves a mail to the account's Archive folder (the server's `\Archive`
  folder, else a folder named Archive, created if missing). Nothing is ever deleted.
  The toast offers **Undo**.
- **New mail** (<kbd>C</kbd>) and **Reply** (<kbd>R</kbd>) open the compose screen. Pick the
  account and type any sender address (aliases on your domain are remembered). A reply
  starts from the address the mail was sent to, quotes the original and keeps the thread
  headers. Sent mail is copied to the account's Sent folder. <kbd>Ctrl</kbd>+<kbd>Enter</kbd>
  sends.
- Sending needs the account's SMTP server: set it when adding an account, or with the
  pencil next to an existing account. Your name on sent mail is in **Settings**.
- Keys: <kbd>J</kbd>/<kbd>K</kbd> move, <kbd>Enter</kbd> open, <kbd>Esc</kbd> back,
  <kbd>E</kbd> archive.
- HTML mails are sanitized (DOMPurify) and shown in a sandboxed frame that can't run
  scripts. Links open in your browser.
- The source button in a mail's toolbar shows its raw source (headers and MIME parts).

## Claude

- **Settings** in the sidebar takes a Claude API key and a Todoist API token, both stored
  encrypted by Windows.
- Every inbox mail is analysed once by Claude Haiku 5.5: a one-line summary (shown in the
  list instead of the preview), a category, an urgency (Urgent and Important get a badge),
  dates (events, deadlines, expiry) and when the mail stops being relevant. Results are
  kept in `analysis.json` in the app's data folder, keyed by Message-ID, so they survive
  restarts and archiving.
- An open mail shows the analysis with its dates; **Add to Todoist** creates a task with
  the date as due date.
- **Clean inbox** (inbox header) lists what can go, to review before anything happens:
  mails with upcoming dates (added to Todoist, then archived), and mails to archive:
  spam, promotions, newsletters and expired mail (even unread), and read notifications
  and other mail with no lasting value. Urgent and important mail is never suggested.
  Undo moves everything back.
- **Draft reply**: the reply screen offers a few one-tap ideas (Haiku 5.5), or type what
  the reply should say. Claude Opus 5.5 writes it into the body in the mail's language,
  with placeholders for facts it doesn't know. Nothing is sent without you.

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

1. Project setup (done)
2. v1: multiple IMAP accounts, combined live inbox, read, archive (done)
3. Daily use for a week, fix what gets in the way
4. v2: Claude integration, choose sender account, view source, wishlist
