/**
 * Evidence certificate — HTML for humans.
 *
 * The audience is a claims adjuster, an auditor, a lender's credit officer or
 * a judge. None of them will read JSON, and all of them will ask the same
 * three questions:
 *
 *   what exactly was claimed?
 *   how do you know?
 *   what could you NOT know?
 *
 * The third section is the one that does not exist in any comparable product,
 * and it is placed with equal weight to the others rather than in a footnote.
 * A certificate that hides its blind spots is worse than no certificate: it
 * launders a gap into a guarantee.
 *
 * Self-contained: no external CSS, fonts or scripts, so the file is archivable
 * and renders identically in ten years offline.
 *
 * @module render/certificate
 */

import { DERIVATION_GLOSS, STATUS_GLOSS } from '../provenance/lattice.js';

const VERDICT_TONE = {
  SUPPORTED: { bg: '#0f3d2e', fg: '#7ee2b8', label: 'SUPPORTED' },
  REFUTED: { bg: '#4a1220', fg: '#ff9fb0', label: 'REFUTED' },
  UNSUPPORTED: { bg: '#43350d', fg: '#f5cf6b', label: 'UNSUPPORTED' },
  INDETERMINATE: { bg: '#2a2f38', fg: '#b6c2d4', label: 'INDETERMINATE' },
  BLOCKED: { bg: '#332040', fg: '#d4a8f0', label: 'BLOCKED' },
};

export function renderCertificate(bundle) {
  const v = bundle.verdict;
  const tone = VERDICT_TONE[v.verdict] ?? VERDICT_TONE.INDETERMINATE;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Evidence Certificate</title>
<style>
  :root{--ink:#13161b;--muted:#5c6673;--line:#dde3ea;--bg:#f6f8fa;--card:#fff;--accent:#1f4fd8}
  @media (prefers-color-scheme:dark){:root:not([data-theme=light]){--ink:#e8edf4;--muted:#95a2b3;--line:#2a323d;--bg:#0f1318;--card:#171c23;--accent:#7da3ff}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:15px/1.6 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:860px;margin:0 auto;padding:32px 16px 80px}
  header{border-bottom:2px solid var(--ink);padding-bottom:14px;margin-bottom:24px}
  h1{font-size:19px;margin:0;letter-spacing:.14em;text-transform:uppercase}
  .sub{color:var(--muted);font-size:12.5px;margin-top:5px}
  .verdict{background:${tone.bg};color:${tone.fg};border-radius:10px;padding:20px 22px;margin:22px 0}
  .verdict .v{font-size:27px;font-weight:700;letter-spacing:.06em}
  .verdict .h{font-size:15px;margin-top:7px;opacity:.95}
  .verdict .r{font-size:13.5px;margin-top:12px;opacity:.85;line-height:1.55}
  h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);
    margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
  .claim{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--accent);
    border-radius:0 8px 8px 0;padding:16px 18px;font-size:16px;line-height:1.55}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;color:var(--muted);font-weight:600;font-size:11px;letter-spacing:.08em;
    text-transform:uppercase;padding:7px 9px;border-bottom:1px solid var(--line)}
  td{padding:8px 9px;border-bottom:1px solid var(--line);vertical-align:top}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;word-break:break-all}
  .pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10.5px;font-weight:700;
    letter-spacing:.06em;border:1px solid currentColor}
  .OBSERVED{color:#0a7a52}.DERIVED{color:#1f4fd8}.MODELED{color:#9a6a00}
  .ESTIMATED{color:#b0540c}.SIMULATED{color:#b01c3a}
  @media (prefers-color-scheme:dark){:root:not([data-theme=light]) .OBSERVED{color:#4fd3a0}
    :root:not([data-theme=light]) .DERIVED{color:#8fb0ff}
    :root:not([data-theme=light]) .MODELED{color:#e8b64c}
    :root:not([data-theme=light]) .ESTIMATED{color:#ff9d5c}
    :root:not([data-theme=light]) .SIMULATED{color:#ff7a95}}
  .bar{display:inline-block;height:7px;border-radius:4px;background:var(--accent);vertical-align:middle}
  .bartrack{display:inline-block;width:78px;height:7px;border-radius:4px;background:var(--line);
    vertical-align:middle;margin-right:7px;overflow:hidden}
  .blind{background:var(--card);border:1px solid var(--line);border-left:3px solid #b0540c;
    border-radius:0 8px 8px 0;padding:14px 16px;margin:10px 0;font-size:13.5px}
  .note{color:var(--muted);font-size:12.5px;line-height:1.6}
  ol.statements li{margin-bottom:8px;font-size:13px}
  footer{margin-top:44px;padding-top:14px;border-top:1px solid var(--line);color:var(--muted);font-size:11.5px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}
  .kv{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:11px 13px}
  .kv .k{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
  .kv .val{font-size:17px;font-weight:650;margin-top:3px}
</style></head><body><div class="wrap">

<header>
  <h1>Evidence Certificate</h1>
  <div class="sub">${esc(bundle.formatVersion)} &middot; issued ${esc(bundle.generatedAt)} &middot;
    engine ${esc(bundle.process.engineVersion)}</div>
</header>

<h2>The claim examined</h2>
<div class="claim">${esc(bundle.claim.statement)}</div>

<div class="verdict">
  <div class="v">${tone.label}</div>
  <div class="h">${esc(v.headline)}</div>
  <div class="r">${esc(v.reason)}</div>
</div>

<div class="grid">
  ${kv('Provenance', v.derivation)}
  ${kv('Confidence', fmtNum(v.confidence))}
  ${kv('Independent sources', String(v.independentSources ?? 0))}
  ${kv('Observability', fmtNum(bundle.observability?.index ?? 0))}
</div>
<div class="note">
  <strong>Provenance</strong> is the strongest class of evidence behind this verdict:
  ${esc(DERIVATION_GLOSS[v.derivation] ?? '')}
  <strong>Confidence</strong> summarises provenance, agreement and source independence on a 0&ndash;1 scale;
  it is <em>not</em> a probability that the claim is true.
  <strong>Observability</strong> is how well the consulted sources could have detected the asserted event
  at all &mdash; a low value means this verdict rests on thin ground regardless of which way it points.
</div>

<h2>What was found, and how it is known</h2>
<table>
  <tr><th>Source</th><th>Result</th><th>Provenance</th><th>Observability</th><th>Detail</th></tr>
  ${bundle.findings.map(findingRow).join('\n  ')}
</table>

<h2>What could not be known</h2>
${renderBlindSpots(bundle)}

<h2>Licensing</h2>
<div class="note">Declared purpose: <strong>${esc(bundle.licence.intendedUse)}</strong>.
Sources were screened against their published terms <em>before</em> any request was sent.</div>
${renderLicence(bundle.licence)}

<h2>Chain of custody</h2>
<table>
  <tr><th>Source</th><th>HTTP</th><th>Fetched</th><th>Response digest</th></tr>
  ${(bundle.custody ?? []).map((c) => `<tr>
    <td>${esc(c.sourceId)}</td><td>${esc(String(c.httpStatus ?? c.reachability))}</td>
    <td class="mono">${esc(c.fetchedAt ?? '')}</td>
    <td class="mono">${esc(shorten(c.responseDigest))}</td></tr>`).join('\n  ')}
</table>
<div class="note">Response bodies are not reproduced here. The digests above let an independent
party who re-obtains the same response demonstrate byte-for-byte identity, without this
certificate redistributing data it may have no right to redistribute.</div>

<h2>How this record was produced</h2>
<ol class="statements">${bundle.process.statements.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
<h2>Limitations</h2>
<ol class="statements">${bundle.process.limitations.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
${bundle.process.declarant ? '' : `<div class="blind"><strong>No human declarant.</strong>
This record was produced entirely by automated process. Jurisdictions that require a signed human
statement about the producing device and process for a computer-generated record &mdash; India's
Bharatiya Sakshya Adhiniyam s.63 among them &mdash; will require that statement to be supplied
separately. The engine deliberately does not fabricate one.</div>`}

<h2>Integrity</h2>
<table>
  <tr><td>Claim hash</td><td class="mono">${esc(bundle.claimHash)}</td></tr>
  <tr><td>Evidence hash</td><td class="mono">${esc(bundle.evidenceHash)}</td></tr>
  ${bundle.signature ? `<tr><td>Signature</td><td class="mono">${esc(bundle.signature.algorithm)} &middot;
    ${esc(shorten(bundle.signature.value, 44))}</td></tr>` : ''}
</table>
${bundle.signature ? `<div class="note">${esc(bundle.signature.disclaimer)}</div>` : ''}

<footer>
  Generated by the Sakshya evidence engine. A verdict is a statement about available evidence,
  not a finding of fact. Licence summaries are structured readings of publicly stated terms and
  are not legal advice.<br>
  ${attributionLine(bundle)}
</footer>
</div></body></html>`;
}

function findingRow(f) {
  const oi = f.observability?.index ?? 0;
  const detail = f.queried
    ? (f.evidence?.note ?? describeEvidence(f))
    : esc(f.unavailableReason ?? 'not queried');
  return `<tr>
    <td><strong>${esc(f.title ?? f.sourceId)}</strong><br><span class="note">${esc(f.sourceId)}</span></td>
    <td>${esc(f.status)}<br><span class="note">${esc(STATUS_GLOSS[f.status] ?? '')}</span></td>
    <td><span class="pill ${esc(f.derivation)}">${esc(f.derivation)}</span></td>
    <td><span class="bartrack"><span class="bar" style="width:${Math.round(oi * 78)}px"></span></span>${fmtNum(oi)}</td>
    <td>${detail}</td></tr>`;
}

function describeEvidence(f) {
  const e = f.evidence;
  if (!e) return '<span class="note">no detail</span>';
  const parts = [];
  if (e.matched) parts.push(`<strong>${e.matched}</strong> matching record(s)`);
  if (e.nearMisses) parts.push(`${e.nearMisses} near-miss(es) below threshold`);
  const rows = (e.records ?? []).slice(0, 3).map(recordLine).filter(Boolean);
  const near = (e.nearMissRecords ?? []).slice(0, 2).map(recordLine).filter(Boolean);
  return [
    parts.join(', ') || '<span class="note">nothing matched</span>',
    rows.length ? `<div class="note">${rows.join('<br>')}</div>` : '',
    near.length ? `<div class="note"><em>near misses:</em> ${near.join('; ')}</div>` : '',
  ].filter(Boolean).join('');
}

function recordLine(r) {
  if (r.magnitude != null) {
    return esc(`M${r.magnitude} ${r.place ?? ''} — ${r.distanceKm} km, ${r.time ?? ''} (${r.reviewStatus ?? '?'})`);
  }
  if (r.cumulativeMm != null) {
    return esc(`${r.cumulativeMm} mm cumulative vs ${r.thresholdMm} mm threshold; ` +
      `peak ${r.peakHourMm} mm/h; grid point ${r.gridOffsetKm} km from subject`);
  }
  if (r.title) return esc(`${r.domain ?? ''}: ${String(r.title).slice(0, 90)}`);
  return null;
}

function renderBlindSpots(bundle) {
  const blind = [];
  for (const f of bundle.findings) {
    const weak = f.observability?.factors?.filter((x) => x.score < 1) ?? [];
    if (weak.length === 0) continue;
    blind.push(`<div class="blind"><strong>${esc(f.title ?? f.sourceId)}</strong>
      <ul style="margin:7px 0 0;padding-left:19px">
      ${weak.map((w) => `<li><strong>${esc(w.factor)}</strong> (${fmtNum(w.score)}) &mdash; ${esc(w.reason)}</li>`).join('')}
      </ul></div>`);
  }
  for (const e of bundle.licence?.excluded ?? []) {
    blind.push(`<div class="blind"><strong>${esc(e.sourceId)} &mdash; not consulted for legal reasons.</strong>
      <div class="note" style="margin-top:5px">${esc(e.reason)}</div></div>`);
  }
  if (blind.length === 0) {
    return '<div class="note">Every consulted source reported full observability across all factors ' +
      'for this claim. This is unusual and should itself be checked.</div>';
  }
  return blind.join('\n');
}

function renderLicence(licence) {
  const rows = Object.entries(licence.obligations ?? {}).map(([ob, who]) => `<tr>
    <td><strong>${esc(ob)}</strong></td>
    <td>${who.map((w) => esc(w.attribution)).join('<br>')}</td></tr>`).join('');
  const sa = licence.shareAlike
    ? `<div class="blind"><strong>Share-alike flag.</strong> <div class="note" style="margin-top:5px">${esc(licence.shareAlike.warning)}</div></div>`
    : '';
  return (rows ? `<table><tr><th>Obligation</th><th>Discharged by</th></tr>${rows}</table>` : '') + sa;
}

function attributionLine(bundle) {
  const all = new Set();
  for (const list of Object.values(bundle.licence?.obligations ?? {})) {
    for (const w of list) all.add(w.attribution);
  }
  return all.size ? esc([...all].join(' · ')) : '';
}

function kv(k, val) {
  return `<div class="kv"><div class="k">${esc(k)}</div><div class="val">${esc(val)}</div></div>`;
}

function fmtNum(n) {
  return Number.isFinite(n) ? n.toFixed(2) : String(n ?? '—');
}

function shorten(s, n = 26) {
  if (!s) return '—';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
