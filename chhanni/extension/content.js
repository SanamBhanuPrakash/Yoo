/**
 * Chhanni content script.
 *
 * Two interception points, because people get secrets into a prompt two ways:
 *   1. they paste them, and
 *   2. they type or drag them in and hit send.
 *
 * Everything runs locally. There is no fetch() to the network in this file, no
 * analytics, no background sync. That is not a privacy nicety, it is the
 * product: a tool that inspects your credentials has no business holding a
 * network handle.
 *
 * Three rules govern the code below, and all three were written after watching
 * the earlier version fail them:
 *
 *   1. Never fail open and quiet. If the engine cannot load, or a scan throws,
 *      the user is told. A guard that has stopped working while still looking
 *      installed is worse than no guard, because it is trusted.
 *   2. Decide before the event escapes. preventDefault() happens before any
 *      work that could fail, so an unexpected error cannot become a silent
 *      disclosure.
 *   3. The panel lives in a closed shadow root. It is the one surface the user
 *      has to trust, and it is rendered on a page that may not want it seen.
 */
(async () => {
  const DEFAULTS = { mode: 'warn', disabled: [], allow: [] };
  let policy = DEFAULTS;

  // ------------------------------------------------------------------ chrome
  const resource = (name) => chrome.runtime.getURL(name);

  let engine = null;
  let redactor = null;
  let loadError = null;
  try {
    engine = await import(resource('engine/detect.js'));
    redactor = await import(resource('engine/redact.js'));
  } catch (err) {
    // The engine is copied into extension/engine/ by scripts/build-extension.js.
    // When it is missing, Chrome still loads the extension, still shows it as
    // enabled, and reports no error anywhere in the UI — so this branch is the
    // only thing standing between the user and an extension that silently
    // guards nothing.
    loadError = err;
  }

  let panelCss = '';
  try {
    panelCss = (await import(resource('engine/panel.css.js'))).default;
  } catch { /* the panel falls back to its inline styles below */ }

  // ------------------------------------------------------------------ surface
  const FALLBACK_CSS = `
    .chhanni-panel{position:fixed;right:20px;bottom:20px;width:min(420px,calc(100vw - 40px));
      font:13px/1.5 ui-sans-serif,-apple-system,"Segoe UI",Roboto,sans-serif;color:#14181f;
      background:#fff;border:1px solid #e3e6ea;border-left:4px solid #d1495b;border-radius:10px;
      box-shadow:0 12px 32px rgba(10,15,25,.18);padding:14px 16px}
    .chhanni-actions{display:flex;gap:8px}
    .chhanni-actions button{font:inherit;font-weight:500;border-radius:7px;padding:7px 12px;cursor:pointer}`;

  let host = null;
  let root = null;
  let panel = null;
  let returnFocusTo = null;

  /**
   * A closed shadow root, hung off <html> rather than <body>.
   *
   * Both details are deliberate. Without the shadow boundary a single
   * `.chhanni-panel{display:none!important}` in the host page's stylesheet
   * hides the warning while the paste stays blocked — measured, and the result
   * is a user whose Ctrl+V appears to have broken with no explanation.
   * Hanging off <html> keeps `position:fixed` anchored to the viewport even
   * when the page puts a transform or filter on <body>.
   *
   * This narrows the attack surface; it does not eliminate it. A page that
   * really wants to interfere with an overlay drawn inside it has other
   * options, and that is inherent to doing this from a content script.
   */
  function surface() {
    if (root) return root;
    host = document.createElement('div');
    host.style.cssText = 'all:initial';
    root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = panelCss || FALLBACK_CSS;
    root.appendChild(style);
    document.documentElement.appendChild(host);
    return root;
  }

  const closePanel = () => {
    panel?.remove();
    panel = null;
    // Give the keyboard back. Without this, focus is left on <body> and the
    // next keystroke goes nowhere.
    try { returnFocusTo?.focus?.(); } catch {}
    returnFocusTo = null;
  };

  function openPanel(verdict) {
    surface();
    panel?.remove();
    panel = document.createElement('div');
    panel.className = `chhanni-panel chhanni-${verdict}`;
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-live', 'assertive');
    panel.setAttribute('aria-labelledby', 'chhanni-title');
    return panel;
  }

  /** Keeps Tab inside the panel while it is up, as role=alertdialog promises. */
  function trapFocus() {
    panel.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const stops = [...panel.querySelectorAll('button')];
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const here = root.activeElement;
      if (e.shiftKey && here === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && here === last) { e.preventDefault(); first.focus(); }
    });
  }

  function showPanel({ findings, verdict, onRedact, onProceed, title }) {
    openPanel(verdict);

    const head = document.createElement('div');
    head.className = 'chhanni-head';
    const dot = document.createElement('span');
    dot.className = 'chhanni-dot';
    const strong = document.createElement('strong');
    strong.id = 'chhanni-title';
    // textContent, not innerHTML. The title is assembled from detector labels
    // today, which are ours — but this is the one place where page-derived text
    // could ever reach the DOM, and the cost of being careful is one line.
    strong.textContent = title;
    head.append(dot, strong);
    panel.appendChild(head);

    const list = document.createElement('ul');
    list.className = 'chhanni-list';
    for (const f of findings.slice(0, 8)) {
      const li = document.createElement('li');
      li.className = `chhanni-sev-${f.severity}`;
      const label = document.createElement('span');
      label.className = 'chhanni-label';
      label.textContent = f.label;
      const val = document.createElement('code');
      val.textContent = f.preview;
      li.append(label, val);
      if (f.note) {
        const note = document.createElement('em');
        note.textContent = f.note;
        li.appendChild(note);
      }
      list.appendChild(li);
    }
    if (findings.length > 8) {
      const more = document.createElement('li');
      more.className = 'chhanni-more';
      more.textContent = `and ${findings.length - 8} more`;
      list.appendChild(more);
    }
    panel.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'chhanni-actions';

    const redactBtn = document.createElement('button');
    redactBtn.className = 'chhanni-primary';
    redactBtn.textContent = `Redact ${findings.length} and continue`;
    redactBtn.onclick = () => { const back = returnFocusTo; closePanel(); returnFocusTo = back; onRedact(); };

    const proceedBtn = document.createElement('button');
    proceedBtn.className = 'chhanni-ghost';
    proceedBtn.textContent = 'Send as-is';
    proceedBtn.onclick = () => { const back = returnFocusTo; closePanel(); returnFocusTo = back; onProceed(); };

    actions.append(redactBtn, proceedBtn);
    panel.appendChild(actions);

    const foot = document.createElement('div');
    foot.className = 'chhanni-foot';
    // Precise about who did not send what. Chhanni made no request; the prompt
    // itself is still on its way to whichever AI provider this page belongs to,
    // and saying "nothing was sent anywhere" would be a lie about that.
    foot.textContent = 'Checked on this device. Chhanni made no network request.';
    panel.appendChild(foot);

    surface().appendChild(panel);
    trapFocus();
    redactBtn.focus();
  }

  /**
   * Shown when the scanner could not run. The paste or the send has already
   * been stopped by the time this appears: an inspection that failed is not
   * evidence that the content is safe, so the default is to hold it and let
   * the user decide with the facts in front of them.
   */
  function showFailurePanel({ reason, onProceed, proceedLabel = 'Insert it anyway' }) {
    openPanel('block');
    const head = document.createElement('div');
    head.className = 'chhanni-head';
    const dot = document.createElement('span');
    dot.className = 'chhanni-dot';
    const strong = document.createElement('strong');
    strong.id = 'chhanni-title';
    strong.textContent = 'Chhanni could not check this';
    head.append(dot, strong);
    panel.appendChild(head);

    const why = document.createElement('div');
    why.className = 'chhanni-foot';
    why.style.marginTop = '0';
    why.style.marginBottom = '12px';
    why.textContent = reason;
    panel.appendChild(why);

    const actions = document.createElement('div');
    actions.className = 'chhanni-actions';
    let focusTarget;
    if (onProceed) {
      const proceedBtn = document.createElement('button');
      proceedBtn.className = 'chhanni-primary';
      proceedBtn.textContent = proceedLabel;
      proceedBtn.onclick = () => { const back = returnFocusTo; closePanel(); returnFocusTo = back; onProceed(); };
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'chhanni-ghost';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = closePanel;
      actions.append(proceedBtn, cancelBtn);
      focusTarget = cancelBtn;
    } else {
      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'chhanni-primary';
      dismissBtn.textContent = 'Dismiss';
      dismissBtn.onclick = closePanel;
      actions.appendChild(dismissBtn);
      focusTarget = dismissBtn;
    }
    panel.appendChild(actions);

    surface().appendChild(panel);
    trapFocus();
    focusTarget.focus();
  }

  // If the engine never loaded there is nothing to intercept with, and the
  // honest thing is to say so once rather than sit there looking installed.
  if (loadError) {
    // One banner per page, not one per frame: all_frames puts a copy of this
    // script in every iframe, and twelve identical alarms is not twelve times
    // the warning.
    let top = false;
    try { top = window.top === window; } catch { top = false; }
    if (!top) return;
    const banner = () => showFailurePanel({
      reason: 'The detection engine did not load, so nothing on this page is being '
            + 'checked. Reinstall or reload the extension — and if you are running '
            + 'it unpacked, run `node scripts/build-extension.js` first. Details: '
            + (loadError.message || String(loadError)),
    });
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', banner, { once: true });
    } else {
      banner();
    }
    return;
  }

  const { scan, summarise } = engine;
  const { redact } = redactor;

  // ------------------------------------------------------------------ policy
  const apply = (stored) => { policy = { ...DEFAULTS, ...(stored || {}) }; };
  try {
    const stored = await chrome.storage.sync.get('policy');
    apply(stored.policy);
  } catch { /* first run, or storage unavailable; defaults are fine */ }
  chrome.storage.onChanged?.addListener((c) => {
    if (c.policy?.newValue) apply(c.policy.newValue);
  });

  /**
   * The options page offers three modes and they have to mean what they say.
   *
   * The engine's library default treats `low` severity as informational, which
   * is right for a CLI that prints every finding regardless of verdict. In the
   * extension the verdict is the only thing that decides whether the user ever
   * sees the panel, so leaving `low` out of both sets meant a pasted email
   * address produced a finding, a verdict of 'clean', and silence — including
   * in the mode whose label reads "Stop for everything". Putting `low` in the
   * warn set is what makes the labels true: the panel appears on paste for
   * anything at all, and the Enter key is only interrupted by `block` in warn
   * mode or by anything in strict mode.
   */
  const scanPolicy = () => ({
    ...policy,
    block: ['critical'],
    warn: ['high', 'medium', 'low'],
  });

  /** Returns a result, or an error — never throws, and never returns nothing. */
  function inspect(text) {
    try { return { ok: true, result: scan(text, scanPolicy()) }; }
    catch (err) { return { ok: false, err }; }
  }

  // ---------------------------------------------------------------- composer
  const isEditable = (el) =>
    !!el && (el.tagName === 'TEXTAREA' || el.isContentEditable === true);

  /**
   * composedPath()[0], not target.
   *
   * Several of these composers live inside a web component. For an event that
   * crosses a shadow boundary the browser retargets `e.target` to the shadow
   * host, which is a <div> and not editable — so the old `e.target` check
   * returned early and the paste went straight through. Measured: an AWS key
   * pasted into a composer inside an open shadow root reached the textarea
   * untouched.
   */
  const eventTarget = (e) => {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : null;
    return (path && path.length ? path[0] : null) || e.target;
  };

  const readComposer = (el) =>
    el.tagName === 'TEXTAREA' ? el.value : el.innerText;

  /**
   * Writing back is the fiddly part. These composers are React- or
   * ProseMirror-controlled, so assigning .value or .innerText silently
   * desyncs the framework's own state and the next keystroke restores the
   * secret. The native setter plus a bubbling input event is what React
   * listens for; execCommand is what ProseMirror listens for.
   */
  function writeComposer(el, value) {
    if (el.tagName === 'TEXTAREA') {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value',
      ).set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('insertText', false, value);
  }

  // ------------------------------------------------------------ interception
  document.addEventListener('paste', (e) => {
    const el = eventTarget(e);
    if (!isEditable(el) || policy.mode === 'off') return;
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;

    const insert = (value) => {
      if (el.tagName === 'TEXTAREA') {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? start;
        writeComposer(el, el.value.slice(0, start) + value + el.value.slice(end));
      } else {
        el.focus();
        document.execCommand('insertText', false, value);
      }
    };

    const verdictOf = inspect(text);

    if (!verdictOf.ok) {
      e.preventDefault();
      e.stopPropagation();
      returnFocusTo = el;
      showFailurePanel({
        reason: 'The scanner hit an unexpected error on this text, so Chhanni '
              + 'cannot say whether it contains credentials. Error: '
              + (verdictOf.err?.message || String(verdictOf.err)),
        onProceed: () => insert(text),
      });
      return;
    }

    const result = verdictOf.result;
    if (result.verdict === 'clean') return;

    e.preventDefault();
    e.stopPropagation();
    returnFocusTo = el;

    showPanel({
      findings: result.findings,
      verdict: result.verdict,
      title: `${summarise(result.findings)} in what you pasted`,
      onRedact: () => insert(redact(text, result.findings).text),
      onProceed: () => insert(text),
    });
  }, true);

  /** True for the keystroke that actually submits in these composers. */
  const isSubmitKey = (e) =>
    e.key === 'Enter' && !e.shiftKey && !e.isComposing && !e.altKey;

  let bypassUntil = 0;
  const bypassing = () => Date.now() < bypassUntil;

  document.addEventListener('keydown', (e) => {
    if (!isSubmitKey(e)) return;
    if (policy.mode === 'off' || bypassing()) return;
    const el = eventTarget(e);
    if (!isEditable(el)) return;

    const text = readComposer(el);
    if (!text) return;

    const resend = () => {
      bypassUntil = Date.now() + 2000;
      el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
      }));
    };

    const verdictOf = inspect(text);

    if (!verdictOf.ok) {
      e.preventDefault();
      e.stopImmediatePropagation();
      returnFocusTo = el;
      showFailurePanel({
        reason: 'The scanner hit an unexpected error on this prompt, so Chhanni '
              + 'cannot say whether it contains credentials. Error: '
              + (verdictOf.err?.message || String(verdictOf.err)),
        onProceed: resend,
      });
      return;
    }

    const result = verdictOf.result;
    if (result.verdict === 'clean') return;
    // Warn mode only stops the send for things that can actually be abused.
    // Low-severity findings still raise the panel on paste; see scanPolicy().
    if (policy.mode === 'warn' && result.verdict !== 'block') return;

    e.preventDefault();
    e.stopImmediatePropagation();
    returnFocusTo = el;

    showPanel({
      findings: result.findings,
      verdict: result.verdict,
      title: `${summarise(result.findings)} about to be sent`,
      onRedact: () => { writeComposer(el, redact(text, result.findings).text); },
      onProceed: resend,
    });
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel) { e.stopPropagation(); closePanel(); }
  }, true);
})();
