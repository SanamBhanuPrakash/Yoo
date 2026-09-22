# Kasauti — कसौटी

*The touchstone: the stone jewellers rub gold against to find out whether it is real.*

**A dark pattern auditor for India's CCPA Guidelines, 2023 — that measures instead of guessing, speaks Indian languages, tests the page instead of just reading it, and tells you what it could not check.**

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
| Languages | English | **Hindi, Hinglish, Tamil, Telugu, Bengali, Marathi** |
| Evidence | a highlight | **evidence a reviewer can re-derive** |
| Verification | reads the page | **probes it: presses Escape, unticks boxes, reloads** |
| Comparability | none | **a published Compliance Index with its formula** |
| Scope honesty | silent | **declares 4 of 13 as NOT ASSESSED, and why** |
| Purpose | inform a shopper | **also verify a filed compliance claim** |

## The four things that make the core hard to copy

### 1. It speaks the languages Indian storefronts actually use

Every other detector matches English. Indian e-commerce does not run in English,
and **romanised Hinglish is plain ASCII**, so no Unicode range catches it either.

```
[STRONG]     CONFIRM SHAMING   Hindi
             "नहीं, मुझे बचत नहीं चाहिए"

[STRONG]     CONFIRM SHAMING   Hinglish (romanised Hindi)
             "Nahi, mujhe bachat nahi chahiye"

[INDICATIVE] FALSE URGENCY     Hindi
             "सिर्फ 2 बचे"  ·  "जल्दी करें"
```

An English-only regex reads that page as clean — **which is worse than not
checking, because it manufactures a pass.**

Coverage is declared per language (Hindi and Hinglish `GOOD`; Tamil, Telugu and
Bengali `PARTIAL`; Marathi `MINIMAL`), the scan detects which scripts the page
actually contains, and the report says so when a clean result is weak because
the lexicon is thin.

### 2. It probes the page instead of just reading it

Observation says *"no visible dismiss control."* A probe says *"Escape, a
backdrop click and every close-looking control were tried, in a real browser,
and it is still there."* Only the second survives a platform replying "the user
could simply have pressed Escape."

```
[PROVEN] FORCED_ACTION
  The overlay survived 2 dismissal attempts including the Escape key
  and a backdrop click. There is no way past it except to comply.

[PROVEN] BASKET_SNEAKING
  3 pre-ticked paid add-ons were unticked and then silently re-ticked
  when the page reloaded.
```

A third probe (`--crawl`) measures the distance from the homepage to *subscribe*
against the distance to *cancel*. That does **not** prove a subscription trap —
proving that needs a live paid subscription — and it says so in those words. It
measures the gradient.

### 3. A Compliance Index with its arithmetic published

One comparable number, so a platform can be held against another and against
itself six months later — with the weights, confidence factors and repeat
multiplier printed in every report, so a platform disputes the **rule** rather
than the result.

**Two axes, never multiplied together:**

```
  INDEX  90/100  grade B      how clean, across the patterns assessed
  ASSURANCE  58%              how much of the harm surface was assessable
```

An earlier build folded them into one figure and produced a clean page scoring
100 against its own stated ceiling of 62. A number cannot exceed its own
ceiling; collapsing two questions into one made it possible.

### 4. The grade cap — the tool refusing to reassure

A build of this scored a page **grade A, "no significant patterns observed"**
while holding nine findings, including confirm shaming in two languages, because
every finding sat on a low-weight pattern. That is the false reassurance this
project exists to expose, reproduced inside the tool.

So: **any finding caps the grade at B. Any PROVEN finding caps it at C.** The
raw score is preserved so platforms stay comparable; only the sentence a
non-technical reader will quote is held back. And no band label can be quoted as
a clearance — the best one reads *"Nothing observed on the patterns assessed"*,
which is a statement about the audit, not about the platform.

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
engine/         zero-dependency, runs in a browser AND in Node
  registry.js     the 13 patterns: legal text, clause, detectability
  lexicon.js      Hindi · Hinglish · Tamil · Telugu · Bengali · Marathi
  measure.js      WCAG 2.2 contrast, rendered area, visibility, selectors
  detectors.js    the 9 patterns a page render can speak to
  score.js        the Compliance Index, its formula and the grade cap
  scan.js         orchestrator → findings / notDetected / notChecked
extension/      Chrome MV3, closed Shadow DOM, tabbed panel, dark mode
cli/
  audit.mjs       headless auditor, countdown proof, probes, scoring
  probes.mjs      dismissibility · opt-out persistence · join-leave asymmetry
  report.mjs      the printable audit report
test/           46 tests in real Chromium
```

**One engine, two surfaces.** `build.mjs` copies the engine into the extension
and records a hash of each file. The shopper's extension and the auditor's CLI
run byte-identical detection logic — if they could disagree about the same page,
neither would be evidence.

## Run it

```bash
node build.mjs                                      # copy engine into extension
npm test                                            # 46 tests, real Chromium

node cli/audit.mjs https://example.com --out out    # full audit
node cli/audit.mjs https://example.com --crawl      # + join/leave asymmetry
node cli/audit.mjs https://example.com --no-probe   # read only, do not interact
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

## Design corrections forced by building it

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
- **The score exceeded its own ceiling.** Coverage was folded into the value,
  so a clean page read 100 against a stated ceiling of 62. Split into two axes
  that are reported side by side and never combined.
- **A page with nine findings graded A.** Fixed with the grade cap above — the
  correction that matters most, because it is the tool committing the exact
  failure it audits for.
- **Hindi findings double-counted.** The multilingual pass lacked the
  innermost-match filter the English pass had, so a card and the paragraph
  inside it both reported *"सिर्फ 2 बचे"*. Duplicate findings are how a reviewer
  learns to stop trusting the list.
- **The evidence contract was not uniform.** Drip pricing emitted `signal` where
  every other detector emitted `matchedPhrase`, so a consumer had to
  special-case one detector. Caught by a test asserting the contract, not by a
  crash.

## Status, honestly

- **Works today:** engine, extension, CLI, the reload proof, three interaction
  probes, six-language lexicon, the Compliance Index, 46 passing tests.
- **Deliberately absent:** published listing, hosted scanner, and multi-page
  checkout traversal — the thing that would turn `DRIP_PRICING` from indicative
  into proven by comparing the listed price against the final payable amount.
- **Lexicon coverage is uneven and says so.** Tamil, Telugu and Bengali are
  `PARTIAL`; Marathi is `MINIMAL`. Contributions should lower a coverage level
  rather than raise it when unsure.
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
