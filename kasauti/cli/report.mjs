/**
 * Kasauti audit report.
 *
 * Built on a validated data-viz palette: the four status steps are fixed and
 * never themed, and because two of them sit below 3:1 on a light surface, a
 * status colour NEVER carries meaning alone. Every status in this document
 * ships as glyph + word + colour, so it survives colour-blindness, greyscale
 * printing and forced-colors mode — which matters, because this document is
 * meant to be printed and attached to a filing.
 *
 * Form choices follow the method rather than taste:
 *   score, assurance   single values against a limit → hero number + meter,
 *                      not a gauge and not a two-slice donut
 *   pattern matrix     categorical state across 13 items → a status grid
 *
 * Score and assurance are rendered as two separate meters and never combined
 * into one figure, because they answer different questions.
 */

const STATUS = {
  critical: '#d03b3b',
  serious: '#ec835a',
  warning: '#fab219',
  good: '#0ca30c',
};

const CONF = {
  PROVEN: { color: STATUS.critical, glyph: '●', word: 'PROVEN',
            gloss: 'Established by measurement or by probe. The arithmetic is in the evidence.' },
  STRONG: { color: STATUS.serious, glyph: '◐', word: 'STRONG',
            gloss: 'A measured signal with little room for an innocent reading.' },
  INDICATIVE: { color: STATUS.warning, glyph: '○', word: 'INDICATIVE',
                gloss: 'Consistent with the pattern. Context could explain it. Not a proven violation.' },
};

const GRADE_COLOR = { A: STATUS.good, B: STATUS.good, C: STATUS.warning, D: STATUS.serious, E: STATUS.critical };

export function renderAuditReport(r) {
  const s = r.summary ?? {};
  const sc = r.score;
  const byPattern = s.byPattern ?? {};

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dark Pattern Audit</title>
<style>
  :root{
    --plane:#f9f9f7; --surface:#fcfcfb; --ink:#0b0b0b; --ink-2:#52514e; --muted:#898781;
    --grid:#e1e0d9; --accent:#2a78d6;
    --good:${STATUS.good}; --warning:${STATUS.warning}; --serious:${STATUS.serious}; --critical:${STATUS.critical};
    color-scheme:light;
  }
  @media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])){
    --plane:#0d0d0d; --surface:#1a1a19; --ink:#fff; --ink-2:#c3c2b7; --muted:#898781;
    --grid:#2c2c2a; --accent:#3987e5; color-scheme:dark;}}
  :root[data-theme="dark"]{--plane:#0d0d0d;--surface:#1a1a19;--ink:#fff;--ink-2:#c3c2b7;
    --muted:#898781;--grid:#2c2c2a;--accent:#3987e5;color-scheme:dark;}

  *{box-sizing:border-box}
  body{margin:0;background:var(--plane);color:var(--ink);
    font:15.5px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:940px;margin:0 auto;padding:34px 18px 100px}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;word-break:break-all}

  .eyebrow{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);font-weight:700}
  h1{font-size:25px;margin:8px 0 5px;line-height:1.22;letter-spacing:-.01em}
  .meta{color:var(--ink-2);font-size:12.5px}

  h2{font-size:11px;letter-spacing:.17em;text-transform:uppercase;color:var(--muted);
     margin:42px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--grid);font-weight:700}

  /* ---- KPI row: stat tiles, per the form heuristic --------------------- */
  .kpis{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:12px;margin:20px 0 6px}
  @media(max-width:720px){.kpis{grid-template-columns:1fr 1fr}}
  .tile{background:var(--surface);border:1px solid var(--grid);border-radius:12px;padding:16px 18px}
  .tile .k{font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);font-weight:700}
  .tile .v{font-size:40px;font-weight:750;line-height:1;letter-spacing:-.025em;margin-top:8px}
  .tile.small .v{font-size:27px}
  .tile .u{font-size:13px;font-weight:500;color:var(--muted);margin-left:3px}
  .tile .note{font-size:11.5px;color:var(--ink-2);margin-top:8px;line-height:1.45}

  /* ---- Meter: a single ratio against a limit --------------------------- */
  .meter{height:7px;border-radius:4px;background:var(--grid);overflow:hidden;margin-top:11px}
  .meter i{display:block;height:100%;border-radius:4px}

  /* ---- Pattern matrix -------------------------------------------------- */
  .matrix{display:grid;grid-template-columns:repeat(auto-fill,minmax(212px,1fr));gap:9px}
  .cell{background:var(--surface);border:1px solid var(--grid);border-radius:10px;padding:11px 13px;
        border-left-width:3px;border-left-style:solid}
  .cell .nm{font-size:13.5px;font-weight:650;line-height:1.3}
  .cell .cl{font-size:10.5px;color:var(--muted);font-family:ui-monospace,Menlo,monospace;margin-top:2px}
  .cell .st{font-size:11.5px;margin-top:7px;font-weight:600;display:flex;align-items:center;gap:5px}

  /* ---- Findings -------------------------------------------------------- */
  .f{background:var(--surface);border:1px solid var(--grid);border-radius:12px;padding:17px 19px;margin-bottom:11px}
  .f-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .chip{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:800;letter-spacing:.08em;
        padding:3px 9px;border-radius:99px;border:1px solid currentColor}
  .pat{font-size:10.5px;letter-spacing:.09em;color:var(--muted);font-weight:700}
  .lang{font-size:10px;letter-spacing:.06em;padding:2px 7px;border-radius:99px;
        background:var(--grid);color:var(--ink-2);font-weight:700}
  .sum{font-size:16.5px;font-weight:600;margin-top:10px;line-height:1.42}
  .ev{margin-top:12px;background:var(--plane);border:1px solid var(--grid);border-radius:9px;padding:12px 14px}
  .ev table{width:100%;border-collapse:collapse;font-size:12.5px}
  .ev td{padding:5px 8px;border-bottom:1px solid var(--grid);vertical-align:top}
  .ev tr:last-child td{border-bottom:0}
  .ev td:first-child{color:var(--muted);width:38%;white-space:nowrap}
  .quote{border-left:3px solid var(--accent);padding:7px 12px;margin:9px 0;font-style:italic;
         background:var(--plane);border-radius:0 7px 7px 0;font-size:13.5px}
  .note{color:var(--ink-2);font-size:12.5px;line-height:1.6;margin-top:10px}

  .warn{background:var(--surface);border:1px solid var(--grid);border-left:3px solid var(--serious);
        border-radius:0 10px 10px 0;padding:14px 16px;margin:10px 0;font-size:13.5px}
  .warn b{display:block;margin-bottom:5px}
  .law{background:var(--surface);border:1px solid var(--grid);border-radius:11px;padding:15px 17px;
       font-size:13px;color:var(--ink-2);margin:14px 0;line-height:1.62}
  .clean{background:var(--surface);border:1px solid var(--grid);border-radius:11px;padding:14px 16px;font-size:13.5px}
  img.shot{width:100%;border:1px solid var(--grid);border-radius:11px;margin-top:11px}
  footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--grid);color:var(--muted);
         font-size:11.5px;line-height:1.7}
  @media print{body{background:#fff}.wrap{padding:0}.f,.tile,.cell{break-inside:avoid}}
</style></head><body><div class="wrap">

<div class="eyebrow">Dark Pattern Audit · CCPA Guidelines 2023</div>
<h1>${esc(r.title ?? r.url ?? 'Audit')}</h1>
<div class="meta mono">${esc(r.url ?? '')}</div>
<div class="meta">Audited ${esc((r.audit?.auditedAt ?? r.scannedAt ?? '').slice(0, 19).replace('T', ' '))} UTC
  · viewport ${r.viewport?.width}×${r.viewport?.height}
  ${r.scriptsOnPage?.length ? '· scripts: ' + esc(r.scriptsOnPage.join(', ')) : ''}</div>

${sc ? renderKpis(sc, s) : ''}

<div class="law">
  Assessed against the <strong>${esc(r.citation ?? '')}</strong>
  The Guidelines name thirteen practices and declare them unfair trade practices. On 5 June 2025
  the CCPA directed e-commerce platforms to self-audit against them and file self-declarations.
  This is an independent, reproducible reading of a page — not a legal determination.
</div>

<h2>All thirteen patterns</h2>
<div class="matrix">${renderMatrix(r, byPattern)}</div>
<div class="note">Every one of the thirteen is shown, including the four this method cannot
assess. A matrix that listed only what was checked would let a gap read as a pass.</div>

${r.lexiconCoverage ? `<div class="warn"><b>Language coverage on this page</b>
  ${esc(r.lexiconCoverage.warning)}</div>` : ''}

<h2>Findings</h2>
${(r.findings ?? []).length
  ? r.findings.map(renderFinding).join('\n')
  : '<div class="clean">Nothing found on the patterns this method can assess. Read the matrix ' +
    'above before treating that as compliance — four patterns were never checked.</div>'}

${r.audit?.countdownProof?.ran ? renderProof(r.audit.countdownProof) : ''}
${r.audit?.probes ? renderProbes(r.audit.probes) : ''}

<h2>Not assessed — and why</h2>
<div class="note" style="margin-bottom:12px">These patterns were <strong>not checked</strong>.
Their absence from the findings carries no information about compliance. They are given the same
prominence as the findings deliberately: a report that hides its scope turns a gap into a clean
bill of health, which is the exact failure this audit exists to test for.</div>
${(r.notChecked ?? []).map((n) => `<div class="warn"><b>${esc(n.legalName)} · ${esc(n.clause)}</b>
  ${esc(n.reason)}</div>`).join('\n')}

${sc ? renderScoreMethod(sc) : ''}

${r.audit?.screenshot ? `<h2>Page as captured</h2>
  <img class="shot" src="${esc(r.audit.screenshot.split('/').pop())}" alt="Screenshot of the audited page">` : ''}

<h2>Reproducing this audit</h2>
<div class="ev"><table>
  <tr><td>Tool</td><td class="mono">${esc(r.audit?.tool ?? 'Kasauti')} ${esc(r.audit?.version ?? '')}</td></tr>
  <tr><td>HTTP status</td><td class="mono">${esc(String(r.audit?.httpStatus ?? '—'))}</td></tr>
  <tr><td>Report digest</td><td class="mono">${esc(r.audit?.reportDigest ?? '—')}</td></tr>
  <tr><td>Prominence threshold</td><td class="mono">accept:decline rendered area ≥ ${r.thresholds?.AREA_RATIO_THRESHOLD}×</td></tr>
  <tr><td>Legibility floor</td><td class="mono">${r.thresholds?.LEGIBILITY_FLOOR}:1 (WCAG AA body text is ${r.thresholds?.WCAG_AA_TEXT}:1)</td></tr>
  <tr><td>Languages searched</td><td class="mono">${esc((r.lexiconLanguages ?? []).map((l) => `${l.name} (${l.coverage.toLowerCase()})`).join(', ') || '—')}</td></tr>
</table></div>
<div class="note">Every threshold is published so a platform can dispute the <em>rule</em> rather
than the result, and every finding quotes the measured values it rests on.</div>

<footer>${esc(r.disclaimer ?? '')}</footer>
</div></body></html>`;
}

/* ------------------------------------------------------------------ KPIs */

function renderKpis(sc, s) {
  const gc = GRADE_COLOR[sc.grade] ?? STATUS.warning;
  return `<div class="kpis">
  <div class="tile">
    <div class="k">Compliance index</div>
    <div class="v" style="color:${gc}">${sc.value}<span class="u">/100 · ${esc(sc.grade)}</span></div>
    <div class="meter"><i style="width:${sc.value}%;background:${gc}"></i></div>
    <div class="note">${esc(sc.label)}</div>
  </div>
  <div class="tile small">
    <div class="k">Assurance</div>
    <div class="v">${sc.assurance}<span class="u">%</span></div>
    <div class="meter"><i style="width:${sc.assurance}%;background:var(--accent)"></i></div>
    <div class="note">${sc.patternsAssessed} of ${sc.patternsTotal} patterns assessable by this method.</div>
  </div>
  <div class="tile small">
    <div class="k">Findings</div>
    <div class="v">${s.findingCount ?? 0}</div>
    <div class="note">across ${s.patternsDetected ?? 0} patterns</div>
  </div>
  <div class="tile small">
    <div class="k">Proven</div>
    <div class="v" style="color:${STATUS.critical}">${s.proven ?? 0}</div>
    <div class="note">measured or probed, not inferred</div>
  </div>
</div>
<div class="note" style="margin-bottom:6px"><strong>The two numbers are separate on purpose.</strong>
The index says how clean the page was across the patterns actually assessed. Assurance says how
much of the total harm surface could be assessed at all. Multiplying them together would hide
which of the two a low result came from, so they are never combined.</div>`;
}

/* ---------------------------------------------------------------- matrix */

function renderMatrix(r, byPattern) {
  const notChecked = new Set((r.notChecked ?? []).map((n) => n.pattern));
  const order = (r.matrixOrder ?? DEFAULT_ORDER);
  return order.map((p) => {
    const hits = byPattern[p.id] ?? 0;
    let color; let glyph; let word;
    if (notChecked.has(p.id)) { color = STATUS.serious; glyph = '□'; word = 'Not assessed'; }
    else if (hits > 0) { color = STATUS.critical; glyph = '●'; word = `${hits} finding${hits === 1 ? '' : 's'}`; }
    else { color = STATUS.good; glyph = '✓'; word = 'Nothing found'; }
    return `<div class="cell" style="border-left-color:${color}">
      <div class="nm">${esc(p.name)}</div>
      <div class="cl">${esc(p.clause)}</div>
      <div class="st" style="color:${color}"><span aria-hidden="true">${glyph}</span>${esc(word)}</div>
    </div>`;
  }).join('');
}

const DEFAULT_ORDER = [
  { id: 'FALSE_URGENCY', name: 'False urgency', clause: 'Annexure 1(1)' },
  { id: 'BASKET_SNEAKING', name: 'Basket sneaking', clause: 'Annexure 1(2)' },
  { id: 'CONFIRM_SHAMING', name: 'Confirm shaming', clause: 'Annexure 1(3)' },
  { id: 'FORCED_ACTION', name: 'Forced action', clause: 'Annexure 1(4)' },
  { id: 'SUBSCRIPTION_TRAP', name: 'Subscription trap', clause: 'Annexure 1(5)' },
  { id: 'INTERFACE_INTERFERENCE', name: 'Interface interference', clause: 'Annexure 1(6)' },
  { id: 'BAIT_AND_SWITCH', name: 'Bait and switch', clause: 'Annexure 1(7)' },
  { id: 'DRIP_PRICING', name: 'Drip pricing', clause: 'Annexure 1(8)' },
  { id: 'DISGUISED_ADVERTISEMENT', name: 'Disguised advertisement', clause: 'Annexure 1(9)' },
  { id: 'NAGGING', name: 'Nagging', clause: 'Annexure 1(10)' },
  { id: 'TRICK_QUESTION', name: 'Trick question', clause: 'Annexure 1(11)' },
  { id: 'SAAS_BILLING', name: 'SaaS billing', clause: 'Annexure 1(12)' },
  { id: 'ROGUE_MALWARE', name: 'Rogue malware', clause: 'Annexure 1(13)' },
];

/* -------------------------------------------------------------- findings */

function renderFinding(f) {
  const c = CONF[f.confidence] ?? CONF.INDICATIVE;
  const lang = f.evidence?.language;
  return `<div class="f">
  <div class="f-head">
    <span class="chip" style="color:${c.color}"><span aria-hidden="true">${c.glyph}</span>${c.word}</span>
    <span class="pat">${esc(f.pattern.replace(/_/g, ' '))} · ${esc(f.rule)}</span>
    ${lang && lang !== 'English' ? `<span class="lang">${esc(lang)}</span>` : ''}
  </div>
  <div class="sum">${esc(f.summary)}</div>
  ${renderEvidence(f.evidence)}
  <div class="note">${esc(c.gloss)}</div>
</div>`;
}

function renderEvidence(ev) {
  if (!ev) return '';
  const rows = [];
  const quotes = [];
  for (const [k, v] of Object.entries(ev)) {
    if (k === 'note') continue;
    if (['label', 'text', 'declineText', 'disclosureText', 'matchedPhrase'].includes(k) && typeof v === 'string') {
      quotes.push(`<div class="quote">${esc(v)}</div>`);
      continue;
    }
    rows.push(`<tr><td>${esc(humanise(k))}</td><td class="mono">${esc(compact(v))}</td></tr>`);
  }
  return `<div class="ev">${quotes.join('')}${rows.length ? `<table>${rows.join('')}</table>` : ''}
    ${ev.note ? `<div class="note">${esc(ev.note)}</div>` : ''}</div>`;
}

/* ----------------------------------------------------------------- proof */

function renderProof(p) {
  return `<h2>Countdown reload test</h2>
<div class="f">
  <div class="sum">${p.proven
    ? 'A countdown restarted at the same value after a reload. The deadline is not real.'
    : 'Countdown timers fell as real time passed, consistent with genuine deadlines.'}</div>
  <div class="ev"><table>
    <tr><td>Method</td><td>Two page loads separated by ${Math.round((p.waitMs ?? 0) / 1000)}s of
      measured wall-clock time. A genuine deadline must decrease by at least that interval.</td></tr>
    ${(p.comparisons ?? []).map((c) => `<tr><td class="mono">${esc(c.selector)}</td>
      <td><strong style="color:${c.verdict === 'FABRICATED' ? STATUS.critical : STATUS.good}">
      ${esc(c.verdict)}</strong> — ${esc(c.before ?? '')} → ${esc(c.after ?? '—')}
      <div class="note">${esc(c.reasoning ?? '')}</div></td></tr>`).join('')}
  </table></div>
  <div class="note">This is the check that converts false urgency from an accusation into an
  observation: real time passed between the two loads and the page pretended it had not.</div>
</div>`;
}

function renderProbes(pr) {
  const blocks = [];
  if (pr.dismissibility?.ran) {
    blocks.push(`<div class="f"><div class="sum">Dismissal probe — ${pr.dismissibility.escapable
      ? 'the overlay could be dismissed.' : 'the overlay could not be dismissed by any means tried.'}</div>
      <div class="ev"><table>${pr.dismissibility.attempts.map((a) => `<tr>
        <td>${esc(a.action)}</td><td style="color:${a.dismissed ? STATUS.good : STATUS.critical}">
        ${a.dismissed ? 'dismissed it' : 'no effect'}</td></tr>`).join('')}</table></div>
      <div class="note">Each affordance a real user would reach for was actually exercised, in
      order, in a real browser. This is not inferred from the absence of a close button.</div></div>`);
  }
  if (pr.optOut?.ran) {
    blocks.push(`<div class="f"><div class="sum">Opt-out persistence probe —
      ${pr.optOut.reArmedAfterReload} of ${pr.optOut.preTicked} pre-ticked add-on(s) returned after
      being unticked and the page reloaded.</div>
      <div class="ev"><table>
        <tr><td>Pre-ticked</td><td class="mono">${pr.optOut.preTicked}</td></tr>
        <tr><td>Refused to untick</td><td class="mono">${pr.optOut.refusedToUncheck}</td></tr>
        <tr><td>Re-armed after reload</td><td class="mono">${pr.optOut.reArmedAfterReload}</td></tr>
      </table></div>
      <div class="note">A refusal that does not survive a reload was not honoured.</div></div>`);
  }
  if (pr.cancellation?.ran) {
    const c = pr.cancellation;
    blocks.push(`<div class="f"><div class="sum">Join / leave asymmetry — subscribing is
      ${c.subscribeDepth ?? '—'} click(s) from the homepage; the nearest cancellation route is
      ${c.cancelDepth ?? 'not reachable within the crawl'}.</div>
      <div class="ev"><table>
        <tr><td>Pages crawled</td><td class="mono">${c.pagesCrawled}</td></tr>
        <tr><td>Subscribe control</td><td class="mono">${esc(c.subscribeExample?.text ?? '—')}</td></tr>
        <tr><td>Cancellation route</td><td class="mono">${esc(c.cancelExample?.text ?? 'none found')}</td></tr>
      </table></div>
      <div class="note">This measures the GRADIENT between joining and leaving. It does not prove
      a subscription trap — that needs a live paid subscription and a real attempt to cancel,
      which no public crawl can perform.</div></div>`);
  }
  return blocks.length ? `<h2>Interaction probes</h2>${blocks.join('\n')}` : '';
}

function renderScoreMethod(sc) {
  return `<h2>How the index was computed</h2>
<div class="ev"><table>
  <tr><td>Formula</td><td>${esc(sc.formula.description)}</td></tr>
  <tr><td>Repeat multiplier</td><td class="mono">${esc(sc.formula.repeatMultiplier)}</td></tr>
  <tr><td>Total pattern weight</td><td class="mono">${sc.formula.totalWeight}</td></tr>
</table></div>
${sc.deductions.length ? `<div class="ev" style="margin-top:10px"><table>
  <tr><td><strong>Pattern</strong></td><td><strong>weight × confidence × repeats = deduction</strong></td></tr>
  ${sc.deductions.map((d) => `<tr><td>${esc(d.legalName)}</td>
    <td class="mono">${d.weight} × ${d.confidenceFactor} × ${d.repeatMultiplier}
    (${d.findings} finding${d.findings === 1 ? '' : 's'}) = <strong>−${d.deduction}</strong></td></tr>`).join('')}
</table></div>` : ''}
<div class="note">${esc(sc.caveat)}</div>`;
}

/* ---------------------------------------------------------------- helpers */

function humanise(k) {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}
function compact(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 320 ? s.slice(0, 320) + '…' : s;
  }
  return String(v);
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
