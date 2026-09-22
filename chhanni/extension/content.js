/**
 * Chhanni content script.
 *
 * Two interception points, because people get secrets into a prompt two ways:
 *   1. they paste them, and
 *   2. they type or drag them in and hit send.
 *
 * Everything runs locally. There is no fetch() in this file, no analytics,
 * no background sync. That is not a privacy nicety, it is the product: a tool
 * that inspects your credentials has no business holding a network handle.
 */
(async () => {
  const engine = await import(chrome.runtime.getURL('engine/detect.js'));
  const redactor = await import(chrome.runtime.getURL('engine/redact.js'));
  const { scan, summarise } = engine;
  const { redact } = redactor;

  const DEFAULTS = { mode: 'warn', disabled: [], allow: [] };
  let policy = DEFAULTS;
  try {
    const stored = await chrome.storage.sync.get('policy');
    if (stored.policy) policy = { ...DEFAULTS, ...stored.policy };
  } catch { /* first run, or storage unavailable; defaults are fine */ }
  chrome.storage.onChanged?.addListener((c) => {
    if (c.policy?.newValue) policy = { ...DEFAULTS, ...c.policy.newValue };
  });

  // ------------------------------------------------------------ composer
  const COMPOSER = [
    '#prompt-textarea',                      // ChatGPT
    'div[contenteditable="true"].ProseMirror',
    'textarea[placeholder]',
    'div[contenteditable="true"][role="textbox"]',
    'rich-textarea div[contenteditable="true"]', // Gemini
    'textarea',
  ].join(',');

  const isEditable = (el) =>
    el && (el.tagName === 'TEXTAREA' || el.isContentEditable);

  function activeComposer() {
    const el = document.activeElement;
    if (isEditable(el)) return el;
    return document.querySelector(COMPOSER);
  }

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

  // --------------------------------------------------------------- panel
  let panel = null;
  const closePanel = () => { panel?.remove(); panel = null; };

  function showPanel({ findings, verdict, onRedact, onProceed, title }) {
    closePanel();
    panel = document.createElement('div');
    panel.className = `chhanni-panel chhanni-${verdict}`;
    panel.setAttribute('role', 'alertdialog');
    panel.setAttribute('aria-live', 'assertive');

    const head = document.createElement('div');
    head.className = 'chhanni-head';
    head.innerHTML = `<span class="chhanni-dot"></span><strong>${title}</strong>`;
    panel.appendChild(head);

    const list = document.createElement('ul');
    list.className = 'chhanni-list';
    for (const f of findings.slice(0, 8)) {
      const li = document.createElement('li');
      li.className = `chhanni-sev-${f.severity}`;
      // textContent throughout: findings contain attacker-influenced text.
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
    redactBtn.onclick = () => { closePanel(); onRedact(); };

    const proceedBtn = document.createElement('button');
    proceedBtn.className = 'chhanni-ghost';
    proceedBtn.textContent = 'Send as-is';
    proceedBtn.onclick = () => { closePanel(); onProceed(); };

    actions.append(redactBtn, proceedBtn);
    panel.appendChild(actions);

    const foot = document.createElement('div');
    foot.className = 'chhanni-foot';
    foot.textContent = 'Checked on this device. Nothing was sent anywhere.';
    panel.appendChild(foot);

    document.body.appendChild(panel);
    redactBtn.focus();
  }

  // ---------------------------------------------------------- interception
  document.addEventListener('paste', (e) => {
    const el = e.target;
    if (!isEditable(el)) return;
    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;

    const result = scan(text, policy);
    if (result.verdict === 'clean') return;
    if (policy.mode === 'off') return;

    e.preventDefault();
    e.stopPropagation();

    const insert = (value) => {
      if (el.tagName === 'TEXTAREA') {
        const start = el.selectionStart ?? el.value.length;
        const end = el.selectionEnd ?? start;
        writeComposer(el, el.value.slice(0, start) + value + el.value.slice(end));
      } else {
        document.execCommand('insertText', false, value);
      }
    };

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
    const el = e.target;
    if (!isEditable(el)) return;

    const text = readComposer(el);
    const result = scan(text, policy);
    if (result.verdict === 'clean') return;
    // Warn mode only stops on things that can actually be abused.
    if (policy.mode === 'warn' && result.verdict !== 'block') return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const resend = () => {
      bypassUntil = Date.now() + 2000;
      el.focus();
      el.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
      }));
    };

    showPanel({
      findings: result.findings,
      verdict: result.verdict,
      title: `${summarise(result.findings)} about to be sent`,
      onRedact: () => { writeComposer(el, redact(text, result.findings).text); },
      onProceed: resend,
    });
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel) closePanel();
  });
})();
