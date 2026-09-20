# Evidence, admissibility, and what this deliberately does not claim

> Not legal advice. This describes design intent and the shape of the artefact.
> Whether any particular bundle is admissible anywhere is a question for a
> lawyer in that jurisdiction, on those facts.

## Why a dashboard screenshot is not evidence

It has no chain of custody, no statement of the process that produced it, and
no way for an opposing party to check it. It is a picture of an assertion.

Evidence regimes for computer-generated records converge on roughly the same
requirements, whatever the jurisdiction:

1. **Identify the process** that produced the record
2. **Show the process operated properly** in the ordinary course
3. **Preserve chain of custody** from source to artefact
4. **Enable independent checking** by the other side

The evidence bundle is shaped to carry all four.

## The process certificate

India's Bharatiya Sakshya Adhiniyam, 2023 — successor to the Evidence Act, 1872
— continues the earlier regime's requirement that electronic records be
accompanied by a certificate giving particulars about the device and process
that produced them. Comparable requirements exist elsewhere: business-records
exceptions in US federal practice, and the presumption regimes in England and
Wales.

Every bundle therefore carries a `process` block stating, in plain declarative
sentences aimed at an adjuster or a judge rather than a developer:

- that the record was produced by an automated process in the ordinary course
- exactly which sources were queried
- that for each, the request URL, HTTP status, and two SHA-256 digests were recorded
- that sources were licence-screened **before** contact, with exclusions listed
- that every value carries a derivation class, and the process **cannot raise one**
- that where nothing capable of detecting the event was available, the process
  reports the claim as undetermined and **does not report it as false**

### What the engine refuses to do

It does not generate a human declarant.

A certificate under these regimes is a statement by a *person* who takes
responsibility. A program cannot swear to anything, and a system that
auto-populates that field is manufacturing exactly the kind of false assurance
this project exists to prevent. The field is `null`, and the rendered
certificate says so in a highlighted box, naming the gap and who must fill it.

## Two digests, doing two different jobs

```
responseDigest   raw bytes        chain of custody — proves what arrived
contentDigest    normalised records  reproducibility — proves what it meant
```

This split was forced by a real failure. The first verifier compared raw bodies
and reported tampering on its very first honest re-check — because USGS stamps
every GeoJSON response with `metadata.generated`, the current epoch. Two
identical queries a second apart differ in bytes and agree in meaning.

**An alarm that always fires is worse than no alarm, because people switch it
off.** So reproduction re-runs the adapter and compares normalised records,
answering the question that actually matters — *does this source still say the
same thing about this claim?* — while raw drift is reported and demoted to a
note.

## Why response bodies are not stored

The bundle commits to what was seen **without republishing it**.

This is a licensing feature wearing a cryptography costume. Several sources are
ODbL, CC BY-NC, or proprietary. Embedding their payloads in a document that then
circulates through a dispute is redistribution, and may breach terms the
attestation was supposed to respect. Digests let an independent party who
re-obtains the same response demonstrate identity, with nothing redistributed.

## Reproduction failure is not invalidity

Deliberately, the reproduction check does **not** gate `valid`.

A source that revises a record months later does not retroactively make an
honestly-issued bundle dishonest. It makes it a correct record of *what was
knowable at the time* — which is the only thing any evidence artefact can ever
be.

And the divergence itself is the signal. It is how you discover that the number
your payout was computed from no longer exists upstream. A system that silently
re-fetches and overwrites destroys exactly this information, every time, and
nobody notices.

## What the signature does and does not prove

The bundle says this in its own words, on the certificate:

> This signature establishes only that the bundle has not been altered since
> issue. It makes no representation that the underlying sources were correct.

A signed lie is the failure mode of every attestation system that oversells its
cryptography. The disclaimer is asserted in a test, so it cannot be quietly
removed.

## Stated limitations, carried on every certificate

- A verdict is a statement about available evidence, not a finding of fact.
- Licence summaries are structured readings of publicly stated terms as at the
  recorded verification date. Not legal advice; terms change.
- Modelled and estimated values carry their models' error characteristics,
  which this record does not independently quantify.
- Re-verification depends on upstream continuing to serve. Revised or withdrawn
  records will not reproduce.
