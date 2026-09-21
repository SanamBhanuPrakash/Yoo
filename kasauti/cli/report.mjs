/**
 * Kasauti audit report — HTML for people who have to act on it.
 *
 * Readers are a compliance lead, a consumer-body researcher, a reporter, or a
 * regulator. All of them need the same three things in this order: what was
 * found, what proves it, and what was NOT checked.
 *
 * The third section is given the same visual weight as the first. Twenty-six
 * Indian platforms filed self-declarations of dark-pattern compliance and
 * independent review found patterns still present on twenty-one of them. A
 * report that quietly covered nine of thirteen and printed a green tick would
 * be repeating the exact failure it exists to expose.
 *
 * Self-contained: no external CSS, fonts or scripts, so it prints, attaches to
 * a filing, and opens offline in ten years.
 */

const TONE = {
  PROVEN: { fg: '#7f1024', bg: '#fdeaee', dfg: '#ff8fa3', dbg: '#3d1620',
            word: 'Proven', gloss: 'Established by measurement. The arithmetic is in the evidence.' },
  STRONG: { fg: '#8a4b00', bg: '#fdf1e0', dfg: '#f0b95c', dbg: '#3a2c10',
            word: 'Strong', gloss: 'A measured signal with limited room for an innocent reading.' },
  INDICATIVE: { fg: '#4a4f57', bg: '#eef1f4', dfg: '#b6c2d4', dbg: '#242a32',
                word: 'Indicative', gloss: 'Consistent with the pattern. Context could explain it. Not a proven violation.' },
};

export function renderAuditReport(r) {
  const s = r.summary;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dark Pattern Audit</title>
<style>
  :root{--ink:#14181d;--muted:#5d6874;--faint:#8d97a3;--line:#e0e6ec;--bg:#f5f7f9;--card:#fff;--accent:#1a4fd6}
  @media(prefers-color-scheme:dark){:root:not([data-theme=light]){--ink:#e9eef4;--muted:#98a4b2;
    --faint:#6d7886;--line:#2b333d;--bg:#0e1216;--card:#161b21;--accent:#7aa2ff}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:15.5px/1.62 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:900px;margin:0 auto;padding:30px 16px 90px}
  .eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint);font-weight:700}
  h1{font-size:24px;margin:7px 0 4px;line-height:1.25}
  .sub{color:var(--muted);font-size:13px}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11.5px;word-break:break-all}
  h2{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);
     margin:36px 0 12px;padding-bottom:7px;border-bottom:1px solid var(--line)}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:18px 0}
  .kv{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:12px 14px}
  .kv .k{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
  .kv .val{font-size:22px;font-weight:700;margin-top:3px}
  .f{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:16px 18px;margin-bottom:12px}
  .tag{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.08em;padding:3px 9px;border-radius:99px}
  .pat{font-size:11px;letter-spacing:.09em;color:var(--muted);margin-left:8px;font-weight:700}
  .sum{font-size:16.5px;font-weight:600;margin-top:9px;line-height:1.45}
  .ev{margin-top:11px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:11px 13px}
  .ev table{width:100%;border-collapse:collapse;font-size:12.5px}
  .ev td{padding:4px 7px;border-bottom:1px solid var(--line);vertical-align:top}
  .ev td:first-child{color:var(--muted);width:38%;white-space:nowrap}
  .quote{border-left:3px solid var(--accent);padding:6px 11px;margin:8px 0;font-style:italic;background:var(--bg)}
  .note{color:var(--muted);font-size:12.5px;line-height:1.6;margin-top:9px}
  .nc{background:var(--card);border:1px solid var(--line);border-left:3px solid #c9761b;
      border-radius:0 9px 9px 0;padding:13px 15px;margin:9px 0;font-size:13.5px}
  .nc b{display:block;margin-bottom:4px}
  .clean{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:13px 15px;font-size:13.5px}
  .law{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:14px 16px;
       font-size:13px;color:var(--muted);margin:12px 0}
  img.shot{width:100%;border:1px solid var(--line);border-radius:9px;margin-top:10px}
  footer{margin-top:44px;padding-top:15px;border-top:1px solid var(--line);color:var(--faint);
         font-size:11.5px;line-height:1.65}
  @media print{body{background:#fff}.wrap{padding:0}}
</style></head><body><div class="wrap">

<div class="eyebrow">Dark Pattern Audit &middot; CCPA Guidelines 2023</div>
<h1>${esc(r.title ?? r.url ?? 'Audit')}</h1>
<div class="sub mono">${esc(r.url ?? '')}</div>
<div class="sub">Audited ${esc((r.audit?.auditedAt ?? r.scannedAt ?? '').slice(0, 19).replace('T', ' '))} UTC
  &middot; viewport ${r.viewport?.width}×${r.viewport?.height}</div>

<div class="grid">
  ${kv('Findings', s.findingCount)}
  ${kv('Proven', s.proven)}
  ${kv('Patterns hit', `${s.patternsDetected}/13`)}
  ${kv('Not checked', s.patternsNotChecked)}
</div>

<div class="law">
  Assessed against the <strong>${esc(r.citation ?? '')}</strong>
  The Guidelines name thirteen practices and declare them unfair trade practices. On 5 June 2025
  the CCPA directed e-commerce platforms to self-audit against them and file self-declarations.
  This report is an independent, reproducible check of a single page — not a legal determination.
</div>

<h2>Findings</h2>
${r.findings.length
  ? r.findings.map(renderFinding).join('\n')
  : '<div class="clean">No findings on the patterns this method is able to check. See ' +
    '<em>Not checked</em> below before reading that as compliance.</div>'}

<h2>Not checked — and why</h2>
<div class="note" style="margin-bottom:11px">These patterns were <strong>not assessed</strong>.
Their absence from the findings above carries no information about compliance. Listing them with
the same prominence as the findings is deliberate: a report that hides its scope converts a gap
into a clean bill of health.</div>
${r.notChecked.map((n) => `<div class="nc"><b>${esc(n.legalName)} &middot; ${esc(n.clause)}</b>
  ${esc(n.reason)}</div>`).join('\n')}

${r.notDetected.length ? `<h2>Checked, nothing found</h2>
<div class="clean">${r.notDetected.map((n) => `<div style="margin-bottom:7px">
  <strong>${esc(n.legalName)}</strong> <span class="pat">${esc(n.clause)}</span><br>
  <span class="note">${esc(n.caveat)}</span></div>`).join('')}</div>` : ''}

${r.audit?.countdownProof?.ran ? renderProof(r.audit.countdownProof) : ''}

${r.audit?.screenshot ? `<h2>Page as captured</h2>
  <img class="shot" src="${esc(r.audit.screenshot.split('/').pop())}" alt="Screenshot of the audited page">` : ''}

<h2>Reproducing this audit</h2>
<div class="ev"><table>
  <tr><td>Tool</td><td class="mono">${esc(r.audit?.tool ?? 'Kasauti')} ${esc(r.audit?.version ?? '')}</td></tr>
  <tr><td>HTTP status</td><td class="mono">${esc(String(r.audit?.httpStatus ?? '—'))}</td></tr>
  <tr><td>Report digest</td><td class="mono">${esc(r.audit?.reportDigest ?? '—')}</td></tr>
  <tr><td>Prominence threshold</td><td class="mono">accept:decline area ≥ ${r.thresholds?.AREA_RATIO_THRESHOLD}×</td></tr>
  <tr><td>Legibility floor</td><td class="mono">${r.thresholds?.LEGIBILITY_FLOOR}:1 (WCAG AA text is ${r.thresholds?.WCAG_AA_TEXT}:1)</td></tr>
</table></div>
<div class="note">Every threshold is stated so a platform can dispute the rule rather than the
result, and every finding quotes the measured values it rests on.</div>

<footer>${esc(r.disclaimer ?? '')}</footer>
</div></body></html>`;
}

function renderFinding(f) {
  const t = TONE[f.confidence] ?? TONE.INDICATIVE;
  return `<div class="f">
  <span class="tag" style="background:${t.bg};color:${t.fg}">${t.word.toUpperCase()}</span>
  <span class="pat">${esc(f.pattern)} &middot; ${esc(f.rule)}</span>
  <div class="sum">${esc(f.summary)}</div>
  ${renderEvidence(f.evidence)}
  <div class="note">${esc(t.gloss)}</div>
</div>`;
}

function renderEvidence(ev) {
  if (!ev) return '';
  const rows = [];
  const quotes = [];
  for (const [k, v] of Object.entries(ev)) {
    if (k === 'note') continue;
    if (['label', 'text', 'declineText', 'disclosureText'].includes(k) && typeof v === 'string') {
      quotes.push(`<div class="quote">${esc(v)}</div>`);
      continue;
    }
    rows.push(`<tr><td>${esc(humanise(k))}</td><td class="mono">${esc(compact(v))}</td></tr>`);
  }
  return `<div class="ev">${quotes.join('')}${rows.length ? `<table>${rows.join('')}</table>` : ''}
    ${ev.note ? `<div class="note">${esc(ev.note)}</div>` : ''}</div>`;
}

function renderProof(p) {
  return `<h2>Countdown reload test</h2>
<div class="f">
  <div class="sum">${p.proven
    ? 'At least one countdown restarted at the same value after a reload. The deadline is not real.'
    : 'Countdown timers fell as real time passed, consistent with genuine deadlines.'}</div>
  <div class="ev"><table>
    <tr><td>Method</td><td>Two page loads separated by ${Math.round((p.waitMs ?? 0) / 1000)}s of
      measured wall-clock time. A genuine deadline must decrease by at least that interval.</td></tr>
    ${(p.comparisons ?? []).map((c) => `<tr><td class="mono">${esc(c.selector)}</td>
      <td><strong>${esc(c.verdict)}</strong> — ${esc(c.before ?? '')} → ${esc(c.after ?? '—')}
      <div class="note">${esc(c.reasoning ?? '')}</div></td></tr>`).join('')}
  </table></div>
  <div class="note">This is the one check that converts false urgency from an accusation into an
  observation: real time passed between the two loads, and the page pretended it had not.</div>
</div>`;
}

function kv(k, v) {
  return `<div class="kv"><div class="k">${esc(k)}</div><div class="val">${esc(v)}</div></div>`;
}

function humanise(k) {
  return k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

function compact(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 300 ? s.slice(0, 300) + '…' : s;
  }
  return String(v);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
