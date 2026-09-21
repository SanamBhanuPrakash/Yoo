# Kasauti — कसौटी

*The touchstone: the stone jewellers rub gold against to find out whether it is real.*

**A dark pattern auditor for India's CCPA Guidelines, 2023 — that measures instead of guessing, and tells you what it could not check.**

---

## Why this exists

India's Central Consumer Protection Authority notified the **Guidelines for
Prevention and Regulation of Dark Patterns** on 30 November 2023. They name
**thirteen specific practices** and declare them unfair trade practices.

On **5 June 2025** the CCPA directed e-commerce platforms to self-audit against
those thirteen and file self-declarations.

**26 platforms filed.** Independent review then found dark patterns still
present on **21 of them**. A January 2026 audit found every major e-commerce and
quick-commerce platform except one failed. A July 2026 study put ~95% of the top
300 listed consumer-facing platforms as using at least one. Amazon filed months
late, and violations were still found afterwards.

So there are **public, legally-filed claims of compliance — and no reproducible,
open instrument to check them.** That work is currently being done by consumer
surveys and by journalists reading pages by hand.

This is the instrument.

## Why it is not "another dark pattern extension"

There are at least eight of those on GitHub. Almost all of them ask a language
model whether a page *feels* manipulative, against a Western academic taxonomy,
and emit a highlight. None of them map to Indian law, produce evidence, or admit
what they did not check.

| | Existing detectors | Kasauti |
|---|---|---|
| Taxonomy | generic / academic | **the 13 named in CCPA 2023, with clause citations** |
| Method | LLM opinion on text | **measured: WCAG contrast, rendered area, DOM state** |
| Output | a highlight | **evidence a reviewer can re-derive** |
| Scope honesty | silent | **declares 4 of 13 as NOT CHECKED, and why** |
| Purpose | inform a shopper | **also verify a filed compliance claim** |

## The measurement, not the vibe

Every finding quotes the arithmetic it rests on. From a live run:

```
[PROVEN] INTERFACE_INTERFERENCE
  The accept control is 6.2× the rendered area of the decline control,
  and the decline control sits at 1.15:1 contrast — below the 4.5:1
  WCAG AA floor for readable text.

[PROVEN] DISGUISED_ADVERTISEMENT
  The "Sponsored" disclosure is rendered at 8px against 16px body text
  and at 1.12:1 contrast.
```

"This looks pushy" is an opinion. A 6.2× area ratio and a 1.15:1 contrast ratio
is a finding, and it survives a compliance meeting.

## The proof: the countdown reload test

A countdown next to an offer is only *suspicious*. It becomes a **fact** when
you load the page, wait, reload, and the timer restarts at the same value.

```
[PROVEN] FALSE_URGENCY
  1 countdown timer restarted at the same value after a page reload
  6 seconds later. The deadline is not real.

  method: two page loads separated by measured wall-clock time.
          A genuine deadline must decrease by at least the interval.
          It did not, so the timer was reset by the page.
```

Six seconds of real time passed and the page pretended they had not. That turns
the most common dark pattern in Indian e-commerce from an accusation into an
observation — the difference between a complaint and a filing.

## What it refuses to claim

**Four of the thirteen cannot be established from a page render, and the report
says so with the same prominence as the findings:**

| Pattern | Why not checked |
|---|---|
| Subscription trap | needs a real paid subscription and a cancellation attempt |
| Bait and switch | needs to compare what was advertised against what was delivered |
| SaaS billing | needs billing records, not a page |
| Rogue malware | a security-tooling problem, deliberately out of scope |

A tool that quietly covers 9 of 13 and prints a green tick has converted a gap
into a clean bill of health — **which is precisely the failure the
self-declaration regime is already suffering from.** Repeating it in software
would be worse than useless.

For the same reason, a scarcity claim is reported as `INDICATIVE`, never
`PROVEN`: this scan cannot see the seller's inventory, so it records a claim
requiring substantiation rather than a proven lie.

## What is built

```
engine/         zero-dependency detection engine, runs in browser AND Node
  registry.js     the 13 patterns, legal text, clause, detectability
  measure.js      WCAG 2.2 contrast, rendered area, visibility, selectors
  detectors.js    the 9 patterns a page render can speak to
  scan.js         orchestrator → findings / notDetected / notChecked
extension/      Chrome MV3, closed Shadow DOM panel
cli/audit.mjs   headless auditor + the countdown reload proof
test/           26 tests in real Chromium
```

**One engine, two surfaces.** `build.mjs` copies the engine into the extension
and records a hash of each file. The shopper's extension and the auditor's CLI
run byte-identical detection logic — if they could disagree about the same page,
neither would be evidence.

## Run it

```bash
node build.mjs                                    # copy engine into extension
npm test                                          # 26 tests, real Chromium

node cli/audit.mjs https://example.com --out out  # audit a page
node cli/audit.mjs https://example.com --no-proof # skip the reload test
```

Load `extension/` as an unpacked extension at `chrome://extensions`.

## The test that matters most

Any regex can find a violation on a page built to contain one. **Eight of the
26 tests run against a deliberately clean checkout** — same commerce, same
priced add-ons, same sponsored block, all built honestly — and assert that
**nothing fires**:

```
ok - CLEAN PAGE: no findings at all on an honestly built checkout
ok - CLEAN PAGE: unticked paid add-ons are NOT basket sneaking
ok - CLEAN PAGE: comparable accept/decline buttons are NOT interference
ok - CLEAN PAGE: a plainly worded "No thanks" is NOT confirm shaming
ok - CLEAN PAGE: a legible "Sponsored" label is NOT a disguised advertisement
```

The false-positive rate is what gets an audit tool thrown out of the room. Two
signals are required before most detectors fire: a bigger primary button is
ordinary design; a bigger primary button **plus** a decline nobody can read is
interference.

Tests run in real Chromium, not a DOM simulator — half these detectors depend on
computed styles and composited backgrounds, and a simulator would let the suite
pass while the product failed.

## Bugs found by building it

- **FORCED_ACTION matched on class names.** It selected `.modal`, `.popup`,
  `[class*="overlay"]` and missed a full-screen sign-in wall whose only
  identifier was `id="wall"`. Rewritten to detect *geometry and stacking* —
  real interstitials are not obliged to name themselves helpfully, and the sites
  trying hardest not to be caught are exactly the ones that won't.
- **Scarcity findings double-counted.** A card wrapping three urgency lines
  matched the same regex its own child did, quoting the whole card as evidence
  for a claim one line inside it made. Now keeps only the innermost match.
- **NAGGING was reported as "not checked" after being checked.** The snapshot
  scan correctly can't see repetition, but the CLI *does* observe for it, and
  the report has to say which.

## Status, honestly

- **Works today:** engine, extension, CLI, the reload proof, 26 passing tests.
- **Deliberately absent:** published listing, hosted scanner, multi-page
  checkout traversal (the thing that would turn DRIP_PRICING from indicative
  into proven), Hindi/regional-language phrase sets for confirm shaming.
- **Thresholds are policy, not physics.** 3× area and 3.0:1 legibility are
  stated in every report so a platform can dispute the *rule* rather than the
  result.
- **Not legal advice.** Structured readings of published guidelines, recorded
  so a human can audit the machine's reasoning.

## Licence

MIT. Uses no third-party runtime dependencies.

Sources: [CCPA Guidelines 2023 (JSA summary)](https://www.jsalaw.com/newsletters-and-updates/ccpa-issues-guidelines-for-prevention-and-regulation-of-dark-patterns-2023/) ·
[CCPA self-audit advisory (PIB)](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2134765) ·
[26 platforms declare compliance (PIB)](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2191948&reg=3&lang=2) ·
[Amazon filing vs findings (MediaNama)](https://www.medianama.com/2026/04/223-amazon-self-declaration-dark-patterns-ccpa-india/) ·
[95% of top platforms (Outlook Business)](https://www.outlookbusiness.com/news/95-of-indias-top-digital-platforms-use-dark-patterns-as-sebi-tightens-scrutiny)
