import { RULES } from './engine/rules.js';

const DEFAULTS = { mode: 'warn', disabled: [], allow: [] };
const $ = (s) => document.querySelector(s);
const saved = $('#saved');

const stored = await chrome.storage.sync.get('policy');
const policy = { ...DEFAULTS, ...(stored.policy || {}) };

for (const input of document.querySelectorAll('input[name=mode]')) {
  input.checked = input.value === policy.mode;
  input.onchange = () => save({ mode: input.value });
}

const container = $('#rules');
const ordered = [...RULES].sort((a, b) => a.label.localeCompare(b.label));
for (const rule of ordered) {
  const label = document.createElement('label');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = !policy.disabled.includes(rule.id);
  box.onchange = () => {
    const set = new Set(policy.disabled);
    box.checked ? set.delete(rule.id) : set.add(rule.id);
    save({ disabled: [...set] });
  };
  const text = document.createElement('span');
  text.textContent = rule.label + ' ';
  const sev = document.createElement('span');
  sev.className = 'sev';
  sev.textContent = rule.severity;
  text.appendChild(sev);
  label.append(box, text);
  container.appendChild(label);
}

const allow = $('#allow');
allow.value = policy.allow.join('\n');
allow.onchange = () =>
  save({ allow: allow.value.split('\n').map((s) => s.trim()).filter(Boolean) });

async function save(patch) {
  Object.assign(policy, patch);
  await chrome.storage.sync.set({ policy });
  saved.textContent = 'Saved';
  setTimeout(() => { saved.textContent = ''; }, 1400);
}
