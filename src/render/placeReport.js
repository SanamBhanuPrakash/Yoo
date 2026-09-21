/**
 * Place History Report — buyer-facing HTML.
 *
 * The reader is not an analyst. They are about to commit a large sum to land
 * they have not stood on, and they are frightened. The report must therefore
 * lead with the thing that changes their decision, say it in one sentence, and
 * only then show its working.
 *
 * The hero is the observation timeline: a bar showing, to the day, when this
 * plot was visible from orbit and when it was not. Every competing product
 * shows a picture and lets you assume continuous knowledge. This shows the
 * gaps, because the gaps are when things happen that nobody records.
 *
 * Self-contained — no external CSS, fonts or scripts — so it prints, archives
 * and opens offline in ten years.
 *
 * @module render/placeReport
 */

const SEV = {
  HIGH: { fg: '#b3162f', bg: '#fdeaee', dark: '#ff8fa3', darkBg: '#3d1620', word: 'Needs attention' },
  MEDIUM: { fg: '#9a5b00', bg: '#fdf2e0', dark: '#f0b95c', darkBg: '#3a2c10', word: 'Worth checking' },
  LOW: { fg: '#0a6b4a', bg: '#e6f6ef', dark: '#5fd6a5', darkBg: '#0f3327', word: 'No concern found' },
};

export function renderPlaceReport(report) {
  const ledger = firstRecord(report.sections.observation);
  const terrain = firstRecord(report.sections.terrain);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Place History Report</title>
<style>
  :root{--ink:#14181d;--muted:#5d6874;--faint:#8d97a3;--line:#e0e6ec;--bg:#f5f7f9;--card:#fff;
        --accent:#1a4fd6;--seen:#2f9e6e;--blind:#d6435c}
  @media (prefers-color-scheme:dark){:root:not([data-theme=light]){--ink:#e9eef4;--muted:#98a4b2;
    --faint:#6d7886;--line:#2b333d;--bg:#0e1216;--card:#161b21;--accent:#7aa2ff;--seen:#4ecf96;--blind:#ff7189}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:15.5px/1.62 ui-sans-serif,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:880px;margin:0 auto;padding:30px 16px 90px}
  header{margin-bottom:26px}
  .eyebrow{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--faint);font-weight:700}
  h1{font-size:25px;margin:7px 0 4px;line-height:1.25}
  .loc{color:var(--muted);font-size:13.5px}
  .coords{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:var(--faint);margin-top:4px}
  h2{font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);
     margin:38px 0 12px;padding-bottom:7px;border-bottom:1px solid var(--line)}
  .find{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:16px 18px;margin-bottom:11px}
  .find .tag{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.09em;
    padding:3px 9px;border-radius:99px;margin-bottom:9px}
  .find .hl{font-size:17px;font-weight:650;line-height:1.38}
  .find .dt{color:var(--muted);font-size:13.5px;margin-top:7px}
  .hero{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin:16px 0}
  .bignum{font-size:46px;font-weight:750;line-height:1;letter-spacing:-.02em;color:var(--blind)}
  .bigsub{color:var(--muted);font-size:14px;margin-top:8px;max-width:58ch}
  .tl{margin-top:20px}
  .tl-lab{display:flex;justify-content:space-between;font-size:11px;color:var(--faint);
    font-family:ui-monospace,Menlo,monospace;margin-bottom:5px}
  .legend{display:flex;gap:17px;margin-top:11px;font-size:11.5px;color:var(--muted);flex-wrap:wrap}
  .sw{display:inline-block;width:11px;height:11px;border-radius:3px;vertical-align:-1px;margin-right:5px}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  td,th{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  th{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:700}
  .num{font-family:ui-monospace,Menlo,monospace}
  .note{color:var(--muted);font-size:13px;line-height:1.6}
  .cant{background:var(--card);border:1px solid var(--line);border-left:3px solid #c9761b;
    border-radius:0 10px 10px 0;padding:14px 16px;margin:10px 0;font-size:13.5px}
  .cant b{display:block;margin-bottom:4px}
  .pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:800;
    letter-spacing:.06em;border:1px solid currentColor;margin-left:6px}
  .OBSERVED{color:#0a7a52}.DERIVED{color:#1a4fd6}.MODELED{color:#96660a}
  .ESTIMATED{color:#b0540c}.SIMULATED{color:#b01c3a}
  @media(prefers-color-scheme:dark){:root:not([data-theme=light]) .OBSERVED{color:#4fd3a0}
    :root:not([data-theme=light]) .DERIVED{color:#8fb0ff}
    :root:not([data-theme=light]) .MODELED{color:#e8b64c}
    :root:not([data-theme=light]) .ESTIMATED{color:#ff9d5c}}
  footer{margin-top:46px;padding-top:15px;border-top:1px solid var(--line);color:var(--faint);font-size:11.5px;line-height:1.65}
  @media print{body{background:#fff}.wrap{padding:0}}
</style></head><body><div class="wrap">

<header>
  <div class="eyebrow">Place History Report</div>
  <h1>${esc(shortName(report))}</h1>
  <div class="loc">${esc(report.place?.displayName ?? 'Location not resolved')}</div>
  <div class="coords">${report.subject.lat.toFixed(5)}, ${report.subject.lon.toFixed(5)}
    &middot; ${report.window.historyYears} year history
    &middot; issued ${esc(report.generatedAt.slice(0, 10))}</div>
</header>

<h2>What you should know</h2>
${report.highlights.map(renderFinding).join('\n') ||
  '<div class="note">No findings could be established from available public sources.</div>'}

${ledger ? renderObservationHero(ledger, report.window) : ''}

${terrain ? renderTerrain(terrain) : ''}

<h2>Seismic record</h2>
${renderSeismic(report.sections.seismic)}

<h2>What this report could NOT determine</h2>
<div class="note" style="margin-bottom:12px">Every section above is limited. These limits are
listed with the same prominence as the findings, because a report that hides its blind spots
turns a gap into a guarantee — and a guarantee is what you would act on.</div>
${renderLimits(report, ledger, terrain)}

<h2>Sources and provenance</h2>
<table><tr><th>Section</th><th>Verdict</th><th>Evidence class</th><th>Could it have known?</th></tr>
${Object.entries(report.sections).map(([k, v]) => `<tr>
  <td>${esc(sectionName(k))}</td>
  <td>${esc(v.verdict.verdict)}</td>
  <td><span class="pill ${esc(v.verdict.derivation)}">${esc(v.verdict.derivation)}</span></td>
  <td class="num">${(v.observabilityIndex?.index ?? 0).toFixed(2)}</td></tr>`).join('\n')}
</table>
<div class="note" style="margin-top:10px">
<b>Evidence class</b> states how each answer was produced. OBSERVED means an instrument recorded
it. DERIVED means it was computed from observations. ESTIMATED means a rule of thumb was applied.
The engine can lower this class but never raise it — no amount of computation turns an estimate
into a measurement.
<b>Could it have known?</b> scores whether the sources were even capable of detecting the thing
asked about. A low number means the answer rests on thin ground, whichever way it points.
</div>

<footer>
  ${esc(attributions(report))}<br><br>
  This report describes PHYSICAL evidence from public sources. It is not a title search, an
  encumbrance certificate, a survey, a flood-zone determination, or legal advice, and it says
  nothing about ownership, tenure or permissions. It is intended to sit alongside those checks,
  not to replace any of them. Verify anything you intend to rely on.
</footer>
</div></body></html>`;
}

function renderFinding(h) {
  const s = SEV[h.severity] ?? SEV.LOW;
  return `<div class="find">
    <span class="tag" style="background:${s.bg};color:${s.fg}">${esc(s.word)}</span>
    <div class="hl">${esc(h.headline)}</div>
    <div class="dt">${esc(h.detail)}</div></div>`;
}

/**
 * The hero. A day-resolution bar of when this plot was and was not visible.
 */
function renderObservationHero(L, window) {
  const startMs = Date.parse(window.start);
  const endMs = Date.parse(window.end);
  const span = Math.max(1, endMs - startMs);
  const W = 840, H = 34;

  const bars = (L.blindWindows ?? []).map((b) => {
    const x = ((Date.parse(`${b.from}T00:00:00Z`) - startMs) / span) * W;
    const w = Math.max(1.5, ((Date.parse(`${b.to}T00:00:00Z`) - Date.parse(`${b.from}T00:00:00Z`)) / span) * W);
    return `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${H}" fill="var(--blind)" opacity="0.88"><title>${b.days} days unobserved: ${b.from} to ${b.to}</title></rect>`;
  }).join('');

  return `
<h2>When this plot was actually visible from orbit</h2>
<div class="hero">
  <div class="bignum">${L.longestBlindDays} days</div>
  <div class="bigsub">the longest unbroken stretch in which no public satellite obtained a
    usable view of this location. Across the full ${L.windowDays}-day period,
    <b>${Math.round(L.blindDaysFraction * 100)}% of all days</b> fell inside a blind window of two
    weeks or more.</div>

  <div class="tl">
    <div class="tl-lab"><span>${esc(window.start.slice(0, 10))}</span><span>${esc(window.end.slice(0, 10))}</span></div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none"
         role="img" aria-label="Timeline of observed and unobserved periods">
      <rect x="0" y="0" width="${W}" height="${H}" fill="var(--seen)" opacity="0.8"/>
      ${bars}
    </svg>
    <div class="legend">
      <span><span class="sw" style="background:var(--seen)"></span>Observed regularly</span>
      <span><span class="sw" style="background:var(--blind)"></span>No usable view for 14+ days</span>
    </div>
  </div>

  <table style="margin-top:20px">
    <tr><td>Satellite passes over this plot</td><td class="num">${L.passes}</td></tr>
    <tr><td>Passes that produced a usable view</td><td class="num">${L.clearPasses}
      (${Math.round(L.clearFraction * 100)}%)</td></tr>
    <tr><td>Average interval between usable views</td><td class="num">${L.meanRevisitDays ?? '—'} days</td></tr>
    <tr><td>Longest blind window</td><td class="num">${L.longestBlindDays} days</td></tr>
  </table>

  <div class="cant" style="margin-top:16px"><b>Why this is the most useful page in the report</b>
  Encroachment, unauthorised construction and quiet demolition do not happen at random — they
  happen when nobody is looking. A ${L.longestBlindDays}-day gap is enough to raise a boundary
  wall, cut an access road, or demolish a structure with no public record of it whatsoever.
  If a seller shows you imagery, check its date against the red bands above.</div>

  <div class="note" style="margin-top:12px">${esc(L.caveat)}</div>
</div>

${(L.blindWindows ?? []).length ? `<table>
  <tr><th>Blind window</th><th>Length</th><th></th></tr>
  ${L.blindWindows.map((b) => `<tr><td class="num">${esc(b.from)} → ${esc(b.to)}</td>
    <td class="num">${b.days} days</td>
    <td class="note">${b.boundedByWindowEdge ? 'runs to the edge of the report period' : ''}</td></tr>`).join('')}
</table>` : ''}`;
}

function renderTerrain(t) {
  return `
<h2>Terrain and surface water</h2>
<div class="hero">
  <div class="hl" style="font-size:18px;font-weight:650">${esc(t.waterBehaviour)}</div>
  <table style="margin-top:16px">
    <tr><td>Elevation at the plot</td><td class="num">${t.centreElevationM} m</td></tr>
    <tr><td>Mean elevation of surrounding land (to 300 m)</td><td class="num">${t.surroundingMeanM} m</td></tr>
    <tr><td>Height relative to surroundings</td><td class="num">${t.depressionM > 0
      ? `${t.depressionM} m BELOW` : `${Math.abs(t.depressionM)} m above`}</td></tr>
    <tr><td>Local gradient</td><td class="num">${t.gradientPct}%</td></tr>
    <tr><td>Directions offering lower ground (drainage)</td>
      <td class="num">${t.drainageBearings.length ? esc(t.drainageBearings.join(', ')) : 'none sampled'}</td></tr>
  </table>
  <div class="cant" style="margin-top:14px"><b>How confident is this?</b>${esc(t.provenanceNote)}</div>
  <div class="cant"><b>Important limitation</b>${esc(t.surfaceModelCaveat)}</div>
  <div class="note" style="margin-top:10px">${esc(t.epochCaveat)}</div>
</div>`;
}

function renderSeismic(section) {
  const f = section?.findings?.find((x) => x.sourceId === 'usgs-earthquakes');
  if (!f) return '<div class="note">No seismic source was consulted.</div>';
  const recs = f.evidence?.records ?? [];
  if (!recs.length) {
    return `<div class="note">No earthquake of magnitude 4.0 or greater was recorded within 150 km
      over the last 25 years. Catalogue capability for this location scored
      <b>${f.observability.index.toFixed(2)}</b> — ${f.observability.index >= 0.6
        ? 'high enough that this absence is meaningful.'
        : 'too low for this absence to be meaningful; it reflects sparse instrumentation as much as quiet ground.'}</div>`;
  }
  return `<table><tr><th>Date</th><th>Magnitude</th><th>Distance</th><th>Location</th><th>Status</th></tr>
  ${recs.slice(0, 6).map((r) => `<tr><td class="num">${esc(r.time?.slice(0, 10) ?? '')}</td>
    <td class="num">M${r.magnitude}</td><td class="num">${r.distanceKm} km</td>
    <td>${esc(r.place ?? '')}</td><td class="note">${esc(r.reviewStatus ?? '')}</td></tr>`).join('')}
  </table>`;
}

function renderLimits(report, ledger, terrain) {
  const out = [];
  out.push(`<div class="cant"><b>Ownership, title and legal status</b>
    Nothing in this report touches them. It describes physical ground only. A plot can be
    physically unremarkable and legally catastrophic.</div>`);
  out.push(`<div class="cant"><b>What is actually built on the plot</b>
    Sentinel-2 resolves about 10 m per pixel — a modest house is one or two pixels. This report
    records WHEN the plot was observed, never what the imagery appears to show. Any service
    claiming to read structures, boundaries or encroachment from this imagery at plot scale is
    over-claiming.</div>`);
  if (ledger?.longestBlindDays >= 30) {
    out.push(`<div class="cant"><b>Anything that happened during the ${ledger.longestBlindDays}-day blind window</b>
      There is no public observational record for that period. This is a genuine gap in
      knowledge, not an assurance of no change.</div>`);
  }
  if (terrain && !terrain.significant) {
    out.push(`<div class="cant"><b>Whether this plot sits high or low</b>
      The height difference from its surroundings falls inside the elevation data's own noise
      floor (±${terrain.noiseFloorM} m). This is not a finding of level ground — it is an
      unanswered question needing a ground survey.</div>`);
  }
  for (const [key, section] of Object.entries(report.sections)) {
    for (const e of section.licence?.excluded ?? []) {
      out.push(`<div class="cant"><b>${esc(e.sourceId)} was not consulted for legal reasons</b>
        ${esc(e.reason)}</div>`);
    }
    for (const f of section.findings ?? []) {
      if (f.status === 'INDETERMINATE' && f.unavailableReason) {
        out.push(`<div class="cant"><b>${esc(sectionName(key))}: ${esc(f.sourceId)} did not answer</b>
          ${esc(f.unavailableReason)}. This section is thinner than it would otherwise be.</div>`);
      }
    }
  }
  return out.join('\n');
}

function sectionName(k) {
  return { observation: 'Satellite observation record', terrain: 'Terrain and water',
    seismic: 'Seismic record', recentRainfall: 'Recent rainfall' }[k] ?? k;
}

function shortName(report) {
  return report.subject.label?.split(',').slice(0, 2).join(',') ??
    `${report.subject.lat.toFixed(4)}, ${report.subject.lon.toFixed(4)}`;
}

function attributions(report) {
  const all = new Set();
  for (const s of Object.values(report.sections)) {
    for (const list of Object.values(s.licence?.obligations ?? {})) {
      for (const w of list) all.add(w.attribution);
    }
  }
  if (report.place?.attribution) all.add(report.place.attribution);
  return [...all].join('  ·  ');
}

function firstRecord(section) {
  for (const f of section?.findings ?? []) {
    const r = f.evidence?.records?.[0];
    if (r) return r;
  }
  return null;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
