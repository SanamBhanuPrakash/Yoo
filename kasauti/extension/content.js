/**
 * Kasauti content script.
 *
 * Runs the same engine the CLI auditor runs — byte-identical files, no fork.
 * One engine, two surfaces: a shopper sees it live on the page, an auditor
 * gets the reproducible report. If the two ever disagreed, neither would be
 * trustworthy, so they are not allowed to diverge.
 *
 * The panel renders inside a Shadow DOM. That is not decoration: this thing
 * runs on hostile pages whose CSS would otherwise restyle a warning about
 * that same page. Closed shadow root, no inherited styles, nothing the host
 * page can reach in and change.
 */
(function () {
  'use strict';
  if (window.__kasautiLoaded) return;
  window.__kasautiLoaded = true;

  var K = globalThis.Kasauti;
  if (!K || !K.scan) return;

  var lastReport = null;

  function run() {
    try {
      lastReport = K.scan();
    } catch (err) {
      lastReport = { error: String(err && err.message || err), findings: [], notChecked: [] };
    }
    return lastReport;
  }

  /* ------------------------------------------------------- the badge ----- */

  var host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;right:16px;bottom:16px;';
  var shadow = host.attachShadow({ mode: 'closed' });
  (document.body || document.documentElement).appendChild(host);

  var TONE = {
    PROVEN: '#c62842', STRONG: '#c9761b', INDICATIVE: '#5d6874',
  };

  function render(report) {
    var proven = report.findings.filter(function (f) { return f.confidence === 'PROVEN'; }).length;
    var total = report.findings.length;
    var colour = proven > 0 ? TONE.PROVEN : total > 0 ? TONE.STRONG : '#0a7a52';

    shadow.innerHTML =
      '<style>' +
      ':host{all:initial}' +
      '*{box-sizing:border-box;font-family:ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif}' +
      '.badge{background:' + colour + ';color:#fff;border-radius:999px;padding:9px 15px;' +
        'font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 3px 14px rgba(0,0,0,.3);' +
        'user-select:none;display:flex;align-items:center;gap:7px}' +
      '.panel{display:none;position:absolute;right:0;bottom:46px;width:376px;max-height:66vh;' +
        'overflow:auto;background:#fff;color:#14181d;border-radius:13px;' +
        'box-shadow:0 10px 44px rgba(0,0,0,.28);padding:16px;font-size:13.5px;line-height:1.55}' +
      '.panel.open{display:block}' +
      'h3{margin:0 0 3px;font-size:15px}' +
      '.sub{color:#5d6874;font-size:11.5px;margin-bottom:12px}' +
      '.f{border:1px solid #e0e6ec;border-radius:9px;padding:10px 12px;margin-bottom:8px}' +
      '.tag{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.07em;' +
        'padding:2px 7px;border-radius:99px;color:#fff}' +
      '.pat{font-size:10px;letter-spacing:.07em;color:#5d6874;margin-left:6px;font-weight:700}' +
      '.sum{margin-top:6px;font-weight:600;font-size:13px}' +
      '.q{border-left:3px solid #1a4fd6;padding:4px 9px;margin-top:6px;font-style:italic;' +
        'background:#f5f7f9;font-size:12px}' +
      '.nc{border-left:3px solid #c9761b;background:#fbfbfc;padding:8px 10px;margin-top:6px;' +
        'font-size:11.5px;color:#5d6874;border-radius:0 7px 7px 0}' +
      '.clean{background:#e6f6ef;border-radius:9px;padding:11px 13px;font-size:13px}' +
      '.foot{margin-top:12px;padding-top:9px;border-top:1px solid #e0e6ec;color:#8d97a3;font-size:10.5px}' +
      'h4{margin:14px 0 6px;font-size:10.5px;letter-spacing:.11em;text-transform:uppercase;color:#5d6874}' +
      '</style>' +
      '<div class="badge" id="b">' +
        '<span>' + (total > 0 ? total + ' dark pattern' + (total === 1 ? '' : 's') : 'Page looks clean') + '</span>' +
      '</div>' +
      '<div class="panel" id="p">' +
        '<h3>Kasauti</h3>' +
        '<div class="sub">CCPA Guidelines for Prevention and Regulation of Dark Patterns, 2023</div>' +
        (total > 0 ? report.findings.slice(0, 12).map(findingHtml).join('') :
          '<div class="clean">Nothing found on the patterns this check can measure. ' +
          'Read the next section before treating that as a clean bill of health.</div>') +
        '<h4>Not checked on this page</h4>' +
        report.notChecked.map(function (n) {
          return '<div class="nc"><b>' + esc(n.legalName) + '</b> — ' + esc(n.reason) + '</div>';
        }).join('') +
        '<div class="foot">Findings marked INDICATIVE are signals, not proven violations. ' +
        'This is not legal advice.</div>' +
      '</div>';

    var badge = shadow.getElementById('b');
    var panel = shadow.getElementById('p');
    badge.addEventListener('click', function () { panel.classList.toggle('open'); });
  }

  function findingHtml(f) {
    var ev = f.evidence || {};
    var quote = ev.declineText || ev.label || ev.disclosureText || ev.text;
    return '<div class="f">' +
      '<span class="tag" style="background:' + (TONE[f.confidence] || TONE.INDICATIVE) + '">' +
        esc(f.confidence) + '</span>' +
      '<span class="pat">' + esc(f.pattern.replace(/_/g, ' ')) + '</span>' +
      '<div class="sum">' + esc(f.summary) + '</div>' +
      (quote ? '<div class="q">' + esc(String(quote).slice(0, 180)) + '</div>' : '') +
      '</div>';
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  render(run());

  // Single-page storefronts swap the whole view without a navigation, so a
  // one-shot scan at load would go stale the moment the shopper opens a product.
  var rescanTimer = null;
  new MutationObserver(function () {
    clearTimeout(rescanTimer);
    rescanTimer = setTimeout(function () { render(run()); }, 1200);
  }).observe(document.body, { childList: true, subtree: true });

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
      if (msg && msg.type === 'KASAUTI_GET_REPORT') { reply(lastReport || run()); }
      return true;
    });
  }

  // Exposed for the test harness, which drives the real extension in a real
  // browser rather than trusting that the content script "should" work.
  window.__kasautiReport = function () { return lastReport; };
})();
