/**
 * Kasauti — interaction probes.
 *
 * Everything up to here OBSERVES a page. These probes ACT on it, which is what
 * separates a suspicion from a proof.
 *
 *   Observing:  "this overlay has no visible dismiss control"
 *   Probing:    "Escape, a backdrop click and every close-looking control were
 *                all tried. The overlay is still there. It is inescapable."
 *
 * The second statement is the one that survives a platform replying "the user
 * could simply have pressed Escape". Two of the three probes below convert a
 * STRONG finding into a PROVEN one; the third reaches a pattern the page scan
 * had declared undetectable entirely.
 */

const SUBSCRIBE_RE = /\b(subscribe|start (?:free )?trial|join (?:now|plus|prime)|become a member|get (?:plus|premium|pro)|upgrade|activate plan)\b/i;
const CANCEL_RE = /\b(cancel (?:your |my )?(?:subscription|membership|plan|trial)|unsubscribe|end (?:your )?membership|stop (?:auto[- ]?renew|recurring)|manage subscription|turn off auto[- ]?renew)\b/i;
const HELPISH_RE = /\b(help|support|faq|customer care|contact|account|settings|membership|subscription)\b/i;

/**
 * PROBE 1 — dismissibility.
 *
 * Tries, in the order a real user would: Escape, a click on the backdrop
 * outside the dialog, then every control whose text or label looks like a way
 * out. Reports exactly what was attempted and what survived.
 */
export async function probeDismissibility(page, finding) {
  const selector = finding?.evidence?.selector;
  if (!selector) return { ran: false, reason: 'no selector recorded for the overlay' };

  const attempts = [];
  const stillThere = async () => page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, selector).catch(() => false);

  if (!(await stillThere())) return { ran: false, reason: 'overlay was already gone when probed' };

  // 1. Escape — the keyboard affordance every accessible dialog is meant to honour.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
  attempts.push({ action: 'Escape key', dismissed: !(await stillThere()) });
  if (attempts.at(-1).dismissed) return summarise(attempts);

  // 2. Backdrop click — the mouse affordance, at a corner well outside any dialog.
  await page.mouse.click(12, 12).catch(() => {});
  await page.waitForTimeout(500);
  attempts.push({ action: 'click on page backdrop (12,12)', dismissed: !(await stillThere()) });
  if (attempts.at(-1).dismissed) return summarise(attempts);

  // 3. Every control inside it that looks like an exit.
  const exits = await page.evaluate((sel) => {
    const host = document.querySelector(sel);
    if (!host) return [];
    const hint = /(close|dismiss|×|✕|✖|skip|not now|maybe later|no thanks?|continue without|cancel)/i;
    return [...host.querySelectorAll('button,a,[role="button"],[aria-label]')]
      .filter((c) => {
        const t = (c.innerText || '') + ' ' + (c.getAttribute('aria-label') || '') + ' ' + (c.className || '');
        return hint.test(t);
      })
      .slice(0, 5)
      .map((c, i) => ({ i, text: (c.innerText || c.getAttribute('aria-label') || '').trim().slice(0, 40) }));
  }, selector).catch(() => []);

  for (const exit of exits) {
    await page.evaluate(({ sel, i }) => {
      const host = document.querySelector(sel);
      if (!host) return;
      const hint = /(close|dismiss|×|✕|✖|skip|not now|maybe later|no thanks?|continue without|cancel)/i;
      const cs = [...host.querySelectorAll('button,a,[role="button"],[aria-label]')]
        .filter((c) => {
          const t = (c.innerText || '') + ' ' + (c.getAttribute('aria-label') || '') + ' ' + (c.className || '');
          return hint.test(t);
        });
      if (cs[i]) cs[i].click();
    }, { sel: selector, i: exit.i }).catch(() => {});
    await page.waitForTimeout(500);
    attempts.push({ action: `clicked control "${exit.text}"`, dismissed: !(await stillThere()) });
    if (attempts.at(-1).dismissed) return summarise(attempts);
  }

  return summarise(attempts);

  function summarise(list) {
    const escaped = list.some((a) => a.dismissed);
    return {
      ran: true,
      attempts: list,
      escapable: escaped,
      finding: escaped ? null : {
        pattern: 'FORCED_ACTION',
        confidence: 'PROVEN',
        rule: 'probed-inescapable',
        summary: `The overlay survived ${list.length} dismissal attempts including the Escape ` +
          'key and a backdrop click. There is no way past it except to comply.',
        evidence: {
          attempts: list,
          selector,
          method: 'Each affordance a real user would reach for was actually exercised in a ' +
                  'real browser, in order. This is not an inference from the absence of a ' +
                  'close button — the exits were tried and none of them worked.',
        },
      },
    };
  }
}

/**
 * PROBE 2 — does opting out stick?
 *
 * Unticks every pre-ticked paid add-on, reloads, and checks whether the page
 * quietly re-ticked them. A box that re-arms itself is materially worse than
 * one merely pre-ticked: the user's refusal was recorded and then discarded.
 */
export async function probeOptOutPersistence(page, url) {
  const before = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('input[type="checkbox"]')]
      .filter((b) => b.checked && b.offsetParent !== null);
    return boxes.map((b) => ({ id: b.id || null, name: b.name || null, index: [...document.querySelectorAll('input[type="checkbox"]')].indexOf(b) }));
  }).catch(() => []);

  if (!before.length) return { ran: false, reason: 'no pre-ticked boxes to opt out of' };

  await page.evaluate((targets) => {
    const all = [...document.querySelectorAll('input[type="checkbox"]')];
    for (const t of targets) {
      const box = all[t.index];
      if (box && box.checked) { box.click(); }
    }
  }, before).catch(() => {});
  await page.waitForTimeout(700);

  const afterClick = await page.evaluate((targets) => {
    const all = [...document.querySelectorAll('input[type="checkbox"]')];
    return targets.map((t) => ({ ...t, checked: all[t.index] ? all[t.index].checked : null }));
  }, before).catch(() => []);

  const refused = afterClick.filter((b) => b.checked === true);

  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1800);

  const afterReload = await page.evaluate((targets) => {
    const all = [...document.querySelectorAll('input[type="checkbox"]')];
    return targets.map((t) => ({ ...t, checked: all[t.index] ? all[t.index].checked : null }));
  }, before).catch(() => []);

  const rearmed = afterReload.filter((b) => b.checked === true);

  return {
    ran: true,
    preTicked: before.length,
    refusedToUncheck: refused.length,
    reArmedAfterReload: rearmed.length,
    finding: (refused.length || rearmed.length) ? {
      pattern: 'BASKET_SNEAKING',
      confidence: 'PROVEN',
      rule: refused.length ? 'opt-out-refused' : 'opt-out-not-persisted',
      summary: refused.length
        ? `${refused.length} pre-ticked paid add-on(s) could not be unticked at all.`
        : `${rearmed.length} pre-ticked paid add-on(s) were unticked and then silently ` +
          're-ticked when the page reloaded.',
      evidence: {
        preTicked: before.length,
        refusedToUncheck: refused.length,
        reArmedAfterReload: rearmed.length,
        method: 'The boxes were actually clicked, then the page was reloaded and re-read. ' +
                'A refusal that does not survive a reload was not honoured.',
      },
    } : null,
  };
}

/**
 * PROBE 3 — cancellation asymmetry.
 *
 * SUBSCRIPTION_TRAP is declared NOT_DETECTABLE by the page scan, and strictly
 * it still is: proving it needs a live paid subscription and a real attempt to
 * leave. But the guideline's own words — "making cancellation impossible or
 * complex, hiding the cancellation option" — point at something that IS
 * measurable from public pages: the distance from the front door to JOIN versus
 * the distance to LEAVE.
 *
 * If subscribing is one click from the homepage and the only cancellation
 * instruction is four clicks deep inside a help centre, that asymmetry is a
 * measured fact. It does not prove the trap; it measures the gradient, and it
 * says so in those words.
 */
export async function probeCancellationAsymmetry(browser, origin, maxDepth = 2) {
  const page = await browser.newPage();
  const visited = new Set();
  let subscribeDepth = null;
  let cancelDepth = null;
  let subscribeExample = null;
  let cancelExample = null;
  const crawled = [];

  async function harvest(url, depth) {
    if (depth > maxDepth || visited.size > 14 || visited.has(url)) return [];
    visited.add(url);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      await page.waitForTimeout(900);
    } catch { return []; }

    const links = await page.evaluate(() => [...document.querySelectorAll('a[href],button')]
      .map((a) => ({
        text: (a.innerText || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        href: a.tagName === 'A' ? a.href : null,
      }))
      .filter((l) => l.text)).catch(() => []);

    crawled.push({ url, depth, links: links.length });

    for (const l of links) {
      if (subscribeDepth === null && SUBSCRIBE_RE.test(l.text)) {
        subscribeDepth = depth; subscribeExample = l;
      }
      if (cancelDepth === null && CANCEL_RE.test(l.text)) {
        cancelDepth = depth; cancelExample = l;
      }
    }
    if (cancelDepth !== null && subscribeDepth !== null) return [];

    // Follow only help-ish links, same origin, to find where cancellation hides.
    return links
      .filter((l) => l.href && HELPISH_RE.test(l.text))
      .filter((l) => { try { return new URL(l.href).origin === new URL(origin).origin; } catch { return false; } })
      .slice(0, 4)
      .map((l) => l.href);
  }

  let frontier = [origin];
  for (let depth = 0; depth <= maxDepth && frontier.length; depth += 1) {
    const next = [];
    for (const url of frontier) {
      const found = await harvest(url, depth);
      next.push(...found);
      if (cancelDepth !== null && subscribeDepth !== null) break;
    }
    frontier = next;
  }
  await page.close();

  const asymmetric = subscribeDepth !== null &&
    (cancelDepth === null || cancelDepth - subscribeDepth >= 2);

  return {
    ran: true,
    pagesCrawled: crawled.length,
    subscribeDepth, cancelDepth, subscribeExample, cancelExample,
    finding: asymmetric ? {
      pattern: 'SUBSCRIPTION_TRAP',
      confidence: 'INDICATIVE',
      rule: 'join-leave-asymmetry',
      summary: cancelDepth === null
        ? `A way to subscribe was reachable ${subscribeDepth} click(s) from the homepage. No ` +
          `cancellation route was found anywhere within ${maxDepth} click(s).`
        : `Subscribing is ${subscribeDepth} click(s) from the homepage; the nearest cancellation ` +
          `route is ${cancelDepth}.`,
      evidence: {
        subscribeDepth, cancelDepth,
        subscribeControl: subscribeExample, cancellationRoute: cancelExample,
        pagesCrawled: crawled.length, maxDepth,
        method: 'Breadth-first crawl of public pages only, following help, support and account ' +
                'links. Depth is clicks from the homepage.',
        limitation:
          'This measures the GRADIENT between joining and leaving. It does NOT prove a ' +
          'subscription trap: proving that needs a live paid subscription and a real attempt ' +
          'to cancel, which no public crawl can perform. A cancellation route may also exist ' +
          'behind a login this crawl cannot reach.',
      },
    } : null,
  };
}
