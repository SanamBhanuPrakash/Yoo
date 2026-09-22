/**
 * Kasauti — detectors for the nine CCPA patterns a page render can speak to.
 *
 * DESIGN RULE: every finding must quote the evidence that produced it.
 * No finding says "this element is manipulative". Each one says which rule
 * fired, on which element, with which measured values, so a platform's counsel
 * can check the arithmetic and a regulator can reproduce it.
 *
 * FALSE POSITIVES ARE THE ONLY REAL RISK HERE. A tool that flags every
 * checkbox and every green button is noise, gets switched off, and discredits
 * the finding that mattered. So most detectors require TWO independent signals
 * before they fire — a size asymmetry alone is design, a size asymmetry plus an
 * illegible decline is interference.
 */
(function (root) {
  'use strict';

  var K = root.Kasauti = root.Kasauti || {};
  var M = K.measure;
  var C = K.CONFIDENCE;
  var doc = root.document;

  /* ---------------------------------------------------------------- helpers */

  function finding(patternId, confidence, rule, summary, evidence) {
    return {
      pattern: patternId,
      confidence: confidence,
      rule: rule,
      summary: summary,
      evidence: evidence,
    };
  }

  function all(selector, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(selector));
  }

  function visibleAll(selector, ctx) {
    return all(selector, ctx).filter(M.isVisible);
  }

  var CURRENCY = /(?:₹|Rs\.?|INR|\$|USD|€|£)\s?\d|(\d+(?:[.,]\d+)?)\s?(?:₹|rupees|rs\b)/i;

  /* ------------------------------------------------- 1. FALSE URGENCY ----- */

  var SCARCITY = [
    { re: /only\s+\d+\s+(?:left|remaining|in stock|item)/i, label: 'explicit low-stock claim' },
    { re: /\b\d+\s+(?:items?|units?|pieces?|seats?|tickets?)\s+left\b/i, label: 'countable stock claim' },
    { re: /\b(?:almost|nearly)\s+(?:gone|sold\s?out)\b/i, label: 'imminent sell-out claim' },
    { re: /\bselling\s+(?:fast|out)\b/i, label: 'sell-out velocity claim' },
    { re: /\b\d+\s+(?:people|users|others|shoppers)\s+(?:are\s+)?(?:viewing|looking|watching)\b/i,
      label: 'concurrent-viewer claim' },
    { re: /\b\d+\s+(?:bought|sold|booked)\s+in\s+(?:the\s+)?last\b/i, label: 'recent-demand claim' },
    { re: /\bhurry[,!\s]/i, label: 'explicit urgency instruction' },
    { re: /\b(?:deal|offer|sale)\s+ends\s+in\b/i, label: 'deadline claim' },
  ];

  var CLOCK = /\b\d{1,2}\s*:\s*\d{2}(?:\s*:\s*\d{2})?\b/;
  var COUNTDOWN_CONTEXT = /(ends?|expir|hurry|left|remaining|offer|deal|sale|grab|closing|limited)/i;

  function detectFalseUrgency() {
    var out = [];
    var seen = new Set();

    // Leaf-ish elements only: taking the whole <body> as one match would quote
    // the entire page as evidence and tell a reviewer nothing.
    var nodes = visibleAll('span,div,p,b,strong,em,li,small,label,td,h1,h2,h3,h4,h5,h6');

    // Collect first, then keep only the INNERMOST match. A card wrapping three
    // urgency lines satisfies the same regex its own child does, and reporting
    // both quotes the entire card as evidence for a claim made by one line
    // inside it. That is noise, and noise is what gets an audit tool dismissed.
    var matches = [];
    nodes.forEach(function (el) {
      if (el.children.length > 3) return;
      var text = M.textOf(el, 120);
      if (!text || text.length > 120) return;
      for (var i = 0; i < SCARCITY.length; i += 1) {
        if (SCARCITY[i].re.test(text)) {
          matches.push({ el: el, text: text, sig: SCARCITY[i] });
          return;
        }
      }
    });

    matches.filter(function (m) {
      return !matches.some(function (other) {
        return other.el !== m.el && m.el.contains(other.el);
      });
    }).forEach(function (m) {
      var key = m.text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(finding('FALSE_URGENCY', C.INDICATIVE, 'scarcity-claim',
        'Scarcity or urgency claim shown to the shopper: ' + m.sig.label + '.',
        {
          text: m.text,
          signal: m.sig.label,
          selector: M.cssPath(m.el),
          note: 'A scarcity claim is only a violation if it is FALSE. This scan cannot see the ' +
                'seller inventory, so this is recorded as a claim requiring substantiation, ' +
                'not as a proven violation.',
        }));
    });

    // Multilingual scarcity: the same nodes, read through the Indian-language
    // lexicon. "Sirf 2 bache hain" is Annexure 1(1) exactly as much as
    // "Only 2 left" is, and only one of the two is ASCII English.
    //
    // Innermost-match filtering applies here too. Without it a card and the
    // paragraph inside it both match the same Hindi phrase and the shopper sees
    // the identical finding twice -- which is how a real reviewer learns to stop
    // trusting the list.
    if (K.lexicon) {
      var lexMatches = [];
      nodes.forEach(function (el) {
        if (el.children.length > 3) return;
        var t = M.textOf(el, 120);
        if (!t || t.length > 120) return;
        if (seen.has(t.toLowerCase())) return;
        var hit = K.lexicon.match('FALSE_URGENCY', t);
        if (hit) lexMatches.push({ el: el, text: t, hit: hit });
      });

      lexMatches.filter(function (m) {
        return !lexMatches.some(function (o) {
          // Drop an ancestor only when its descendant matched the SAME phrase;
          // a card whose child says "only 2 left" may separately say "hurry",
          // and that second claim is a real finding of its own.
          return o.el !== m.el && m.el.contains(o.el) && o.hit.matched === m.hit.matched;
        });
      }).forEach(function (m) {
        var key = m.text.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(finding('FALSE_URGENCY', C.INDICATIVE, 'scarcity-claim-nonenglish',
          'Scarcity or urgency claim in ' + m.hit.langName + ': "' + m.hit.matched + '".',
          {
            text: m.text,
            language: m.hit.langName,
            matchedPhrase: m.hit.matched,
            lexiconCoverage: m.hit.coverage,
            selector: M.cssPath(m.el),
            note: 'Detected through the Indian-language lexicon. An English-only detector ' +
                  'reads this page as clean.',
          }));
      });
    }

    // Countdown timers: recorded with their current value so the CLI two-load
    // comparison can turn this from a suspicion into a proof.
    var timers = [];
    var timerEls = [];
    nodes.forEach(function (el) {
      if (el.children.length > 2) return;
      var text = M.textOf(el, 60);
      if (!text || !CLOCK.test(text)) return;
      var context = M.textOf(el.parentElement || el, 200);
      if (!COUNTDOWN_CONTEXT.test(context)) return;
      timerEls.push({ el: el, value: text.match(CLOCK)[0].replace(/\s/g, ''), context: context });
    });
    timerEls.filter(function (t) {
      return !timerEls.some(function (o) { return o.el !== t.el && t.el.contains(o.el); });
    }).forEach(function (t) {
      timers.push({ selector: M.cssPath(t.el), value: t.value, context: t.context });
    });

    if (timers.length) {
      out.push(finding('FALSE_URGENCY', C.INDICATIVE, 'countdown-present',
        timers.length + ' countdown timer(s) presented alongside an offer.',
        {
          timers: timers.slice(0, 8),
          note: 'Presence alone is not a violation. Run the CLI auditor to perform the reload ' +
                'test: a timer that restarts at the same value on a fresh load is fabricated ' +
                'urgency as a matter of fact.',
        }));
    }
    return out;
  }

  /* ---------------------------------------------- 2. BASKET SNEAKING ------ */

  var ADDON = /(donat|contribut|insur|warrant|protect|extended|express|priorit|tip\b|gift\s?wrap|membership|subscri|plus\b|prime\b|assured|handling|packaging|carbon|round[\s-]?up)/i;

  function detectBasketSneaking() {
    var out = [];
    visibleAll('input[type="checkbox"]').forEach(function (box) {
      if (!box.checked) return;
      var label = M.labelFor(box);
      if (!label) return;

      var hasMoney = CURRENCY.test(label);
      var hasAddon = ADDON.test(label);
      if (!hasMoney && !hasAddon) return;

      var conf = hasMoney && hasAddon ? C.PROVEN : C.STRONG;
      out.push(finding('BASKET_SNEAKING', conf, 'prechecked-paid-addon',
        'A checkbox adding an optional' + (hasMoney ? ' priced' : '') +
        ' item is pre-ticked, so the shopper is opted in by default.',
        {
          label: label,
          checkedByDefault: true,
          carriesPrice: hasMoney,
          addOnKeyword: hasAddon ? (label.match(ADDON) || [])[0] : null,
          selector: M.cssPath(box),
          context: M.inContext(box, ['cart', 'checkout', 'basket', 'payment', 'order', 'bag']),
          note: 'The checked state is read directly from the DOM. Consent that the user did ' +
                'not give cannot be inferred from a default.',
        }));
    });
    return out;
  }

  /* ---------------------------------------------- 3. CONFIRM SHAMING ------ */

  var SHAME = [
    /no,?\s*(?:thanks?,?\s*)?i\s*(?:don'?t|do not|would rather not)\s*(?:want|like|care|need)/i,
    /i\s*(?:don'?t|do not)\s*care\s+about/i,
    /i\s*(?:like|prefer|enjoy)\s+(?:paying|to pay)\s+(?:full|more)/i,
    /i\s*(?:hate|don'?t want)\s+(?:saving|discounts?|money|deals?)/i,
    /i'?(?:ll|m)\s+(?:risk|pass|take my chances|fine paying)/i,
    /no,?\s*i'?m\s+(?:not\s+)?(?:fine|ok|okay|happy)\s+(?:with|paying)/i,
    /i\s*(?:don'?t|do not)\s*(?:want|need)\s+to\s+(?:save|be\s+(?:smart|safe|protected))/i,
    /no,?\s*i\s*(?:enjoy|prefer|like)\s/i,
    /(?:not|no)\s+interested\s+in\s+(?:saving|growing|protecting)/i,
    /i'?m\s+okay\s+(?:losing|missing|paying)/i,
  ];

  var DECLINE_HINT = /(no|not now|later|skip|maybe|decline|reject|cancel|dismiss|close|continue without)/i;

  function detectConfirmShaming() {
    var out = [];
    var lex = K.lexicon;
    var controls = visibleAll('button,a,[role="button"],input[type="button"],input[type="submit"],label');
    controls.forEach(function (el) {
      var text = M.textOf(el, 200);
      if (!text || text.length > 200) return;

      var hit = null;
      for (var i = 0; i < SHAME.length; i += 1) {
        if (SHAME[i].test(text)) { hit = { langName: 'English', matched: text }; break; }
      }
      // Indian storefronts decline in Hindi, Hinglish, Tamil, Telugu and Bengali.
      // An English-only pass reads those pages as clean, which is worse than not
      // checking at all: it manufactures a pass.
      if (!hit && lex) hit = lex.match('CONFIRM_SHAMING', text);
      if (!hit) return;

      var foreign = hit.langName && hit.langName !== 'English';
      out.push(finding('CONFIRM_SHAMING', C.STRONG,
        foreign ? 'guilt-framed-decline-nonenglish' : 'guilt-framed-decline',
        'The option to decline is worded as a confession of a personal failing' +
          (foreign ? ' (' + hit.langName + ')' : '') + '.',
        {
          declineText: text,
          language: hit.langName || 'English',
          matchedPhrase: hit.matched,
          lexiconCoverage: hit.coverage || null,
          looksLikeDecline: DECLINE_HINT.test(text),
          selector: M.cssPath(el),
          profile: M.profile(el),
          note: 'Quoted verbatim so a reviewer judges the wording directly rather than ' +
                'trusting a classifier opinion of it.',
        }));
    });
    return out;
  }

  /* ------------------------------------------------- 4. FORCED ACTION ----- */

  var CLOSE_HINT = /(close|dismiss|×|✕|✖|skip|not now|maybe later|no thanks|continue without)/i;

  function detectForcedAction() {
    var out = [];

    // GEOMETRY FIRST, NOT NAMING.
    //
    // An earlier version selected `.modal, .popup, [class*="overlay"]` and missed
    // a full-screen sign-in wall whose only identifier was id="wall". Real
    // interstitials are not obliged to name themselves helpfully, and a detector
    // that depends on a developer's class naming is a detector that fails on
    // exactly the sites that are trying hardest not to be caught.
    //
    // What actually defines the pattern is measurable: a positioned element
    // covering most of the viewport, stacked above the page, that you cannot
    // get past.
    var all = Array.prototype.slice.call(doc.querySelectorAll('body *'));
    var bodyStyle = root.getComputedStyle(doc.body);
    var scrollLocked = bodyStyle.overflow === 'hidden' || bodyStyle.position === 'fixed' ||
      root.getComputedStyle(doc.documentElement).overflow === 'hidden';

    var seen = new Set();
    all.forEach(function (el) {
      if (!M.isVisible(el)) return;
      var cs = root.getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') return;

      var coverage = M.viewportCoverage(el);
      if (coverage < 0.35) return;

      // Guard against flagging a full-bleed layout wrapper: a blocking
      // interstitial is stacked above the page AND holds something to act on.
      var z = parseInt(cs.zIndex, 10);
      var stacked = Number.isFinite(z) ? z > 0 : false;
      var interactive = el.querySelector('button,a,input,select,textarea,[role="button"]');
      var backdrop = (M.parseColor(cs.backgroundColor) || [0, 0, 0, 0])[3] > 0.2;
      if (!interactive) return;
      if (!stacked && !backdrop) return;

      // Only report the outermost blocker: a wall and its inner box are one
      // interstitial, not two findings.
      var nested = false;
      seen.forEach(function (prev) { if (prev.contains(el)) nested = true; });
      if (nested) return;

      var path = M.cssPath(el);
      seen.add(el);

      var escapes = visibleAll('button,a,[role="button"],[aria-label]', el).filter(function (c) {
        var t = M.textOf(c, 60) + ' ' + (c.getAttribute('aria-label') || '') + ' ' +
                (c.className || '');
        return CLOSE_HINT.test(t);
      });

      // An overlay you can dismiss, on a page that still scrolls, is a banner.
      if (escapes.length > 0 && !scrollLocked) return;

      var conf = (escapes.length === 0 && scrollLocked) ? C.PROVEN : C.STRONG;
      out.push(finding('FORCED_ACTION', conf, 'inescapable-interstitial',
        'An overlay covering ' + Math.round(coverage * 100) + '% of the viewport blocks the ' +
        'page' + (escapes.length === 0 ? ' with no visible dismiss control' : '') +
        (scrollLocked ? ' and page scrolling is disabled' : '') + '.',
        {
          viewportCoverage: coverage,
          position: cs.position,
          zIndex: cs.zIndex,
          hasBackdrop: backdrop,
          scrollLocked: scrollLocked,
          dismissControlsFound: escapes.length,
          dismissControlText: escapes.slice(0, 3).map(function (c) { return M.textOf(c, 40); }),
          text: M.textOf(el, 200),
          selector: path,
          note: 'Detected from rendered geometry and stacking, not from class names, so it ' +
                'holds on pages that do not label their interstitials.',
        }));
    });
    return out;
  }

  /* --------------------------------------- 6. INTERFACE INTERFERENCE ------ */

  var ACCEPT = /^(accept|accept all|allow|allow all|agree|i agree|ok|okay|got it|yes|continue|proceed|subscribe|sign up|buy|add|enable|turn on|allow all cookies)\b/i;
  var DECLINE = /^(reject|reject all|decline|deny|no thanks?|no,|not now|later|maybe later|skip|cancel|manage|customise|customize|preferences|opt out|only necessary|necessary only|essential only)\b/i;

  /** Ratios above which an asymmetry stops being taste and starts being design intent. */
  var AREA_RATIO_THRESHOLD = 3;
  var LEGIBILITY_FLOOR = 3.0;   // WCAG AA large-text minimum

  function detectInterfaceInterference() {
    var out = [];
    var containers = visibleAll('[role="dialog"],[role="alertdialog"],dialog,form,.modal,[class*="consent"],[class*="cookie"],[class*="banner"],[class*="modal"],[class*="popup"],section,footer,div');

    var reported = new Set();
    containers.forEach(function (box) {
      var controls = visibleAll('button,a,[role="button"],input[type="button"],input[type="submit"]', box);
      if (controls.length < 2 || controls.length > 12) return;

      var accepts = controls.filter(function (c) { return ACCEPT.test(M.textOf(c, 40)); });
      var declines = controls.filter(function (c) { return DECLINE.test(M.textOf(c, 40)); });
      if (!accepts.length || !declines.length) return;

      // Compare the most prominent accept against the least prominent decline.
      var a = accepts.sort(function (x, y) { return M.area(y) - M.area(x); })[0];
      var d = declines.sort(function (x, y) { return M.area(x) - M.area(y); })[0];
      if (a === d) return;

      var pa = M.profile(a);
      var pd = M.profile(d);
      var areaRatio = pd.area > 0 ? M.round2(pa.area / pd.area) : null;
      var declineIllegible = pd.contrastRatio !== null && pd.contrastRatio < LEGIBILITY_FLOOR;
      var fontRatio = pd.fontSizePx > 0 ? M.round2(pa.fontSizePx / pd.fontSizePx) : null;

      // TWO signals required. A bigger primary button is ordinary design; a bigger
      // primary button PLUS a decline the user can barely read is interference.
      var sizeSignal = areaRatio !== null && areaRatio >= AREA_RATIO_THRESHOLD;
      var legibilitySignal = declineIllegible || (fontRatio !== null && fontRatio >= 1.4);
      if (!(sizeSignal && legibilitySignal)) return;

      var key = pa.selector + '|' + pd.selector;
      if (reported.has(key)) return;
      reported.add(key);

      out.push(finding('INTERFACE_INTERFERENCE',
        declineIllegible ? C.PROVEN : C.STRONG, 'prominence-asymmetry',
        'The accept control is ' + areaRatio + '× the rendered area of the decline control' +
        (declineIllegible
          ? ', and the decline control sits at ' + pd.contrastRatio +
            ':1 contrast — below the 4.5:1 WCAG AA floor for readable text'
          : '') + '.',
        {
          accept: pa,
          decline: pd,
          areaRatio: areaRatio,
          fontSizeRatio: fontRatio,
          declineContrastRatio: pd.contrastRatio,
          wcagAAFloor: 4.5,
          declineBelowLargeTextFloor: declineIllegible,
          container: M.cssPath(box),
          note: 'Both figures are computed from rendered geometry and WCAG 2.2 relative ' +
                'luminance. They are reproducible by any reviewer on the same page.',
        }));
    });
    return out;
  }

  /* ------------------------------------- 9. DISGUISED ADVERTISEMENT ------- */

  var AD_LABEL = /^(sponsored|promoted|ad|ads|advertisement|paid partnership|in partnership with|promotion)$/i;

  function detectDisguisedAd() {
    var out = [];
    var bodyFont = parseFloat(root.getComputedStyle(doc.body).fontSize) || 16;

    visibleAll('span,div,small,p,label,i,em,b').forEach(function (el) {
      if (el.children.length > 0) return;
      var text = M.textOf(el, 40);
      if (!AD_LABEL.test(text)) return;

      var p = M.profile(el);
      var tooSmall = p.fontSizePx < bodyFont * 0.75;
      var tooFaint = p.contrastRatio !== null && p.contrastRatio < LEGIBILITY_FLOOR;
      if (!tooSmall && !tooFaint) return;

      out.push(finding('DISGUISED_ADVERTISEMENT',
        (tooSmall && tooFaint) ? C.PROVEN : C.STRONG, 'illegible-ad-disclosure',
        'The "' + text + '" disclosure is rendered ' +
        (tooSmall ? 'at ' + p.fontSizePx + 'px against ' + bodyFont + 'px body text' : '') +
        (tooSmall && tooFaint ? ' and ' : '') +
        (tooFaint ? 'at ' + p.contrastRatio + ':1 contrast' : '') + '.',
        {
          disclosureText: text,
          fontSizePx: p.fontSizePx,
          bodyFontSizePx: bodyFont,
          fontSizeRatio: M.round2(p.fontSizePx / bodyFont),
          contrastRatio: p.contrastRatio,
          wcagAAFloor: 4.5,
          selector: p.selector,
          note: 'A disclosure exists but is rendered below normal legibility. A label the ' +
                'reader cannot see does not discharge the disclosure obligation.',
        }));
    });
    return out;
  }

  /* ------------------------------------------------- 8. DRIP PRICING ------ */

  var FEE = /\b(convenience|platform|handling|service|processing|gateway|packaging|surge|booking|restaurant|small\s?order|rain|late\s?night)\s+(fee|charge|charges)\b/i;
  var DEFERRED = /(\+\s*(?:taxes|gst|extra)|excl(?:uding|\.)?\s*(?:of\s*)?(?:taxes|gst)|taxes?\s+(?:and|&)\s+charges\s+extra|extra\s+charges?\s+(?:may\s+)?appl|additional\s+charges?\s+appl|\*\s*(?:t&c|conditions|charges))/i;

  function detectDripPricing() {
    var out = [];
    var seen = new Set();

    visibleAll('span,div,p,li,td,small,label,h1,h2,h3,h4').forEach(function (el) {
      if (el.children.length > 2) return;
      var text = M.textOf(el, 140);
      if (!text) return;

      var feeMatch = text.match(FEE);
      var deferredMatch = text.match(DEFERRED);
      // Indian fee lines are frequently named in Hindi on the same checkout that
      // shows the rest of the page in English.
      var lexHit = (!feeMatch && !deferredMatch && K.lexicon)
        ? K.lexicon.match('DRIP_PRICING', text) : null;
      if (!feeMatch && !deferredMatch && !lexHit) return;

      var key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      out.push(finding('DRIP_PRICING', C.INDICATIVE,
        lexHit ? 'late-fee-line-nonenglish' : feeMatch ? 'late-fee-line' : 'deferred-cost-disclaimer',
        lexHit
          ? 'A separate charge named in ' + lexHit.langName + ': "' + lexHit.matched + '".'
          : feeMatch
            ? 'A separate "' + feeMatch[0] + '" is levied on top of the item price.'
            : 'The displayed price is qualified by a deferred-cost disclaimer.',
        {
          text: text,
          language: lexHit ? lexHit.langName : 'English',
          // Every finding exposes the same evidence contract regardless of which
          // detector produced it, so a consumer never has to special-case one.
          matchedPhrase: lexHit ? lexHit.matched : (feeMatch || deferredMatch)[0],
          lexiconCoverage: lexHit ? lexHit.coverage : null,
          signal: lexHit ? lexHit.matched : (feeMatch || deferredMatch)[0],
          carriesAmount: CURRENCY.test(text),
          selector: M.cssPath(el),
          context: M.inContext(el, ['cart', 'checkout', 'payment', 'total', 'summary', 'bill']),
          note: 'Drip pricing is established by comparing the FIRST advertised price against the ' +
                'FINAL payable amount across a checkout flow. A single page can only surface the ' +
                'signal, so this is indicative. Run the CLI with --flow to prove it.',
        }));
    });
    return out;
  }

  /* ------------------------------------------------ 11. TRICK QUESTION ---- */

  var NEGATION = /\b(not|n't|never|no|none|without|unless|opt[- ]?out|decline|disagree|prevent|avoid|exclude|stop|cease|un(?:check|tick|select))\b/gi;

  function detectTrickQuestion() {
    var out = [];
    visibleAll('input[type="checkbox"],input[type="radio"]').forEach(function (box) {
      var label = M.labelFor(box);
      if (!label || label.length < 12) return;
      var matches = label.match(NEGATION);
      if (!matches || matches.length < 2) return;

      out.push(finding('TRICK_QUESTION', C.STRONG, 'stacked-negation-in-consent',
        'A consent control is labelled with ' + matches.length + ' negations, so ticking it ' +
        'and leaving it unticked are both hard to reason about.',
        {
          label: label,
          negations: matches.map(function (s) { return s.toLowerCase(); }),
          negationCount: matches.length,
          currentState: box.checked ? 'checked' : 'unchecked',
          selector: M.cssPath(box),
          note: 'Quoted in full so a reviewer can judge whether the count reflects real ' +
                'ambiguity. Consent obtained through an unparseable sentence is not consent.',
        }));
    });
    return out;
  }

  /* -------------------------------------------------------------- export -- */

  K.detectors = {
    FALSE_URGENCY: detectFalseUrgency,
    BASKET_SNEAKING: detectBasketSneaking,
    CONFIRM_SHAMING: detectConfirmShaming,
    FORCED_ACTION: detectForcedAction,
    INTERFACE_INTERFERENCE: detectInterfaceInterference,
    DISGUISED_ADVERTISEMENT: detectDisguisedAd,
    DRIP_PRICING: detectDripPricing,
    TRICK_QUESTION: detectTrickQuestion,
  };
  K.THRESHOLDS = {
    AREA_RATIO_THRESHOLD: AREA_RATIO_THRESHOLD,
    LEGIBILITY_FLOOR: LEGIBILITY_FLOOR,
    WCAG_AA_TEXT: 4.5,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
