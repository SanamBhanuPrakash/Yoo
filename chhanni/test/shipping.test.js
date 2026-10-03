/**
 * What has to be true of the thing that actually ships.
 *
 * test/detect.test.js covers whether the engine is right. This file covers
 * whether the extension a user loads is the engine, is complete, is bounded,
 * and does not promise more than it does. Every assertion here corresponds to
 * a way the extension was observed to fail in a real browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { scan } from '../src/detect.js';

const manifest = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
const content = readFileSync('extension/content.js', 'utf8');

// ----------------------------------------------------------------- packaging
test('the shipped engine is byte-identical to src/', () => {
  const modules = readdirSync('src').filter((f) => f.endsWith('.js'));
  assert.ok(modules.length > 0);
  for (const file of modules) {
    assert.ok(existsSync(`extension/engine/${file}`),
      `extension/engine/${file} is missing — run node scripts/build-extension.js`);
    assert.equal(readFileSync(`extension/engine/${file}`, 'utf8'),
      readFileSync(`src/${file}`, 'utf8'),
      `extension/engine/${file} has drifted from src/${file}`);
  }
});

test('the panel stylesheet ships as a module and matches panel.css', () => {
  assert.ok(existsSync('extension/engine/panel.css.js'),
    'run node scripts/build-extension.js');
  const generated = readFileSync('extension/engine/panel.css.js', 'utf8');
  const css = readFileSync('extension/panel.css', 'utf8');
  assert.ok(generated.includes(JSON.stringify(css)), 'panel.css.js has drifted');
});

test('every resource the content script imports is web-accessible', () => {
  const imported = [...content.matchAll(/resource\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(imported.length >= 3, 'expected the engine and the stylesheet');
  const patterns = manifest.web_accessible_resources.flatMap((e) => e.resources);
  for (const path of imported) {
    const ok = patterns.some((p) => {
      const re = new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      return re.test(path);
    });
    assert.ok(ok, `${path} is imported but not listed in web_accessible_resources`);
  }
});

test('web-accessible resources are not exposed to every site', () => {
  // https://*/* let any HTTPS page fetch engine/rules.js and so detect that the
  // user runs Chhanni. Chrome's own manifest reference gives the reason: broad
  // web-accessible resources let a site fingerprint installed extensions.
  const origin = (h) => {
    const u = new URL(h.replace('*://', 'https://').replace(/\/\*$/, '/'));
    return `${u.protocol}//${u.host}/*`;
  };
  const expected = [...new Set(manifest.host_permissions.map(origin))].sort();
  for (const entry of manifest.web_accessible_resources) {
    for (const m of entry.matches ?? []) {
      assert.notEqual(m, 'https://*/*', 'resources must not be exposed to every site');
    }
  }
  assert.deepEqual([...manifest.web_accessible_resources[0].matches].sort(), expected,
    'resources should reach exactly the origins the content script runs on');
});

test('every match pattern is one Chrome will actually accept', () => {
  // `npm test` passed while the extension was unloadable: Chrome rejects a path
  // component in a web_accessible_resources match pattern — `https://github.com/
  // copilot/*` is fine in host_permissions and fatal here — and the only symptom
  // is "Failed to load extension. Invalid match pattern." in a log nobody reads.
  const pattern = /^(?:\*|https?):\/\/(?:\*\.)?[A-Za-z0-9.-]+\/\*$/;
  for (const entry of manifest.web_accessible_resources) {
    for (const m of entry.matches ?? []) {
      assert.match(m, pattern,
        `${m} has a path component; web_accessible_resources match patterns must end at the origin`);
    }
  }
  const host = /^(?:\*|https?):\/\/(?:\*\.)?[A-Za-z0-9.-]+\/.*$/;
  for (const h of manifest.host_permissions) assert.match(h, host);
  for (const m of manifest.content_scripts[0].matches) assert.match(m, host);
});

test('the content script runs in frames, not only the top document', () => {
  // A composer rendered inside an iframe was completely unguarded: an AWS key
  // pasted into one reached the textarea with no panel and no interception.
  assert.equal(manifest.content_scripts[0].all_frames, true);
  assert.equal(manifest.content_scripts[0].match_about_blank, true);
});

test('the listing has the icons the Chrome Web Store requires', () => {
  for (const size of ['16', '32', '48', '128']) {
    assert.ok(manifest.icons?.[size], `manifest declares no ${size}px icon`);
    assert.ok(existsSync(`extension/${manifest.icons[size]}`),
      `${manifest.icons[size]} is declared but missing`);
  }
});

test('the store description fits and does not overclaim', () => {
  assert.ok(manifest.description.length <= 132,
    `description is ${manifest.description.length} chars; the store truncates at 132`);
  // "Nothing is ever sent anywhere" reads as a claim about the user's prompt,
  // which does leave the browser — it goes to the AI provider. Chhanni can
  // only speak for itself.
  assert.match(manifest.description, /Chhanni/,
    'a claim about sending must name Chhanni as its subject');
});

test('manifest and package.json agree on the version', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(manifest.version, pkg.version);
});

// ------------------------------------------------------------- fail-closed
test('the content script does not assume the engine loaded', () => {
  const importBlock = content.slice(0, content.indexOf('// ------------------------------------------------------------------ surface'));
  assert.match(importBlock, /try\s*{[\s\S]*await import\(resource\('engine\/detect\.js'\)\)/,
    'the engine import must be guarded; an unhandled rejection kills the whole script');
  assert.match(content, /loadError/, 'a failed load must be surfaced, not swallowed');
});

test('a scan that throws stops the content rather than letting it past', () => {
  // inspect() must return an error rather than propagate one, and the paste
  // handler must preventDefault on that branch. The ordering is the whole
  // point: an inspection that failed is not evidence that the text is safe.
  assert.match(content, /function inspect\(text\)[\s\S]{0,200}catch \(err\) \{ return \{ ok: false/);
  const pasteHandler = content.slice(content.indexOf("addEventListener('paste'"));
  const notOk = pasteHandler.indexOf('if (!verdictOf.ok)');
  const prevented = pasteHandler.indexOf('e.preventDefault()', notOk);
  const shown = pasteHandler.indexOf('showFailurePanel', notOk);
  assert.ok(notOk !== -1 && prevented !== -1 && shown !== -1);
  assert.ok(prevented < shown, 'the event must be stopped before anything else happens');
});

test('the panel is isolated from the host page', () => {
  // A single `.chhanni-panel{display:none!important}` in the page's stylesheet
  // hid the warning while the paste stayed blocked — measured. The user sees
  // Ctrl+V do nothing and has no idea why.
  assert.match(content, /attachShadow\(\{ mode: 'closed' \}\)/);
  assert.ok(!('css' in manifest.content_scripts[0]),
    'panel.css must not also be injected into the page');
});

test('the panel announces itself as a dialog and keeps focus', () => {
  for (const attr of ['role', 'aria-modal', 'aria-live', 'aria-labelledby']) {
    assert.ok(content.includes(`'${attr}'`), `panel is missing ${attr}`);
  }
  assert.match(content, /function trapFocus/);
  assert.match(content, /returnFocusTo/);
});

test('nothing in the content script can reach the network', () => {
  const code = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(!/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|EventSource)\b/.test(code));
});

// --------------------------------------------------------------- bounded cost
test('scanning stays linear in the length of the input', () => {
  // The email detector's local part was `[A-Za-z0-9._%+-]+`. On a long run of
  // those characters containing no `@` — minified JavaScript, a column of
  // hyphenated serials — it walked the run, failed, backtracked, and did it
  // again from the next position. 40 KB measured 1.7 s of blocked main thread
  // inside the paste handler; 80 KB measured 9 s.
  const blob = (n) => 'a.b.c-d_e%f+g'.repeat(n);
  const time = (text) => {
    const t0 = process.hrtime.bigint();
    scan(text);
    return Number(process.hrtime.bigint() - t0) / 1e6;
  };
  time(blob(100)); // warm the JIT so the ratio measures the algorithm
  const small = Math.max(time(blob(1500)), 1);
  const large = time(blob(6000)); // 4x the input
  assert.ok(large / small < 10,
    `4x the input took ${(large / small).toFixed(1)}x the time (${small.toFixed(0)}ms -> ${large.toFixed(0)}ms); that is super-linear`);
  assert.ok(large < 1000, `80 KB of dense punctuation took ${large.toFixed(0)}ms`);
});

test('a 1 MB paste finishes in well under a second', () => {
  const t0 = process.hrtime.bigint();
  scan('the quick brown fox jumps over the lazy dog. '.repeat(23000));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(ms < 1000, `1 MB of prose took ${ms.toFixed(0)}ms`);
});

// ------------------------------------------------- the modes mean what they say
test('low-severity findings reach the panel under the extension policy', () => {
  // The options page offers "Stop for everything ... including emails and
  // phone numbers", and in warn mode promises low-severity findings are
  // "shown on paste". With `low` in neither the block nor the warn set, a
  // pasted email produced a finding, a verdict of 'clean', and silence.
  const extensionPolicy = { block: ['critical'], warn: ['high', 'medium', 'low'] };
  assert.match(content, /warn: \['high', 'medium', 'low'\]/,
    'the content script must widen the warn set for the extension');
  const r = scan('write to ravi.iyer@acmecorp.in', extensionPolicy);
  assert.equal(r.findings.length, 1);
  assert.equal(r.verdict, 'warn', 'a lone email must raise the panel');
});

test('warn mode still only interrupts the send for blocking findings', () => {
  const extensionPolicy = { block: ['critical'], warn: ['high', 'medium', 'low'] };
  assert.equal(scan('write to ravi.iyer@acmecorp.in', extensionPolicy).verdict, 'warn');
  assert.equal(scan('key AKIA' + 'IOSFODNN7' + 'EXAMPLE', extensionPolicy).verdict, 'block');
});
