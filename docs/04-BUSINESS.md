# Business: what this is worth, and to whom

## The product is not the engine

The engine is table stakes. Three things compound, and only one of them is code.

### 1. The licence registry — the asset that is genuinely hard to copy

God's Eye View's `DATA_SOURCES.md` is 57,000 words of hand-audited licensing
work: per feed, what the terms permit, what attribution is required, what the
rate limit is, whether commercial use is allowed at all. Months of lawyer-brain
labour, and it is *prose* — which means it is advisory. Nothing in the running
system stops anyone shipping an OpenSky-backed commercial product tomorrow.

Here, licence is a runtime gate that **refuses to run**, and it runs *before any
request is sent* — which matters, because under several of these terms the act
of querying at commercial scale is itself the breach. A system that fetches and
then filters has already done the thing it was avoiding.

A registry covering hundreds of feeds, each with a verification date, a
commercial-use determination and an enforced obligation set, is a moat that
grows with time and cannot be scraped. It is the land under the store.

### 2. The observability map — the inverse product nobody sells

Every geospatial product tells you what *is* there. Run this engine at scale and
you accumulate something nobody is selling:

> **A map of where on Earth claims cannot be verified.**

Blind spots are where fraud is cheapest, where insurance is least priceable, and
where a sensor investment has the highest marginal value. Three different buyers
want that map for three different reasons, and it falls out as exhaust from
doing the primary job.

### 3. The attestation corpus

Every issued bundle is a timestamped, signed record of what was knowable about a
place at a moment. That corpus appreciates: its value is precisely that it
cannot be back-dated. It is the closest thing to a title registry for physical
claims.

## Revenue shapes, honestly ranked

| Model | Motion | Verdict |
|---|---|---|
| Per-attestation API | Self-serve, usage-priced | **Start here.** Cheap to build, buyer can start small, aligns price with value |
| Verification-as-a-service | Volume contract per portfolio | Best margin at scale; needs one reference customer first |
| Licence-compliance audit | *"Which feeds is your product illegally built on?"* | **Sharpest wedge.** Small, fast, urgent, and opens the door |
| Observability index | Data licence to underwriters | Highest long-run value, needs the corpus first |
| Open core | Engine MIT, registry + issuance commercial | The distribution strategy, not a revenue line |

**The licence-compliance audit deserves emphasis** because it inverts the
usual sales problem. Every enterprise shipping a geospatial or AI-grounding
product is built on public feeds someone chose in an afternoon. Almost none have
audited whether their commercial use is permitted. That is a small, urgent,
easily-priced engagement that requires no trust in your verdicts — and it lands
you inside the account holding the map of their entire data supply chain.

## Go to market: the smallest honest wedge

Do **not** open with "verification platform." Open with a free, brutal artefact:

> **The Blind Spot Report** — pick one district, one port, one insured portfolio.
> Produce the certificate showing what could and could not be verified there,
> and what it would have cost them to have been wrong.

It is cheap to produce, it is specific, and it makes a problem the buyer already
half-suspected suddenly legible. Nobody can argue with a document that says
*here is precisely what you cannot currently know.*

Then: one insurer or one NBFC as design partner. One vertical, all the way to a
settled claim. Depth beats breadth here, and the reference matters more than the
feature.

## What NOT to build

Stated plainly, because these are the attractive wrong turns:

- **A globe.** It is the demo. It is not the product. Build it last, if at all.
- **All fifteen layers.** Breadth was right for God's Eye View — it is a
  showcase. Depth is right for this. Four excellent, legally-clean, deeply
  understood sources beat forty shallow ones, and the fortieth adapter adds
  nothing a buyer will pay for.
- **Anything requiring a non-commercial feed.** The gate exists precisely so
  this fails loudly at design time rather than quietly at deposition time.
- **A confidence score with no lattice behind it.** That is the thing being
  displaced. Shipping one would be a self-refuting product.

## Why a solo builder can actually win here

The five "obvious" pivots — ports, airports, infrastructure twins, disaster
consoles, geospatial chat — all lose to incumbents *using the incumbents' own
inputs*. This one does not, for four structural reasons:

1. **Incumbents cannot adopt the honesty model.** A product that says
   `INDETERMINATE` competes badly against one that always answers — right up
   until the first large dispute. An incumbent with a coverage-claim on their
   website cannot start admitting blind spots without repricing their contracts.
2. **The licence gate is anti-commercial in the short run.** It removes sources.
   No growth-stage company ships a feature that shrinks their data surface.
3. **The asset is curatorial, not capital-intensive.** It compounds with careful
   attention rather than with funding.
4. **The buyer is not shopping.** They are losing money on a specific dispute.
   That is a much shorter path to a cheque than displacing an installed dashboard.

## The job-hunt value, stated plainly

The weak version: *"I built a 3D globe with live flight data."* Impressive for
about eight seconds, and every reviewer has seen five.

The strong version, which is what this repository actually demonstrates:

> I built a verification engine for claims about the physical world. It
> implements a provenance lattice with a proven monotonicity invariant, enforces
> data licensing as a runtime gate that refuses to issue non-compliant
> attestations, models observability so the system can distinguish "this did not
> happen" from "we could not have known," and issues signed, independently
> reproducible evidence bundles.

Then the three things that actually get someone hired, because they are what
senior engineers listen for:

- **A bug caught by reasoning, not by a stack trace.** Staleness decay was
  aging out catalogued earthquakes. Fixing it required inventing the EVENT/STATE
  distinction — a modelling insight, found by asking *why is this number wrong*
  rather than by a failing assertion.
- **A design corrected by contact with reality.** Raw-byte hashing failed on
  first real use because USGS stamps every response. The fix — splitting custody
  from reproducibility into two digests — is better than the original design,
  and the reasoning is written down where the next person will find it.
- **A judgement call with a stated position.** The refutation floor is
  asymmetric on purpose, the reason is distributional, and it is exposed as a
  parameter so a counterparty can disagree in a contract rather than in a
  lawsuit.

That profile — someone who found a modelling error by thinking, corrected a
design by testing it against the world, and can defend a judgement call on
grounds that are not purely technical — is the one that ends interviews early.
