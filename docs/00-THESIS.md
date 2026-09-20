# The thesis: why this is not a map

## The question I was actually asked

> Look at God's Eye View. Find the move nobody is making.

The obvious move is to fork the globe. The clever move — the one a good
strategist reaches in about twenty minutes — is to say "the globe is the demo,
the pipeline is the asset," and then build **Port Intelligence**, or **Airport
Operations**, or a **Disaster Console**.

That clever move is a trap, and it is worth being precise about why, because it
looks so much like the right answer.

## Why the clever answer is still the wrong answer

Take the port-intelligence idea seriously for one minute. To win you must beat
Kpler, Windward, Spire, MarineTraffic and Clarksons. They have licensed AIS,
satellite constellations, decades of reference data, and enterprise sales
forces. And here is the killer: **you would be competing against them using
their own inputs.** The same AIS. The same weather. The same port polygons.

When your inputs are identical to the incumbent's, your only remaining axes are
brand, sales and capital — the three axes where a solo builder loses by
definition. Every one of the five "obvious smart" products has this shape. They
are God's Eye View with a logo, wearing a suit.

## The McDonald's decomposition, done properly

The famous story is usually mis-told as "pivot to real estate." That is not the
insight. Harry Sonneborn's actual move was structural:

> **Find the asset the business accidentally accumulates whose economics are
> better than the business itself — then make that the business.**

Burgers were the visible transaction: thin margin, operationally brutal,
fiercely competitive. Land under the store was the invisible one: appreciating,
financeable, and *paid for by the franchisee*. Same company, same buildings,
entirely different economics.

So: **what does God's Eye View accidentally accumulate?**

Not the globe. Not the layers. Four things, and only one of them has better
economics than the thing it was built for:

| Accidental asset | Can it be copied in a weekend? |
|---|---|
| The 3D globe | Yes — Cesium is open source |
| ~40 adapters to public feeds | Yes — they are public |
| A 57,000-word hand-audited **licence map** of those feeds | **No — that is months of lawyer-brain work** |
| The honesty model (`REAL / DERIVED / ESTIMATED / SIMULATED`) | **No — that is a worldview** |

The bottom two rows are the land under the store.

They are also, tellingly, the two things the repository's author put the most
care into and that every fork will throw away first, because they are invisible
in a screenshot.

## The move

> **Money moves on unverified claims about the physical world.**

A farmer claims crop loss and an insurer pays. A contractor claims a road is
built and a ministry pays. A warehouse claims commodity is in it and a bank
lends. A plant claims emissions compliance and a regulator accepts. A developer
claims construction progress and a buyer commits.

Every one of those is **a claim about physical reality, settled with money,
verified by a human who can be captured, delayed, or simply wrong.**

And God's Eye View's architecture — observe physical reality from independent
public sources, label exactly how you know, show the timeline — is, without
anyone having framed it that way, *an engine for adjudicating exactly these
claims*.

So the move is not to make a better map. It is:

> **Stop rendering the world. Start settling arguments about it.**

That is a different business with different economics. Dashboards are bought
from a discretionary budget and churn when the champion leaves. **Evidence is
bought out of a loss-ratio line, a compliance mandate, or a dispute reserve —
and it is bought by whoever is currently losing money to a claim they cannot
check.**

## What changes when you make that turn

Everything downstream inverts.

| Rendering the world | Settling arguments about it |
|---|---|
| More layers is better | **Fewer, deeper, defensible sources is better** |
| Show everything you have | **Show what you could not know, with equal weight** |
| Silence renders as empty | **Silence is a first-class verdict** |
| Live is the product | **Reproducible-later is the product** |
| Licence lives in a README | **Licence is a runtime gate that refuses to run** |
| Output is a screenshot | **Output is an artefact that survives a deposition** |

The right-hand column is what this repository implements.

## The one-sentence version

God's Eye View asks *"what is happening?"* — a question with a thousand
competitors and no buyer.

Sakshya asks *"did this actually happen, how do you know, and what could you
not have known?"* — a question with almost no competitors and a queue of
buyers who are currently losing money for want of an answer.

Same inputs. Different business.

---

### On the name

**साक्ष्य / sākṣya** — Sanskrit: *evidence, testimony*. India's evidence statute
is the *Bharatiya Sakshya Adhiniyam*, 2023. The name states the category, and
it states where the first market is.
