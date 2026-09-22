/**
 * Kasauti — the Compliance Index.
 *
 * A single comparable number, so one platform can be held against another and
 * against itself six months later. That comparability is what turns a scan into
 * an instrument a regulator or a newsroom can actually cite.
 *
 * TWO AXES, NEVER MULTIPLIED TOGETHER
 * -----------------------------------
 * An earlier build folded coverage into the score and produced a contradiction:
 * a clean page scored 100 against its own stated ceiling of 62. A number cannot
 * exceed its own ceiling, and collapsing two different questions into one
 * figure is what made it possible.
 *
 * They are different questions and they stay apart:
 *
 *   SCORE      how clean was the page, across the patterns actually assessed?
 *   ASSURANCE  how much of the total harm surface could be assessed at all?
 *
 * SCORE is what makes platforms comparable — every site audited the same way
 * carries the same assurance, so the scores sit on one scale. ASSURANCE is what
 * stops a good score being read as a clean bill of health. Reported side by
 * side, never combined: "88, at 62% assurance" says exactly what happened, and
 * "88" alone does not.
 *
 * And it is NEVER called compliance. It is "observed compliance on the patterns
 * assessed". A platform passing this has not been certified by anyone; it has
 * failed to be caught by an automated reading of one page.
 *
 * Every weight below is stated in the report so a platform can dispute the
 * FORMULA rather than the result. A score whose arithmetic is hidden is a score
 * nobody has to answer for.
 */
(function (root) {
  'use strict';

  var K = root.Kasauti = root.Kasauti || {};

  /**
   * Harm weights, 1-10. Ordered by how directly the pattern takes money or
   * consent from the user rather than merely nudging them.
   */
  var WEIGHT = {
    BASKET_SNEAKING: 10,        // money added without consent — the most direct taking
    SUBSCRIPTION_TRAP: 10,      // recurring money the user cannot stop
    SAAS_BILLING: 9,            // silent recurring charges
    FORCED_ACTION: 9,           // coerces data or purchase to proceed at all
    DRIP_PRICING: 8,            // the price agreed to was not the price shown
    BAIT_AND_SWITCH: 8,         // delivered goods differ from those advertised
    ROGUE_MALWARE: 8,           // extracts payment through manufactured fear
    FALSE_URGENCY: 6,           // compresses the decision, does not take directly
    TRICK_QUESTION: 6,          // consent obtained through unparseable wording
    INTERFACE_INTERFERENCE: 5,  // steers the choice, leaves it available
    CONFIRM_SHAMING: 5,         // attaches a social cost to declining
    DISGUISED_ADVERTISEMENT: 4, // misattributes the source of a recommendation
    NAGGING: 3,                 // erodes by repetition rather than by a single act
  };

  /** How much of a pattern's weight a finding at each confidence carries. */
  var CONFIDENCE_FACTOR = { PROVEN: 1.0, STRONG: 0.6, INDICATIVE: 0.25 };

  /**
   * Repeat findings of the same pattern add, but with sharply diminishing
   * returns: three pre-ticked boxes are worse than one and nowhere near three
   * times worse, and without this a page with twelve fee lines would score zero
   * on drip pricing alone.
   */
  function repeatMultiplier(n) {
    if (n <= 1) return 1;
    return 1 + Math.log2(n) * 0.35;
  }

  /**
   * Bands. The labels are written so that none of them can be quoted as a
   * clearance: the best one says nothing was OBSERVED, which is a statement
   * about this audit rather than about the platform.
   */
  var BANDS = [
    { min: 90, grade: 'A', label: 'Nothing observed on the patterns assessed' },
    { min: 75, grade: 'B', label: 'Minor patterns observed' },
    { min: 55, grade: 'C', label: 'Multiple patterns observed' },
    { min: 35, grade: 'D', label: 'Serious patterns observed' },
    { min: 0, grade: 'E', label: 'Severe and repeated patterns observed' },
  ];

  /**
   * @param {object} report a scan/audit report
   * @returns {object} the index, its arithmetic, and its ceiling
   */
  function score(report) {
    var findings = report.findings || [];
    var totalWeight = K.ORDER.reduce(function (n, id) { return n + (WEIGHT[id] || 0); }, 0);

    // Group by pattern, keeping the strongest confidence and the count.
    var groups = {};
    findings.forEach(function (f) {
      var g = groups[f.pattern] || (groups[f.pattern] = { count: 0, best: 'INDICATIVE' });
      g.count += 1;
      if (CONFIDENCE_FACTOR[f.confidence] > CONFIDENCE_FACTOR[g.best]) g.best = f.confidence;
    });

    var deductions = Object.keys(groups).map(function (id) {
      var g = groups[id];
      var w = WEIGHT[id] || 5;
      var raw = w * CONFIDENCE_FACTOR[g.best] * repeatMultiplier(g.count);
      // A single pattern can never cost more than its own weight plus half again,
      // so one noisy detector cannot dominate the whole index.
      var capped = Math.min(raw, w * 1.5);
      return {
        pattern: id,
        legalName: (K.PATTERNS[id] || {}).legalName || id,
        weight: w,
        findings: g.count,
        strongestConfidence: g.best,
        confidenceFactor: CONFIDENCE_FACTOR[g.best],
        repeatMultiplier: round2(repeatMultiplier(g.count)),
        deduction: round2(capped),
      };
    }).sort(function (a, b) { return b.deduction - a.deduction; });

    var totalDeduction = deductions.reduce(function (n, d) { return n + d.deduction; }, 0);
    // Normalise to 0-100 against the full weight of all thirteen patterns.
    var raw = 100 - (totalDeduction / totalWeight) * 100;
    var value = Math.max(0, Math.min(100, Math.round(raw)));

    // ---- Assurance: the second axis, never folded into the first --------
    var notChecked = report.notChecked || [];
    var uncheckedWeight = notChecked.reduce(function (n, p) { return n + (WEIGHT[p.pattern] || 0); }, 0);
    var assessedFraction = round3((totalWeight - uncheckedWeight) / totalWeight);
    var assurance = Math.round(assessedFraction * 100);

    var band = BANDS.find(function (b) { return value >= b.min; });

    // ---- The grade cap -------------------------------------------------
    //
    // An earlier build handed a page nine findings -- including confirm shaming
    // in two languages -- and still printed "grade A, no significant patterns
    // observed", because every finding sat on a low-weight pattern and the
    // deductions divided by the full weight of all thirteen.
    //
    // That is precisely the false reassurance this whole project exists to
    // expose, reproduced inside the tool. An audit that FOUND something may not
    // report a clean bill of health, whatever the arithmetic says:
    //
    //   any PROVEN finding   -> cannot be better than C
    //   any finding at all   -> cannot be better than B
    //
    // The raw score is preserved and still comparable; only the grade and the
    // sentence a non-technical reader will quote are capped.
    var provenCount = findings.filter(function (f) { return f.confidence === 'PROVEN'; }).length;
    var capIndex = 0;
    if (provenCount > 0) capIndex = BANDS.findIndex(function (b) { return b.grade === 'C'; });
    else if (findings.length > 0) capIndex = BANDS.findIndex(function (b) { return b.grade === 'B'; });

    var bandIndex = BANDS.indexOf(band);
    var capped = capIndex > bandIndex;
    if (capped) band = BANDS[capIndex];

    return {
      value: value,
      grade: band.grade,
      label: band.label,
      /** True when the grade was held back because the audit found something. */
      gradeCapped: capped,
      gradeCapReason: capped
        ? (provenCount > 0
          ? provenCount + ' proven finding(s) were recorded, so this audit cannot report better ' +
            'than grade C however favourable the weighted arithmetic is.'
          : findings.length + ' finding(s) were recorded, so this audit cannot report a clean ' +
            'bill of health however favourable the weighted arithmetic is.')
        : null,
      provenCount: provenCount,
      /**
       * The SECOND axis: what fraction of the total harm surface this method
       * could assess at all. Never multiplied into `value` — reported beside it.
       */
      assurance: assurance,
      assessedFraction: assessedFraction,
      patternsAssessed: K.ORDER.length - notChecked.length,
      patternsTotal: K.ORDER.length,
      totalDeduction: round2(totalDeduction),
      deductions: deductions,
      formula: {
        description:
          'score = 100 − (Σ deductions / Σ all pattern weights) × 100, where each ' +
          'deduction = harm weight × confidence factor × repeat multiplier, capped at 1.5× ' +
          'the pattern weight.',
        weights: WEIGHT,
        confidenceFactors: CONFIDENCE_FACTOR,
        repeatMultiplier: '1 + log2(n) × 0.35, capped at 1.5× weight',
        totalWeight: totalWeight,
      },
      caveat:
        'This is OBSERVED COMPLIANCE ON THE PATTERNS ASSESSED, not a compliance certification. ' +
        'The score says how clean the assessed patterns were; the assurance figure (' + assurance +
        '%) says how much of the total harm surface could be assessed at all. ' +
        (uncheckedWeight > 0
          ? 'Patterns carrying ' + Math.round((1 - assessedFraction) * 100) + '% of that surface — ' +
            notChecked.map(function (p) { return (K.PATTERNS[p.pattern] || {}).legalName || p.pattern; })
              .join(', ') + ' — were not assessed by this method at all. '
          : '') +
        'A high score means an automated reading of this page did not catch a violation. It is ' +
        'not a finding that none exists.',
    };
  }

  /** Comparative table across several audited sites. */
  function compare(reports) {
    return reports.map(function (r) {
      var s = r.score || score(r);
      return {
        url: r.url,
        title: r.title,
        score: s.value,
        grade: s.grade,
        assurance: s.assurance,
        patternsDetected: Object.keys((r.summary || {}).byPattern || {}).length,
        proven: (r.summary || {}).proven || 0,
        topPattern: s.deductions.length ? s.deductions[0].pattern : null,
      };
    }).sort(function (a, b) { return a.score - b.score; });
  }

  function round2(n) { return Math.round(n * 100) / 100; }
  function round3(n) { return Math.round(n * 1000) / 1000; }

  K.WEIGHT = WEIGHT;
  K.score = score;
  K.compare = compare;
})(typeof globalThis !== 'undefined' ? globalThis : this);
