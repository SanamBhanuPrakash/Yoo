# Sakshya

**साक्ष्य** — *evidence*.

An evidence engine for claims about the physical world, and a product built on
it: the **Place History Report**.

> **Did X happen at place P during window W — how do you know, and what could
> you not have known?**

It issues a signed, independently reproducible certificate, and it refuses to
answer when the evidence cannot support an answer.

---

## Start here: the blind-window ledger

```console
$ node src/cli.js place 17.385 78.4867 --years 2 --name "Sultan Bazar plot"

Koti Women's College Road, Sultan Bazar, Hyderabad, Telangana, India

  [HIGH  ] 155 consecutive days with no usable satellite view
  [LOW   ] Sloping ground, about 1.67% gradient
  [LOW   ] No M4.0+ earthquake recorded within 150 km in 25 years
```

Measured live: that plot had **344 Sentinel-2 passes in two years, of which only
148 produced a usable view.** The longest unbroken blind window ran **155 days**
(6 June to 8 November 2025), and **50.5% of all days** fell inside a blind window
of two weeks or more.

Every satellite-backed property service shows you a picture and lets you assume
continuous knowledge. This one leads with the gaps — because encroachment,
unauthorised construction and quiet demolition do not happen at random. They
happen when nobody is looking, and this computes, to the day, when that was.

Who it is for: someone about to commit a large sum to land they have not stood
on. See [docs/06-THE-PIVOT.md](docs/06-THE-PIVOT.md) for who pays and why.

---

## Why this exists

This began as an analysis of [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view),
a genuinely impressive 168k-line live-data globe. The obvious thing to build on
it is another dashboard. The obvious *clever* thing is "port intelligence" or
"airport operations" — which loses to Kpler and Cirium while using their own
inputs.

The actual opportunity is elsewhere:

> **Money moves on unverified claims about the physical world.**

A farmer claims crop loss and an insurer pays. A warehouse claims stock exists
and a bank lends. A contractor claims a milestone and a ministry pays. Each is a
physical claim, settled with money, verified by a human who can be wrong, slow,
or captured.

Rendering the world has a thousand competitors and no buyer. **Settling
arguments about it has almost no competitors and a queue of buyers.**

Full reasoning: [docs/00-THESIS.md](docs/00-THESIS.md).

---

## The three things that make it different

### 1. A provenance lattice with a proven invariant

Every value carries a derivation class, and one rule holds absolutely:

> **No operation may increase derivation rank.**

```
OBSERVED > DERIVED > MODELED > ESTIMATED > SIMULATED
result = min( weakest_input, operation_ceiling )
```

You cannot compute your way to a stronger claim than your inputs allow. Feeding
observations into a model yields a model, not an observation. Ten agreeing
estimates are still estimates — corroboration raises *confidence*, never *rank*.

Checked exhaustively over all 125 input/operation combinations, not spot-checked.

### 2. Licensing as a runtime gate, not a README

Every source carries its licence terms as executable policy, screened **before
any request is sent** — because under several of these terms, querying at
commercial scale is itself the breach.

```console
$ node src/cli.js screen --use COMMERCIAL_REDISTRIBUTION

ALLOW  usgs-earthquakes   US-PUBLIC-DOMAIN         OBSERVED
ALLOW  open-meteo         CC-BY-4.0                MODELED
BLOCK  opensky            OPENSKY-NONCOMMERCIAL    OBSERVED
       permits at most NONCOMMERCIAL; COMMERCIAL_REDISTRIBUTION was requested.
       THIS IS THE TRAP: an MIT-licensed repository does not relicense the
       feeds it calls.
```

The OpenSky adapter is fully implemented and permanently refused for commercial
use. **The refusal is the feature.**

### 3. Observability — the ability to say "we could not have known"

Before trusting any answer, the engine scores whether the source *could have
seen* the claim at all: spatial coverage, temporal cadence, detection floor,
availability, latency. Multiplied, not averaged — so one genuine blocker
produces a hard zero instead of hiding behind four comfortable numbers.

This yields a four-way verdict where everyone else ships a boolean:

| Verdict | Meaning |
|---|---|
| `SUPPORTED` | evidence affirms it |
| `REFUTED` | evidence contradicts it **and the sources could have detected it** |
| `UNSUPPORTED` | nothing found, but coverage too weak to deny |
| `INDETERMINATE` | nothing capable of answering was available |

To deny a claim, you must first prove you were looking.

---

## The result, from a live run

Same source, same code, same magnitude claim — opposite epistemic standing:

```
Tokyo, M5.0+, August 2026
  usgs-earthquakes  POSITIVE  observability 1.00
  → SUPPORTED (OBSERVED)
    M5.8, 5 km E of Ushiku, 53.8 km away, human-reviewed

Timbuktu, M2.8+, August 2026
  usgs-earthquakes  NEGATIVE  observability 0.15
    DETECTION_SENSITIVITY 0.15 — M2.8 is below the ~M4.5 completeness
    threshold for a sparsely instrumented region
  → UNSUPPORTED, not REFUTED
    "we cannot show we would have detected the event had it occurred"
```

Every other system returns "no earthquake" for both. The second one is a lie of
omission, and it is regressive: thin sensor coverage correlates with being poor,
so the populations least able to contest a denial are the ones most likely to
get one.

---

## Quick start

No dependencies. Node 22+.

```bash
node src/cli.js screen                                   # what each source permits
node src/cli.js keygen --out .keys                       # ed25519 issuer keypair
node src/cli.js attest examples/claims/mumbai-rainfall.json \
     --out out --key .keys/issuer.key.pem                # evaluate + issue
node src/cli.js verify out/mumbai-rainfall.bundle.json --reproduce
npm test                                                 # 76 tests
```

Five worked examples in `examples/claims/`, one per verdict class:

| Example | Verdict | Demonstrates |
|---|---|---|
| `tokyo-seismic` | `SUPPORTED` | clean observation, full observability |
| `mumbai-rainfall` | `REFUTED` | parametric trigger genuinely missed (81.4 vs 100 mm) |
| `sparse-network-seismic` | `UNSUPPORTED` | refusing to deny what it could not have seen |
| `historic-rainfall` | `INDETERMINATE` | window beyond source horizon — not queried |
| `airspace-commercial` | `BLOCKED` | licence gate; no packet sent |

And the report product:

```bash
node src/cli.js place <lat> <lon> --years 2 --name "My plot" --out out
```

---

## What a certificate contains

Built for an adjuster, an auditor or a judge — not a developer.

- the exact claim, canonically hashed
- the verdict, with provenance class and a plain-language gloss
- per-source findings with observability bars
- **"What could not be known"** — given equal weight, not a footnote
- licence obligations discharged, and sources excluded for legal reasons
- chain of custody: every request, status, and two digests
- a process certificate in declarative sentences
- ed25519 signature that disclaims exactly what it cannot prove

### Two digests, doing two different jobs

```
responseDigest  raw bytes           chain of custody — what arrived
contentDigest   normalised records  reproducibility  — what it meant
```

This split was forced by a real failure. The first verifier compared raw bodies
and cried tampering on its first honest re-check, because USGS stamps every
response with `metadata.generated`. **An alarm that always fires is worse than
no alarm.** Reproduction now re-runs the adapter and compares meaning; byte
drift is reported and demoted to a note.

Response bodies are never stored — the bundle commits to what was seen without
redistributing data it may have no right to redistribute. That is a licensing
feature wearing a cryptography costume.

---

## Architecture

```
claim ──▶ licence gate ──▶ observability ──▶ fetch ──▶ staleness ──▶ verdict ──▶ bundle
          (before any      (before trusting            (EVENT vs     (refutation   (signed,
           request)         any answer)                 STATE)        held higher)  reproducible)
```

```
src/
  provenance/lattice.js    derivation algebra, monotonicity theorem, EVENT/STATE
  license/registry.js      per-source licence facts, fails closed on unknown
  license/policy.js        screening + hard seal gate
  sources/base.js          adapter contract, observability envelope, paced HTTP
  sources/usgs.js          earthquakes — models its own completeness threshold
  sources/openMeteo.js     precipitation — permanently MODELED, records grid offset
  sources/gdelt.js         news — corroboration only, can never refute
  sources/opensky.js       aircraft — implemented, commercially refused
  sources/sentinelWitness.js  Sentinel-2 observation ledger — the blind-window engine
  sources/terrain.js       SRTM terrain — does surface water collect here?
  reports/placeHistory.js  the Place History Report composer
  render/placeReport.js    buyer-facing HTML report
  engine/                  claim grammar, orchestration, verdict algebra
  attest/                  canonical JSON, bundle, ed25519, verifier
  render/certificate.js    self-contained HTML, archivable offline
```

---

## Documentation

| | |
|---|---|
| [00-THESIS](docs/00-THESIS.md) | why this is not a map — the McDonald's decomposition |
| [01-PAIN-MAP](docs/01-PAIN-MAP.md) | who loses money today, India and worldwide, sector by sector |
| [02-PROVENANCE](docs/02-PROVENANCE.md) | the lattice, the theorem, EVENT/STATE, the asymmetry |
| [03-EVIDENCE-AND-LAW](docs/03-EVIDENCE-AND-LAW.md) | admissibility shape, and what this refuses to claim |
| [04-BUSINESS](docs/04-BUSINESS.md) | moat, revenue shapes, go-to-market, what not to build |
| [05-RELATION-TO-GODS-EYE-VIEW](docs/05-RELATION-TO-GODS-EYE-VIEW.md) | what was taken, sharpened, and rejected |
| [06-THE-PIVOT](docs/06-THE-PIVOT.md) | **from an engine nobody buys to a report anybody can** — product, pricing, distribution |

---

## Honest status

This is a working engine with real data, not a product.

- **Works today:** the full pipeline, live, against USGS, Open-Meteo, Sentinel-2
  (Copernicus via Earth Search STAC), SRTM and Nominatim. 95 tests.
- **Rate-limited here:** GDELT returns 503 from shared infrastructure, and
  Open-Meteo's archive endpoint is daily-quota exhausted. Both degrade to
  `INDETERMINATE` exactly as designed — which is the thesis working, not a bug.
- **Deliberately absent:** persistence, a service API, auth, payments, a web UI.
  Those are engineering, and none of them change whether the idea is right.
- **The clearest gap:** historical water extent (JRC Global Surface Water). The
  Bihar example shows why — on a flat floodplain, terrain is the wrong
  instrument and SRTM honestly reports that it cannot resolve the question.
  Observed historical water is the right instrument, and needs COG pixel reading.
- **Licence summaries are structured readings of public terms**, dated, and not
  legal advice.

---

## Licence

MIT for this code. **The data is not MIT** — each source keeps its own terms,
recorded in `src/license/registry.js` and enforced at runtime. That sentence is
the single most important line in this README.

Prior art: [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view) — no
code copied; cited for its provenance-labelling and source-health concepts, and
for `DATA_SOURCES.md`, the best public example of open-data licensing diligence
at hobby scale.
