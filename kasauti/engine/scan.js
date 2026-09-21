/**
 * Kasauti — scan orchestrator.
 *
 * Produces a report with THREE sections, all of equal standing:
 *
 *   findings      what was detected, each with its evidence
 *   notDetected   patterns actively checked that came back clean
 *   notChecked    patterns this method CANNOT establish, and why
 *
 * The third section is the one that makes the report usable as compliance
 * evidence. A scan that silently covers nine of thirteen and prints a green
 * tick has converted a gap into a clean bill of health — which is the exact
 * failure the self-declaration regime is already suffering from. Restating it
 * in a tool would be worse than useless.
 */
(function (root) {
  'use strict';

  var K = root.Kasauti = root.Kasauti || {};
  var doc = root.document;

  var SEVERITY = { PROVEN: 3, STRONG: 2, INDICATIVE: 1 };

  /**
   * Run every available detector against the current page state.
   * @param {{observationMs?: number}} [options]
   */
  function scan(options) {
    var opts = options || {};
    var startedAt = new Date().toISOString();
    var findings = [];
    var errors = [];

    Object.keys(K.detectors).forEach(function (id) {
      try {
        var produced = K.detectors[id]() || [];
        produced.forEach(function (f) { findings.push(f); });
      } catch (err) {
        // A detector that throws must not take the report down with it, and
        // must not silently look like a clean result either.
        errors.push({ pattern: id, error: String(err && err.message || err) });
      }
    });

    findings.sort(function (a, b) {
      return (SEVERITY[b.confidence] || 0) - (SEVERITY[a.confidence] || 0);
    });

    var found = {};
    findings.forEach(function (f) { found[f.pattern] = true; });

    var notDetected = [];
    var notChecked = [];
    K.ORDER.forEach(function (id) {
      var p = K.PATTERNS[id];
      if (p.detectability === K.DETECTABILITY.NOT_DETECTABLE) {
        notChecked.push({
          pattern: id,
          legalName: p.legalName,
          clause: p.clause,
          reason: p.undetectableBecause,
        });
        return;
      }
      if (!found[id]) {
        var checkedHere = Object.prototype.hasOwnProperty.call(K.detectors, id);
        if (!checkedHere) {
          notChecked.push({
            pattern: id, legalName: p.legalName, clause: p.clause,
            reason: 'Requires observation over time or across page states; not covered by a ' +
                    'single instantaneous scan.',
          });
        } else {
          notDetected.push({
            pattern: id, legalName: p.legalName, clause: p.clause,
            detectability: p.detectability,
            caveat: p.detectability === K.DETECTABILITY.HEURISTIC
              ? 'Checked by heuristic. A clean result here is weaker than a clean result on a ' +
                'measurable pattern, and does not prove absence.'
              : p.detectability === K.DETECTABILITY.REQUIRES_FLOW
                ? 'Only the single-page signals were checked; the full pattern needs a flow.'
                : 'Checked by direct measurement of the rendered page.',
          });
        }
      }
    });

    var byPattern = {};
    findings.forEach(function (f) {
      byPattern[f.pattern] = (byPattern[f.pattern] || 0) + 1;
    });

    return {
      formatVersion: 'kasauti-scan/1',
      url: root.location ? root.location.href : null,
      title: doc.title || null,
      scannedAt: startedAt,
      viewport: { width: root.innerWidth, height: root.innerHeight },
      citation: K.CITATION,
      summary: {
        patternsInGuidelines: K.ORDER.length,
        patternsChecked: K.ORDER.length - notChecked.length,
        patternsNotChecked: notChecked.length,
        patternsDetected: Object.keys(byPattern).length,
        findingCount: findings.length,
        proven: findings.filter(function (f) { return f.confidence === 'PROVEN'; }).length,
        strong: findings.filter(function (f) { return f.confidence === 'STRONG'; }).length,
        indicative: findings.filter(function (f) { return f.confidence === 'INDICATIVE'; }).length,
        byPattern: byPattern,
      },
      findings: findings,
      notDetected: notDetected,
      notChecked: notChecked,
      detectorErrors: errors,
      thresholds: K.THRESHOLDS,
      disclaimer:
        'This is an automated reading of a rendered page against the CCPA Guidelines for ' +
        'Prevention and Regulation of Dark Patterns, 2023. It is not legal advice and not a ' +
        'determination of liability. Findings marked INDICATIVE identify a signal consistent ' +
        'with a pattern, not a proven violation. The notChecked section lists patterns this ' +
        'method cannot establish at all; their absence from the findings is not evidence of ' +
        'compliance.',
    };
  }

  /**
   * NAGGING is defined by repetition, so it needs time rather than a snapshot.
   * Watches for interruptions entering the DOM over a window and reports the
   * count. Returns a promise so the CLI and the extension share one path.
   */
  function observeNagging(durationMs) {
    var ms = durationMs || 8000;
    return new Promise(function (resolve) {
      if (typeof root.MutationObserver !== 'function') {
        resolve({ supported: false, interruptions: [] });
        return;
      }
      var interruptions = [];
      var seen = new Set();

      function consider(node) {
        if (!node || node.nodeType !== 1) return;
        var cs;
        try { cs = root.getComputedStyle(node); } catch (e) { return; }
        if (cs.position !== 'fixed' && cs.position !== 'absolute') return;
        if (!K.measure.isVisible(node)) return;
        if (K.measure.viewportCoverage(node) < 0.06) return;
        var path = K.measure.cssPath(node);
        if (seen.has(path)) return;
        seen.add(path);
        interruptions.push({
          at: new Date().toISOString(),
          msSinceStart: Date.now() - t0,
          selector: path,
          text: K.measure.textOf(node, 120),
          coverage: K.measure.viewportCoverage(node),
        });
      }

      var t0 = Date.now();
      var observer = new root.MutationObserver(function (records) {
        records.forEach(function (r) {
          Array.prototype.forEach.call(r.addedNodes, consider);
        });
      });
      observer.observe(doc.body, { childList: true, subtree: true });

      root.setTimeout(function () {
        observer.disconnect();
        resolve({
          supported: true,
          observedMs: Date.now() - t0,
          interruptions: interruptions,
          finding: interruptions.length >= 2
            ? {
                pattern: 'NAGGING',
                confidence: interruptions.length >= 3 ? 'STRONG' : 'INDICATIVE',
                rule: 'repeated-interruptions',
                summary: interruptions.length + ' separate overlay interruptions appeared ' +
                  'within ' + Math.round(ms / 1000) + ' seconds of normal browsing.',
                evidence: {
                  count: interruptions.length,
                  windowMs: ms,
                  interruptions: interruptions.slice(0, 8),
                  note: 'Each interruption is individually defensible. Repetition within a ' +
                        'short window is what the guideline names.',
                },
              }
            : null,
        });
      }, ms);
    });
  }

  K.scan = scan;
  K.observeNagging = observeNagging;
})(typeof globalThis !== 'undefined' ? globalThis : this);
