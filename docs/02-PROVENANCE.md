# The provenance lattice

The formal core. Implemented in [`src/provenance/lattice.js`](../src/provenance/lattice.js),
with the central theorem checked exhaustively in `lattice.test.mjs`.

## Two axes, deliberately separated

A common modelling error is to put "this is an estimate" and "we found nothing"
on the same scale. They are orthogonal, and collapsing them is the root cause of
the most expensive failure in this space.

**Axis 1 — derivation.** How was the value produced?

```
OBSERVED  (5)  a primary sensor recorded it; read from the publisher of record
DERIVED   (4)  deterministic computation over observations; fully reproducible
MODELED   (3)  a validated model fed with observations; carries the model's error
ESTIMATED (2)  a heuristic whose assumptions nobody validated for this case
SIMULATED (1)  generated; no observation stands behind this instance
```

**Axis 2 — evidential status.** What did the source actually say?

```
POSITIVE       affirmatively reported
NEGATIVE       could have seen it, and did not report it
INDETERMINATE  could not have seen it, or did not answer — proves nothing
```

Keeping these apart is what lets the engine distinguish three things every
other system renders identically:

- *the flood did not happen* — NEGATIVE, source had coverage
- *we found no record of the flood* — NEGATIVE, coverage partial
- *nothing could have seen the flood* — INDETERMINATE

The third is where fraud lives, and it is the one that ships as a green tick.

## The central theorem

> **No operation may increase derivation rank.**

```
result = min( meet(inputs), ceiling(operation) )
```

Two independent ways to lose rank; no way at all to gain it. Operation
ceilings:

| Operation | Ceiling |
|---|---|
| `IDENTITY` | OBSERVED |
| `DETERMINISTIC` | DERIVED |
| `MODEL` | MODELED |
| `HEURISTIC` | ESTIMATED |
| `SYNTHETIC` | SIMULATED |

The ceiling is the half people forget. Feeding observations into a model does
not yield an observation; it yields a well-fed model output. And a
`DETERMINISTIC` step *after* a `MODEL` step does not restore `DERIVED` — you
cannot round-trip your way back to certainty.

This is structurally the same as an information-flow lattice in security, where
secrecy propagates upward and never launders away. Here uncertainty propagates
downward and never launders away.

The test suite verifies this over all 5 × 5 × 5 = 125 combinations rather than
spot-checking, because it is the one property everything else rests on.

## Corroboration raises confidence, never rank

> **Ten estimates that agree are still ten estimates.**

Agreement across independent sources increases `confidence` — a bounded display
quantity — and leaves `derivation` untouched. This is the rule that stops a
model being laundered into an observation by consensus, which is the exact
mechanism behind most "but the system said so" incidents.

Independence is enforced by `lineageRoot`: two feeds that re-publish the same
upstream are one source wearing two hats, and are collapsed before counting.

## Temporality: EVENT vs STATE

This distinction was added after a real bug, and it is worth recording how it
surfaced.

The first working build returned `ESTIMATED` for a directly-observed,
human-reviewed USGS earthquake. The cause: staleness decay, applied relative to
*now*, had aged out a month-old record.

But an earthquake is not a state. It is a timestamped occurrence, and it does
not become less true with age.

```
STATE  a continuously-varying quantity sampled at an instant (vessel position,
       temperature). Describes NOW, therefore decays — a four-hour-old position
       is not a position, it is an extrapolation you are performing silently.

EVENT  a timestamped occurrence (an earthquake at 17:00:39Z, a threshold
       crossed, a payment cleared). Does not decay.
```

Applying `STATE` decay to `EVENT` records silently downgrades the provenance of
every historical record — and historical records are most of what an evidence
engine touches. One line of wrong reasoning would have quietly gutted nearly
every verdict the system ever issued.

What *does* matter for an EVENT is whether the publishing catalogue has settled
— reviewed versus automatic solutions — and that is handled as an observability
`LATENCY` factor, not as staleness. `STATE` remains the default, so an adapter
that forgets to declare fails safe.

## Observability: the second lattice

Derivation says how good the evidence is. Observability says whether there
could have been any.

Five factors, each 0–1 with a stated reason:

```
SPATIAL_COVERAGE       is the location in this source's domain?
TEMPORAL_COVERAGE      does its cadence intersect the claim window?
DETECTION_SENSITIVITY  is the claimed magnitude above its detection floor?
AVAILABILITY           did it actually answer?
LATENCY                was data published in time to cover the window?
```

**The index is the product, not the mean.** This is deliberate and it is the
opposite of how confidence scores are usually built. Averaging lets a hard zero
hide behind four comfortable numbers and lands on a reassuring 0.6. Multiplying
means one genuine blocker produces a hard zero, and the engine then refuses to
answer rather than answering weakly.

A source with zero observability is **never contacted at all** — which saves
quota, and records a far more useful reason than an empty result would have
carried.

## The asymmetry that justifies the system

```
SUPPORT_FLOOR    0.05    to affirm a claim
REFUTATION_FLOOR 0.60    to deny one
```

To deny a claim you must first prove you were looking.

A source with weak coverage that *did* see something has still seen something.
A source with weak coverage that saw nothing has seen nothing — which is not
the same as nothing being there.

Systems that collapse `UNSUPPORTED` into `REFUTED` deny claims hardest in
exactly the places with the thinnest sensor coverage, the sparsest press and no
local station — which is to say, the places least able to contest a denial. The
asymmetry is not a rounding choice. It is a distributional position with a code
path, and the floor is exposed as a parameter so a counterparty can contract on
a different one, with the applied value recorded on the certificate.

## Worked example, from a live run

```
Claim:  a magnitude 2.8+ earthquake occurred near Timbuktu, Mali,
        during August 2026

USGS:   NEGATIVE — no matching event in the catalogue
        observability 0.15
          DETECTION_SENSITIVITY 0.15 — M2.8 is below the ~M4.5 completeness
          threshold for a sparsely instrumented region

Verdict: UNSUPPORTED, not REFUTED
         "we cannot show we would have detected the event had it occurred"
```

The same query for Tokyo, where network density puts completeness near M3.0,
returns full observability and a clean verdict.

**Same source. Same code. Same magnitude. Opposite epistemic standing** — and
the system knows why, states it on the certificate, and refuses to pretend
otherwise.
