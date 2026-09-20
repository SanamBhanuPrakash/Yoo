# Relationship to God's Eye View

[`bilawalsidhu/gods-eye-view`](https://github.com/bilawalsidhu/gods-eye-view) —
~168,000 lines, roughly half of it tests, ~40 live public data sources, a
57,000-word licensing document.

**No code was copied.** This repository has zero dependencies and shares no
source with it. What was taken is architectural reasoning, and what was rejected
is worth recording as clearly as what was kept.

## What that project gets right, and deserves credit for

Having read the actual source rather than the README:

- **The layer decomposition is real.** `vessels/` splits into lifecycle,
  rendering, selection, tracking, cards, evidence, queries, policy. That is
  disciplined engineering, not a weekend experiment.
- **`DATA_SOURCES.md` is an act of unusual professional care.** Forty feeds,
  each with terms, attribution, rate limits and commercial-use notes. Most
  projects ship a list of URLs.
- **It labels its own simulations.** Traffic vehicles are generated over real
  OSM roads with real TomTom flow; the rocket replay is marked
  `RECONSTRUCTED ESTIMATE`. Being that honest about your own synthetic content,
  in a product whose appeal is looking real, is rare and admirable.
- **CCTV source-health tracking** distinguishes upstream, Street View fallback
  and synthetic frames, so a dead camera cannot silently look alive.
- **`analystEngine.js`** is explicit that it is pure query logic over
  client-side data and never fetches — a clean engine/surface seam.

## The three ideas taken, and how each was sharpened

| Taken from GEV | What Sakshya does with it |
|---|---|
| `REAL / DERIVED / ESTIMATED / SIMULATED` labelling | Turned into an **ordered lattice with a proven monotonicity invariant**. A label is a note; a lattice is a guarantee. Checked exhaustively over all 125 combinations. |
| `DATA_SOURCES.md` licence prose | Turned into a **runtime gate that refuses to run**, screening *before* any request. Documented compliance you can forget; enforced compliance you cannot. |
| CCTV source-health / fallback chain | Generalised into the **observability envelope** — five scored factors, product not mean, with a hard zero meaning the source is never contacted and the reason recorded. |

## The idea GEV does not have, which is the whole product

God's Eye View answers *"what is happening?"*

It has no way to express **"this could not have been known."** Nothing in the
layer model distinguishes *the sensor looked and saw nothing* from *no sensor
was looking*. For a visualisation tool that is entirely fine — an empty map
region reads as empty, and no money moves on it.

For anything that settles a claim it is fatal, and it is the gap this repository
is built around.

## What was deliberately rejected

**The globe.** Cesium, 3D tiles, the whole rendering stack. It is the least
defensible part of the system, the most expensive to maintain, and the thing
every fork will copy. Sakshya's visual output is a printable certificate,
because the artefact needs to survive a dispute, not impress a scroll.

**Breadth.** Forty sources is right for a showcase. Four legally-clean,
deeply-modelled sources are right for an evidence engine. The fortieth adapter
adds nothing a buyer pays for; the first adapter that models its own detection
floor adds everything.

**Google 3D Tiles and TeleGeography.** Both registered in the licence registry,
both blocked. Google's terms restrict caching, extraction and deriving geodata
from imagery — exactly what anyone planning computer vision over 3D tiles
intends to do. TeleGeography's bundled cable dataset is CC BY-NC-SA, and GEV
itself warns commercial users to remove it. Sakshya enforces that warning rather
than repeating it.

**OpenSky.** Fully implemented in `src/sources/opensky.js`, and refused for any
commercial use by the gate. **The refusal is the feature.** It is the cheapest
possible way to learn that an MIT-licensed repository does not relicense the
feeds it calls — a sentence that is in a README somewhere and is read by
approximately nobody.

## Attribution

This project uses no God's Eye View code. It cites it as prior art for the
provenance-labelling and source-health concepts, and recommends reading its
`DATA_SOURCES.md` as the best public example of open-data licensing diligence
in a hobby-scale project.

Live sources used here are attributed per the licence registry, and every
certificate carries the required attribution lines for the sources that actually
contributed to it.
