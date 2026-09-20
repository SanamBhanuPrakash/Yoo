import test from 'node:test';
import assert from 'node:assert/strict';
import { screenSource, screenSources, assertClearance, obligationsFor, shareAlikeWarning, LicenseViolation, USE } from './policy.js';

test('USGS public-domain data clears every use', () => {
  for (const use of Object.values(USE)) {
    assert.equal(screenSource('usgs-earthquakes', use).allowed, true, `blocked for ${use}`);
  }
});

test('THE GATE: OpenSky is permitted for research and refused for commercial use', () => {
  assert.equal(screenSource('opensky', USE.NONCOMMERCIAL).allowed, true);
  assert.equal(screenSource('opensky', USE.INTERNAL_COMMERCIAL).allowed, false);
  assert.equal(screenSource('opensky', USE.COMMERCIAL_REDISTRIBUTION).allowed, false);
});

test('the refusal explains itself in terms a non-lawyer can act on', () => {
  const r = screenSource('opensky', USE.COMMERCIAL_REDISTRIBUTION);
  assert.match(r.reason, /permits at most NONCOMMERCIAL/);
  assert.match(r.reason, /MIT-licensed repository does not relicense the feeds/);
});

test('TeleGeography submarine cables are blocked commercially', () => {
  assert.equal(screenSource('telegeography-cables', USE.INTERNAL_COMMERCIAL).allowed, false);
});

test('an unregistered source FAILS CLOSED rather than open', () => {
  const r = screenSource('some-scraped-feed-nobody-checked', USE.INTERNAL_COMMERCIAL);
  assert.equal(r.allowed, false);
  assert.equal(r.license, 'UNKNOWN');
});

test('screenSources separates permitted from legally-excluded', () => {
  const r = screenSources(
    ['usgs-earthquakes', 'opensky', 'open-meteo', 'telegeography-cables'],
    USE.COMMERCIAL_REDISTRIBUTION,
  );
  assert.deepEqual(r.permitted.map((s) => s.sourceId).sort(), ['open-meteo', 'usgs-earthquakes']);
  assert.deepEqual(r.excluded.map((s) => s.sourceId).sort(), ['opensky', 'telegeography-cables']);
});

test('SEAL GATE: a commercial bundle cannot be sealed over a non-commercial source', () => {
  assert.throws(
    () => assertClearance(['usgs-earthquakes', 'opensky'], USE.COMMERCIAL_REDISTRIBUTION),
    (err) => err instanceof LicenseViolation && /opensky/.test(err.message),
  );
});

test('the same source set seals cleanly for research use', () => {
  assert.equal(assertClearance(['usgs-earthquakes', 'opensky'], USE.NONCOMMERCIAL), true);
});

test('obligations are aggregated across contributing sources', () => {
  const ob = obligationsFor(['open-meteo', 'nominatim']);
  assert.ok(ob.ATTRIBUTION.length >= 2);
  assert.ok(ob.SHARE_ALIKE_DATABASE, 'ODbL share-alike must surface from nominatim');
});

test('share-alike is flagged, and flagged as a legal question not an answer', () => {
  const w = shareAlikeWarning(['nominatim', 'usgs-earthquakes']);
  assert.deepEqual(w.sources, ['nominatim']);
  assert.match(w.warning, /flag, not a determination/);
  assert.equal(shareAlikeWarning(['usgs-earthquakes']), null);
});
