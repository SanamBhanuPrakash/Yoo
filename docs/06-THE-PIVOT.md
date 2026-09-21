# The pivot: from an engine nobody buys to a report anybody can

## What I got wrong the first time

The first build was an enterprise B2B evidence engine. Buyer: insurer, bank,
regulator. Sales cycle nine to eighteen months. Requires a reference customer
before anyone signs, and a network to get the first meeting.

It was intellectually defensible and **commercially unreachable for a solo
builder in India with no enterprise relationships.** I optimised for "idea that
survives scrutiny" and ignored "buyer who can say yes next week." That is the
error, stated plainly.

## What survives, and why the work was not wasted

The engine was the hard half, built in the wrong order.

Strip the provenance lattice out of a land report and you have some satellite
pictures and a confident paragraph — which anyone with an LLM can produce in
four minutes, and which will be wrong in ways the buyer cannot detect. **The
lattice is what makes the report a document instead of a guess.** It is also
the only part a competitor with the same API keys cannot cheaply copy, because
copying it means being willing to tell your customer what you do not know.

So: same engine, aimed at a buyer who is already looking for you.

## The product

A **Place History Report** for any piece of land on Earth.

The hero feature is the one nobody sells, because it is the one everybody is
motivated to hide:

> **The blind-window ledger.** To the day, when was this plot visible from
> orbit — and when was it not?

Measured, live, for a real Hyderabad plot over two years:

```
344 satellite passes.  148 produced a usable view.
Longest unbroken blind window:  155 days   (6 June to 8 November 2025)
Share of all days inside a 14+ day blind window:  50.5%
```

Half the time, that plot was invisible to every public satellite in orbit.

That number is worth money because **encroachment is not random.** Boundary
walls go up, structures come down, and access roads get cut when nobody is
looking. A 155-day gap is enough for all three, with no public trace. And when
a seller shows a buyer satellite imagery, the buyer can now check its date
against the red bands and ask why it was chosen.

Every competing product shows a picture and lets you assume continuous
knowledge. This one leads with the gaps.

## Who pays, ranked by how fast

| Buyer | Why they pay now | Price |
|---|---|---|
| **NRI buying land remotely** | Cannot visit. Terrified. Has money. Trusts nobody local. | ₹1,499–4,999 |
| First-time peri-urban buyer | Life savings on a plot they saw once | ₹499 |
| Lawyer in a boundary dispute | Needs evidence of physical state on a past date | ₹2,499–9,999 |
| Bank/NBFC field verification | Cannot visit every plot | per-report contract |
| Buyer's own family in India | Doing the check on someone else's behalf | ₹499 |

**The NRI segment is the wedge and it should be the entire first year.** They
are wealthy, geographically concentrated in a handful of countries, reachable
through communities that already exist, systematically defrauded, and have no
trusted option. They do not need to be educated that the problem is real —
most of them have a relative it happened to.

## The unit economics you asked about

Your model was 10,000 customers at ₹500. Taking it seriously:

```
10,000 x  ₹499  one-time            =  ₹49.9L
 1,500 x  ₹199/mo monitoring x 12   =  ₹35.8L      <- the recurring half
                                       --------
                                        ₹85.7L
```

Marginal cost per report is close to zero: every source is free and
commercially licensed. USGS and SRTM are US public domain. Sentinel-2 is
Copernicus free-full-open with explicit commercial permission. The licence gate
in `src/license/policy.js` is what lets you say that with a straight face —
and it is why a competitor who grabbed a convenient non-commercial feed has a
liability you do not.

**The monitoring tier is where your subscription lives.** A plot is not a
one-time question. "Tell me when this plot becomes visible again, and when
anything changes" is a standing need for anyone who owns land they cannot
watch — which in India is a very large number of people, including most of the
NRI segment. Same engine, run on a schedule.

### Tiering, in the shape of your voice-CRM example

That student did not invent anything. He tuned commodity AI hard for an
underserved specific, wrapped it in a complete system, and tiered it. Same move:

- **Free** — the blind-window check alone. One number, instantly, for any
  coordinate. This is the lead magnet, and it is genuinely useful, which is why
  it will travel.
- **₹499** — the full report: observation ledger, terrain and water, seismic,
  and the "what this could not determine" section.
- **₹1,499** — adds a second opinion pass, a dispute-ready signed bundle with a
  verifiable hash, and a printable version.
- **₹199/month** — monitoring, with alerts.
- **₹9,999** — the dispute pack: a specific past date, deep-searched, signed,
  with the process certificate for legal use.

## Why this survives "everyone has AI"

This is the objection that matters, so here is the direct answer.

Anyone can ask an LLM to "analyse this plot from satellite data." It will
produce a fluent, confident paragraph. It will also be **confabulated**, because
the model has no access to the STAC catalogue, cannot paginate 344 scenes, and
cannot compute a gap it never measured. The output will look identical in
quality to a real report and be worthless — and the buyer cannot tell the
difference.

That is not a weakness in your position. It is the whole position.

What cannot be prompted into existence:

1. **The measurement.** 344 scenes, paginated, cloud-filtered, gaps computed to
   the day. That is code hitting a real catalogue, not a language model
   remembering one.
2. **The refusal.** The Bihar report says the terrain question *cannot be
   answered* because the height difference sits inside the DEM's own noise
   floor. No LLM volunteers that. Every incentive in a generated report pushes
   toward a confident answer.
3. **The licence position.** Being able to sell the output at all.
4. **The reproducibility.** A signed bundle that a second party can re-run.

The moat is not the code — it is roughly 4,500 lines and a competent engineer
could rebuild it in a month. **The moat is the willingness to ship a product
whose headline feature is telling the customer what you do not know.** A
competitor optimising for conversion will not do that, and an LLM asked to
write a property report certainly will not.

## The honest risk

It is not technical. It is **distribution**, and it is the whole game.

Ten thousand customers means roughly two to five lakh people seeing the free
check, at a 2–5% conversion. Realistic paths, hardest last:

1. **Channel, not direct.** One property lawyer who orders forty reports a month
   is worth more than four hundred individuals, and costs one conversation.
   Same for NRI-focused property consultants and relocation agents.
2. **The free check as the artefact that travels.** "Your plot was invisible for
   155 days" is a screenshot people forward. That is the growth loop, and it
   costs nothing to run.
3. **One viral comparison.** Two adjacent plots, wildly different observation
   records, posted where NRIs read.

Direct consumer acquisition by ads is the expensive path and should be last.

## What to build next, in order

1. **Historical water extent** (JRC Global Surface Water). The single highest-value
   missing signal: *was this plot under water at any point in the last 35 years?*
   The Bihar report exposed exactly why it is needed — on flat floodplains SRTM
   cannot resolve micro-topography, so terrain is the wrong instrument and
   observed historical water is the right one. Requires COG pixel reading.
2. **Built-up change detection.** Was there a structure here in 2019? Needs pixel
   analysis and must stay honest about 10 m resolution: at plot scale this can
   support "something changed," never "a house was built."
3. **The free blind-window check as a web page.** The growth loop.
4. **Monitoring on a schedule.** The recurring revenue.
5. **Payments and delivery.** Boring, and the thing that actually converts work
   into money.

Note that (1) and (2) are the only items requiring new science. Everything else
is plumbing — which is the correct shape for a project at this stage.
