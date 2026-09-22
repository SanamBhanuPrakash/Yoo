/**
 * Kasauti content script.
 *
 * Runs the same engine files the CLI auditor runs — copied by build.mjs, never
 * forked. If a shopper and an auditor could be told different things about the
 * same page, neither statement would be evidence.
 *
 * The panel lives in a CLOSED Shadow DOM. Not decoration: this runs on pages
 * that are, by hypothesis, trying to manipulate the person reading it. A host
 * page must not be able to restyle, read or remove a warning about itself.
 *
 * Status colour never carries meaning alone — every state ships as
 * glyph + word + colour, so the panel survives colour-blindness and greyscale.
 */
(function () {
  'use strict';
  if (window.__kasautiLoaded) return;
  window.__kasautiLoaded = true;

  var K = globalThis.Kasauti;
  if (!K || !K.scan) return;

  var STATUS = { critical: '#d03b3b', serious: '#ec835a', warning: '#fab219', good: '#0ca30c' };
  var CONF = {
    PROVEN: { c: STATUS.critical, g: '●', w: 'PROVEN' },
    STRONG: { c: STATUS.serious, g: '◐', w: 'STRONG' },
    INDICATIVE: { c: STATUS.warning, g: '○', w: 'INDICATIVE' },
  };
  var GRADE = { A: STATUS.good, B: STATUS.good, C: STATUS.warning, D: STATUS.serious, E: STATUS.critical };

  var report = null;
  var score = null;
  var open = false;
  var tab = 'findings';

  function run() {
    try {
      report = K.scan();
      score = K.score ? K.score(report) : null;
    } catch (err) {
      report = { error: String(err && err.message || err), findings: [], notChecked: [], summary: {} };
      score = null;
    }
  }

  var host = document.createElement('div');
  host.setAttribute('data-kasauti', '');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;';
  var shadow = host.attachShadow({ mode: 'closed' });
  (document.body || document.documentElement).appendChild(host);

  function css() {
    return [
      ':host{all:initial}',
      '*{box-sizing:border-box;font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;margin:0}',
      '.badge{display:flex;align-items:center;gap:9px;background:#141719;color:#fff;border-radius:999px;',
      '  padding:8px 8px 8px 15px;font-size:13px;font-weight:650;cursor:pointer;',
      '  box-shadow:0 4px 20px rgba(0,0,0,.34);user-select:none;border:1px solid rgba(255,255,255,.12)}',
      '.badge:focus-visible{outline:2px solid #3987e5;outline-offset:2px}',
      '.grade{display:flex;align-items:center;justify-content:center;width:26px;height:26px;',
      '  border-radius:50%;font-size:12px;font-weight:800;color:#111}',
      '.panel{display:none;position:absolute;right:0;bottom:50px;width:400px;max-height:74vh;',
      '  overflow:auto;background:#fcfcfb;color:#0b0b0b;border-radius:15px;',
      '  box-shadow:0 14px 54px rgba(0,0,0,.3);border:1px solid #e1e0d9}',
      '.panel.open{display:block}',
      '@media (prefers-color-scheme:dark){.panel{background:#1a1a19;color:#fff;border-color:#2c2c2a}}',
      '.hd{padding:15px 17px 12px;border-bottom:1px solid #e1e0d9;position:sticky;top:0;background:inherit;z-index:2}',
      '@media (prefers-color-scheme:dark){.hd{border-color:#2c2c2a}}',
      '.t{font-size:15px;font-weight:700;letter-spacing:-.01em}',
      '.s{color:#898781;font-size:10.5px;margin-top:2px;letter-spacing:.04em}',
      '.kpi{display:flex;gap:9px;margin-top:12px}',
      '.k{flex:1;border:1px solid #e1e0d9;border-radius:9px;padding:8px 10px}',
      '@media (prefers-color-scheme:dark){.k{border-color:#2c2c2a}}',
      '.k .kl{font-size:9px;letter-spacing:.11em;text-transform:uppercase;color:#898781;font-weight:700}',
      '.k .kv{font-size:21px;font-weight:750;line-height:1.15;margin-top:3px;letter-spacing:-.02em}',
      '.meter{height:5px;border-radius:3px;background:#e1e0d9;overflow:hidden;margin-top:6px}',
      '@media (prefers-color-scheme:dark){.meter{background:#2c2c2a}}',
      '.meter i{display:block;height:100%;border-radius:3px}',
      '.tabs{display:flex;gap:4px;margin-top:12px}',
      '.tb{flex:1;border:0;background:transparent;color:#898781;font-size:11px;font-weight:700;',
      '  letter-spacing:.07em;text-transform:uppercase;padding:7px 4px;border-radius:7px;cursor:pointer}',
      '.tb[aria-selected="true"]{background:#e1e0d9;color:#0b0b0b}',
      '@media (prefers-color-scheme:dark){.tb[aria-selected="true"]{background:#2c2c2a;color:#fff}}',
      '.body{padding:13px 17px 17px}',
      '.f{border:1px solid #e1e0d9;border-radius:10px;padding:11px 13px;margin-bottom:8px}',
      '@media (prefers-color-scheme:dark){.f{border-color:#2c2c2a}}',
      '.fh{display:flex;align-items:center;gap:7px;flex-wrap:wrap}',
      '.chip{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:800;',
      '  letter-spacing:.07em;padding:2px 7px;border-radius:99px;border:1px solid currentColor}',
      '.pn{font-size:9.5px;letter-spacing:.08em;color:#898781;font-weight:700}',
      '.lg{font-size:9px;letter-spacing:.05em;padding:2px 6px;border-radius:99px;background:#e1e0d9;color:#52514e;font-weight:700}',
      '@media (prefers-color-scheme:dark){.lg{background:#2c2c2a;color:#c3c2b7}}',
      '.fs{margin-top:7px;font-weight:600;font-size:13px;line-height:1.45}',
      '.q{border-left:3px solid #2a78d6;padding:5px 10px;margin-top:7px;font-style:italic;',
      '  background:rgba(42,120,214,.07);font-size:12px;border-radius:0 6px 6px 0}',
      '.cell{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;',
      '  border:1px solid #e1e0d9;margin-bottom:5px;font-size:12px;border-left-width:3px}',
      '@media (prefers-color-scheme:dark){.cell{border-color:#2c2c2a}}',
      '.cell .cn{flex:1;font-weight:600}',
      '.cell .cs{font-size:10.5px;font-weight:700}',
      '.warn{border-left:3px solid ' + STATUS.serious + ';background:rgba(236,131,90,.08);',
      '  padding:9px 11px;margin-bottom:7px;font-size:11.5px;line-height:1.55;border-radius:0 8px 8px 0}',
      '.ok{background:rgba(12,163,12,.09);border-radius:9px;padding:11px 13px;font-size:12.5px;line-height:1.55}',
      '.ft{margin-top:11px;padding-top:10px;border-top:1px solid #e1e0d9;color:#898781;font-size:10px;line-height:1.6}',
      '@media (prefers-color-scheme:dark){.ft{border-color:#2c2c2a}}',
    ].join('');
  }

  function render() {
    var s = report.summary || {};
    var total = (report.findings || []).length;
    var proven = s.proven || 0;
    var gradeColor = score ? (GRADE[score.grade] || STATUS.warning) : STATUS.good;

    shadow.innerHTML =
      '<style>' + css() + '</style>' +
      '<div class="badge" id="b" role="button" tabindex="0" aria-expanded="' + open + '">' +
        '<span>' + (total > 0 ? total + ' pattern' + (total === 1 ? '' : 's') : 'Nothing found') + '</span>' +
        (score ? '<span class="grade" style="background:' + gradeColor + '">' + score.grade + '</span>' : '') +
      '</div>' +
      '<div class="panel' + (open ? ' open' : '') + '" id="p" role="dialog" aria-label="Kasauti dark pattern report">' +
        '<div class="hd">' +
          '<div class="t">Kasauti</div>' +
          '<div class="s">CCPA DARK PATTERN GUIDELINES, 2023</div>' +
          (score ? '<div class="kpi">' +
            '<div class="k"><div class="kl">Index</div><div class="kv" style="color:' + gradeColor + '">' +
              score.value + '</div><div class="meter"><i style="width:' + score.value + '%;background:' + gradeColor + '"></i></div></div>' +
            '<div class="k"><div class="kl">Assurance</div><div class="kv">' + score.assurance + '%</div>' +
              '<div class="meter"><i style="width:' + score.assurance + '%;background:#2a78d6"></i></div></div>' +
            '<div class="k"><div class="kl">Proven</div><div class="kv" style="color:' + STATUS.critical + '">' +
              proven + '</div></div>' +
          '</div>' : '') +
          '<div class="tabs" role="tablist">' +
            tabBtn('findings', 'Findings') + tabBtn('matrix', 'All 13') + tabBtn('scope', 'Not checked') +
          '</div>' +
        '</div>' +
        '<div class="body">' + bodyFor(tab) + '</div>' +
      '</div>';

    var badge = shadow.getElementById('b');
    badge.addEventListener('click', toggle);
    badge.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    Array.prototype.forEach.call(shadow.querySelectorAll('.tb'), function (b) {
      b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); render(); });
    });
  }

  function toggle() {
    open = !open;
    render();
  }

  function tabBtn(id, label) {
    return '<button class="tb" role="tab" data-tab="' + id + '" aria-selected="' +
      (tab === id) + '">' + label + '</button>';
  }

  function bodyFor(which) {
    if (which === 'matrix') return matrixHtml();
    if (which === 'scope') return scopeHtml();
    var fs = report.findings || [];
    if (!fs.length) {
      return '<div class="ok"><strong>Nothing found</strong> on the patterns this check can ' +
        'measure. Four of the thirteen were never checked — see <em>Not checked</em> before ' +
        'reading this as compliance.</div>';
    }
    return fs.slice(0, 25).map(findingHtml).join('') + footer();
  }

  function findingHtml(f) {
    var c = CONF[f.confidence] || CONF.INDICATIVE;
    var ev = f.evidence || {};
    var quote = ev.matchedPhrase || ev.declineText || ev.label || ev.disclosureText || ev.text;
    var lang = ev.language;
    return '<div class="f"><div class="fh">' +
      '<span class="chip" style="color:' + c.c + '"><span aria-hidden="true">' + c.g + '</span>' + c.w + '</span>' +
      '<span class="pn">' + esc(f.pattern.replace(/_/g, ' ')) + '</span>' +
      (lang && lang !== 'English' ? '<span class="lg">' + esc(lang) + '</span>' : '') +
      '</div><div class="fs">' + esc(f.summary) + '</div>' +
      (quote ? '<div class="q">' + esc(String(quote).slice(0, 170)) + '</div>' : '') +
      '</div>';
  }

  function matrixHtml() {
    var byPattern = (report.summary || {}).byPattern || {};
    var notChecked = {};
    (report.notChecked || []).forEach(function (n) { notChecked[n.pattern] = true; });
    return (K.ORDER || []).map(function (id) {
      var p = K.PATTERNS[id] || {};
      var hits = byPattern[id] || 0;
      var color; var glyph; var word;
      if (notChecked[id]) { color = STATUS.serious; glyph = '□'; word = 'not assessed'; }
      else if (hits) { color = STATUS.critical; glyph = '●'; word = hits + ' found'; }
      else { color = STATUS.good; glyph = '✓'; word = 'clean'; }
      return '<div class="cell" style="border-left-color:' + color + '">' +
        '<span aria-hidden="true" style="color:' + color + '">' + glyph + '</span>' +
        '<span class="cn">' + esc(p.legalName || id) + '</span>' +
        '<span class="cs" style="color:' + color + '">' + word + '</span></div>';
    }).join('') + footer();
  }

  function scopeHtml() {
    var html = (report.notChecked || []).map(function (n) {
      return '<div class="warn"><strong>' + esc(n.legalName) + '</strong> · ' +
        esc(n.clause) + '<br>' + esc(n.reason) + '</div>';
    }).join('');
    if (report.lexiconCoverage) {
      html += '<div class="warn"><strong>Language coverage</strong><br>' +
        esc(report.lexiconCoverage.warning) + '</div>';
    }
    return html + footer();
  }

  function footer() {
    return '<div class="ft">INDICATIVE findings are signals, not proven violations. ' +
      'This is an automated reading of one page against the CCPA Guidelines 2023 — ' +
      'not legal advice and not a determination of liability.</div>';
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  run();
  render();

  // Escape closes the panel, as any dialog should. Kasauti does not get to
  // commit the pattern it is reporting on.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) { open = false; render(); }
  });

  // Single-page storefronts swap the whole view without navigating, so a
  // one-shot scan at load goes stale the moment a product page opens.
  var t = null;
  new MutationObserver(function () {
    clearTimeout(t);
    t = setTimeout(function () { run(); render(); }, 1400);
  }).observe(document.body, { childList: true, subtree: true });

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
      if (msg && msg.type === 'KASAUTI_GET_REPORT') {
        if (!report) run();
        reply({ report: report, score: score });
      }
      return true;
    });
  }
})();
