# Privacy

Last updated: 3 October 2026. Applies to the Chhanni browser extension and the
Chhanni command-line tool.

## The short version

Chhanni does not send your content anywhere. It has no network permission, it
contains no network call, and there is no server for it to talk to.

**That is a statement about Chhanni, not about your prompt.** Your prompt still
goes to whichever AI provider you are using — that is the point of typing it.
Chhanni runs in the moment before that happens and tells you what is in it. A
sentence like "nothing ever leaves your browser" would be a comfortable thing to
put on a box and it would not be true, so it is not written anywhere in this
project.

## What Chhanni reads

| | |
|---|---|
| Text you paste into a supported AI composer | read in memory, scanned, discarded |
| Text in the composer when you press Enter | read in memory, scanned, discarded |
| Your settings and allowlist | stored by the browser in your profile |

Nothing is written to disk by the extension except your own settings. Scans
happen synchronously in the page and nothing about them is retained after the
panel closes.

## What Chhanni stores

One object, under the key `policy`, in `chrome.storage.sync`:

- which mode you chose,
- which detectors you turned off,
- the literal values you added to "Never flag these".

`chrome.storage.sync` is the browser's own setting store. If you are signed into
Chrome and have sync turned on, Chrome replicates it between your own devices
under your Google account, the same way it replicates bookmarks. Chhanni does
not read it anywhere else and cannot see it. Turn off Chrome sync, or use
`chrome.storage.local` by not signing in, if that replication is not acceptable
to you — and note that this means your allowlist, which you fill with values you
consider safe to share, lives there too.

## What Chhanni transmits

Nothing. There is no telemetry, no crash reporting, no analytics, no update ping
beyond the Chrome Web Store's own extension update check, which Chrome performs
for every installed extension and which Chhanni has no part in.

This is enforced, not promised: `test/shipping.test.js` and
`test/detect.test.js` fail if the string `fetch`, `XMLHttpRequest`,
`sendBeacon`, `WebSocket` or `EventSource` appears in any shipped file, and if
the manifest requests any permission beyond `storage`.

## What Chhanni cannot see

Stated here because the gaps are where people get hurt:

- **Files you attach.** Drag a `.env` or a screenshot into the chat and Chhanni
  does not inspect it. It reads the composer.
- **Anything outside the composer.** It does not read the page, the
  conversation, or the model's replies.
- **Meaning.** It matches formats. Describing confidential information in
  careful prose is a disclosure Chhanni cannot detect.
- **Sites not in the manifest.** It runs on the twelve hosts listed in
  `extension/manifest.json` and nowhere else.

## Permissions, and why each one exists

| Permission | Why |
|---|---|
| `storage` | your settings and allowlist |
| 12 host permissions | the AI sites the content script runs on; listed individually, never `<all_urls>` |

There is no background service worker, no `tabs`, no `webRequest`, no
`clipboardRead`, and no optional permissions.

## Children

Chhanni is not directed at children and collects nothing from anyone.

## Changes

Material changes to this document will be accompanied by a version bump and a
note in the repository history.

## Contact

Open an issue on the repository.
