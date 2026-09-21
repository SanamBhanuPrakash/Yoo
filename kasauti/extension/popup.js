/** Asks the content script for the report it already computed. */
const TONE = { PROVEN: '#c62842', STRONG: '#c9761b', INDICATIVE: '#5d6874' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: 'KASAUTI_GET_REPORT' }, (report) => {
    const out = document.getElementById('out');
    if (chrome.runtime.lastError || !report) {
      out.textContent = 'Reload the page and try again.';
      return;
    }
    const s = report.summary ?? {};
    out.innerHTML =
      `<div class="row">
        <div><div class="n">${s.findingCount ?? 0}</div><div class="k">Findings</div></div>
        <div><div class="n">${s.proven ?? 0}</div><div class="k">Proven</div></div>
        <div><div class="n">${s.patternsNotChecked ?? 0}</div><div class="k">Not checked</div></div>
      </div>` +
      (report.findings ?? []).slice(0, 6).map((f) =>
        `<div class="f"><span class="tag" style="background:${TONE[f.confidence] ?? '#5d6874'}">
          ${esc(f.confidence)}</span> ${esc(f.pattern.replace(/_/g, ' '))}
          <div style="margin-top:5px">${esc(f.summary)}</div></div>`).join('');
  });
});
