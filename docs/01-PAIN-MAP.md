# The pain map

Who is currently losing money because they cannot check a claim about the
physical world?

The unit of analysis throughout is one primitive:

> **Did X happen at place P during window W — and how would we know if it had?**

Every row below is that same question wearing different industry clothing.
That is the whole reason this is a platform and not a feature: one primitive,
many buyers.

---

## Part 1 — The structural pain, stated once

Four failures recur in every sector. They are worth naming because most
"solutions" fix only the first, which is the least valuable one.

**1. The verification bottleneck is a human who does not scale.**
A loss assessor, a site engineer, a collateral inspector, an ESG auditor. Slow,
expensive, and — the part nobody says out loud in a sales meeting — *capturable*.
The person certifying the claim is often selected or paid by the party who
benefits from it.

**2. Absence of evidence is silently converted into evidence of absence.**
This is the expensive one. "No record of the event" becomes "the event did not
occur," and the conversion happens invisibly, usually in a spreadsheet. It is
also **regressive by construction**: thin sensor coverage, sparse press and no
local station correlate almost perfectly with being poor. The populations least
able to contest a denial are the ones most likely to receive one.

**3. Model output is laundered into measurement.**
Gridded rainfall becomes "the rainfall." A propagated orbit becomes "the
position." By the time the number reaches the payout engine, the error bars
have been stripped and nobody remembers there were any.

**4. Nobody can re-derive last quarter's number.**
The dashboard has refreshed. The API returns today's answer. The screenshot in
the dispute file cannot be reproduced, and so it is not evidence — it is a
picture of a claim.

Sakshya is structured as a direct answer to each: automate the check (1), make
`INDETERMINATE` a first-class verdict (2), enforce a provenance lattice that
cannot be climbed (3), and issue signed, re-runnable bundles (4).

---

## Part 2 — India, sector by sector

India is the strongest first market, and not for the reason people usually give
("large market"). The actual reason is structural:

> **India has already legislated the obligation to verify, at enormous scale,
> without having built the infrastructure to do it.**

The demand is statutory. That is a far better starting condition than demand
that has to be created.

### Agriculture and crop insurance

**The mechanism.** Crop insurance settlement under PMFBY and its state variants
rests substantially on Crop Cutting Experiments: physical sampling at a defined
unit area, conducted by state staff, aggregated to a yield figure that decides
whether a whole insurance unit is paid.

**The pain.** It is slow, sampling-sparse relative to the number of insurance
units, and it produces a *single* number that determines a *large* payout — a
structure that invites both honest error and dishonest pressure. Farmers dispute
outcomes; insurers dispute losses; states dispute both. Everyone is arguing
about a number that nobody can independently re-derive.

**What Sakshya does.** Not replace the CCE. Produce an *independent parallel
record* for each insurance unit: a signed weather-window attestation stating
what the rainfall evidence shows, at what provenance class, with observability
scored and basis risk recorded. When the CCE and the attestation agree, the
claim settles faster. When they disagree, the disagreement is now legible and
arguable rather than a stalemate between two assertions.

**Critically:** where the evidence cannot decide — sparse coverage, a convective
regime the grid cannot resolve — the engine says `INDETERMINATE` rather than
`REFUTED`. A tool that denies claims it cannot actually assess would do more
harm than the problem it solves.

**Buyer.** Insurers and reinsurers (loss-adjustment cost and fraud), state
agriculture departments (dispute volume), agri-fintechs (underwriting).

### Warehouse receipt finance and commodity collateral

**The mechanism.** A bank or NBFC lends against commodity stored in a warehouse.
A collateral manager certifies the stock exists.

**The pain.** This is the most under-appreciated fraud surface in Indian
lending, and its history is not theoretical — NSEL and the Karvy episode both
turned on the same structure: *an asset certified by someone the lender trusted,
which was not there, or was pledged twice.* The certifier is the single point of
failure and is paid by the borrower's ecosystem.

**What Sakshya does.** Continuous, independent attestation of *activity
signatures* around the facility — vehicle movement, thermal anomalies, structural
change, access patterns — each labelled by provenance, each re-runnable. Not
"the grain is there" (no public sensor can see inside a shed; claiming otherwise
would be exactly the laundering this project exists to prevent) but the far more
useful and honest: **"a facility holding what this receipt claims would show
these signatures, and here is what was and was not observed."** A warehouse that
has had no vehicle movement for six weeks while pledging active turnover is a
loan officer's problem long before it is a court's.

**Buyer.** NBFCs, banks' credit-risk teams, WDRA-registered warehouse operators
wanting a differentiator, commodity exchanges.

### Infrastructure milestone payments

**The mechanism.** Roads, rural housing, irrigation, transmission. Payment is
released against milestone certification by an engineer's site visit.

**The pain.** Geographically dispersed, individually small, collectively
enormous. Verification cost per site is high relative to milestone value, so
sampling is thin, so certification is effectively trust-based.

**What Sakshya does.** A milestone becomes a claim with a threshold and a
window. The attestation records what independent sources observed at that
location during that window — and, just as importantly, what they could not
observe, so a thin verdict is never mistaken for a strong one.

**Buyer.** Infrastructure ministries and state PWDs, multilateral lenders (who
already require independent verification and currently buy it as consulting
hours), EPC contractors wanting to prove performance.

### Listed-company sustainability disclosure (BRSR Core)

**The mechanism.** SEBI's BRSR Core requires specified sustainability metrics
from large listed companies, with assurance.

**The pain.** Assurance is the bottleneck. The assurer must form a view on
physical facts — emissions, water, waste, land — largely from the company's own
reporting. It is expensive, it is slow, and it is structurally circular.

**What Sakshya does.** An independent physical-evidence layer the assurer can
cite: thermal signatures, flaring, water-body change, land-use change around
declared sites, each with provenance and observability. It does not replace the
assurer's judgment. It gives them something to triangulate against that the
company did not supply.

**Buyer.** Assurance firms (this makes their job cheaper and more defensible),
listed companies wanting to pre-empt findings, ESG rating agencies, lenders with
sustainability-linked covenants.

### Real estate and RERA

**The mechanism.** Developers file periodic construction-progress updates.
Buyers and lenders rely on them.

**The pain.** Self-reported. Enforcement is complaint-driven, which means the
buyer discovers the problem at exactly the point where they have least leverage.

**What Sakshya does.** Independent, timestamped construction-progress evidence
per project, re-runnable years later. Its most valuable application is not the
happy path — it is the dispute path, where the question is always *"what was the
actual state on this date?"* and the honest answer today is *"nobody recorded
it independently."*

**Buyer.** Homebuyer associations, lenders with construction-linked disbursement,
insurers, RERA authorities.

### Disaster relief and compensation

**The mechanism.** Post-event compensation (flood, cyclone, fire, landslide) is
assessed and disbursed district by district.

**The pain.** Slow, contested, politically charged. And the same regressive
failure as everywhere else: remote and poor areas have the weakest evidentiary
record and therefore the weakest claims.

**What Sakshya does.** Rapid attestation per affected area with explicit
observability scoring — so a district with poor coverage is flagged as
*under-observed and requiring ground assessment*, rather than quietly receiving
less because less was recorded about it. **This is the single most socially
valuable thing in the whole design, and it falls directly out of refusing to
collapse `UNSUPPORTED` into `REFUTED`.**

**Buyer.** State disaster management authorities, NDMA, relief NGOs,
multilateral funders, reinsurers.

---

## Part 3 — The rest of the world

The same primitive, different regulatory drivers.

### Parametric insurance (global)

The fastest-growing insurance structure and the one most exposed to this
problem. Parametric contracts pay on an index crossing a threshold, which means
**the entire product is a claim about the physical world settled automatically.**
Basis risk — the gap between the index and what the policyholder actually
experienced — is the category's defining dispute.

Sakshya's rainfall adapter is deliberately built as the worked example: it
records the served grid point's distance from the subject, declares `MODELED`
permanently, and scores spatial representativeness against the precipitation
regime. Those three facts are the basis-risk receipt, and today they are
discarded by almost every integration that touches this data.

### Supply chain and trade compliance (EU, US)

CBAM, deforestation regulation, forced-labour import rules. All three share one
structure: **an importer must now make an assertion about physical conditions at
a production site they do not control, in a country they may never visit, and be
able to evidence it.** That is precisely this primitive, and the obligation is
already law.

### Carbon and renewable credits

Additionality and permanence are physical claims. The market's credibility
problem is not that nobody measures — it is that measurement is commissioned and
paid for by the party who benefits from a favourable result. An independent
attestation layer with provenance labelling and a refusal to over-claim is worth
more to this market than another measurement methodology.

### Lender and insurer due diligence (global)

Every secured lender against a physical asset has the warehouse problem in some
form. Every property insurer has the "what was the state of this roof before the
storm" problem.

### AI agent grounding — the sleeper

Enterprises are wiring agents to external data at speed. The failure mode that
will define the next few years of liability is not hallucination in the classic
sense. It is:

> **the agent confidently reports something derived from a stale, dead, or
> jurisdictionally-unlicensed source, and nobody downstream can tell.**

Sakshya's provenance lattice and licence gate are directly usable as a grounding
layer: an agent that calls this gets back not just a value but *what class of
knowledge it is, how well it could have been known, and whether the caller is
even permitted to use it commercially*. That last one is a compliance feature
nobody currently ships, and it becomes urgent the first time a company discovers
its production AI product is built on a research-only feed.

---

## Part 4 — Why the buyer signs

Ranked by how fast the cheque moves, which is not the same as market size:

| Buyer | Budget line | Why they move |
|---|---|---|
| Insurers / reinsurers | Loss ratio, LAE | Direct, measurable cost reduction |
| Lenders (secured) | Credit loss provision | One avoided collateral fraud pays for years |
| Assurance firms | Cost of delivery | Cheaper *and* more defensible engagements |
| Multilateral lenders | Independent verification | Already buy this as consulting hours |
| Regulators / authorities | Enforcement capacity | Mandate exists, capacity does not |
| Corporates under CBAM/ESG | Compliance | Statutory; not discretionary |
| AI platform teams | Risk / legal | Becomes urgent on the first incident |

Note what is absent: nobody on this list is buying a map. Several of them
already refused to buy a map.
