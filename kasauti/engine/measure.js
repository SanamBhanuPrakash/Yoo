/**
 * Kasauti — measurement primitives.
 *
 * The difference between this tool and the existing dark-pattern extensions is
 * concentrated in this file. They ask a language model whether a page "feels
 * manipulative". This computes numbers a reviewer can re-derive and a platform's
 * lawyer cannot argue with:
 *
 *   contrast ratio   WCAG 2.2 relative luminance, the same formula every
 *                    accessibility audit already uses
 *   prominence       rendered area in CSS pixels
 *   legibility       computed font size in pixels
 *
 * "Your accept button is 8.4x the area of your decline link and sits at 9.1:1
 * contrast against the decline link's 1.9:1" is a finding. "This looks pushy"
 * is an opinion. Only one of them survives a compliance meeting.
 */
(function (root) {
  'use strict';

  var K = root.Kasauti = root.Kasauti || {};

  /** Parse any CSS colour the browser hands back into [r,g,b,a]. */
  function parseColor(css) {
    if (!css) return null;
    var m = css.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/i);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    // Modern colour syntaxes are not parsed rather than guessed at.
    return null;
  }

  /** WCAG 2.2 relative luminance. */
  function luminance(rgb) {
    var c = rgb.slice(0, 3).map(function (v) {
      var s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  /**
   * WCAG contrast ratio, 1..21. Returns null rather than a guess when either
   * colour cannot be resolved — an unresolvable colour must not silently
   * become a passing or failing score.
   */
  function contrastRatio(fgCss, bgCss) {
    var fg = parseColor(fgCss);
    var bg = parseColor(bgCss);
    if (!fg || !bg) return null;
    // A translucent foreground is composited over the background before compare.
    if (fg[3] < 1) {
      fg = [0, 1, 2].map(function (i) { return fg[i] * fg[3] + bg[i] * (1 - fg[3]); });
    }
    var l1 = luminance(fg);
    var l2 = luminance(bg);
    var hi = Math.max(l1, l2);
    var lo = Math.min(l1, l2);
    return round2((hi + 0.05) / (lo + 0.05));
  }

  /**
   * Walk up the tree for the first non-transparent background. A button whose
   * own background is `transparent` is painted by its ancestor, and comparing
   * text against `rgba(0,0,0,0)` would produce a meaningless ratio.
   */
  function effectiveBackground(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var bg = root.getComputedStyle(node).backgroundColor;
      var parsed = parseColor(bg);
      if (parsed && parsed[3] > 0.05) return bg;
      node = node.parentElement;
    }
    return 'rgb(255, 255, 255)';
  }

  /** Is the element actually painted and reachable by a user? */
  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    var cs = root.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /** Rendered area in CSS pixels. The honest measure of prominence. */
  function area(el) {
    var r = el.getBoundingClientRect();
    return Math.round(r.width * r.height);
  }

  /** Everything needed to justify a prominence finding, in one object. */
  function profile(el) {
    if (!el) return null;
    var cs = root.getComputedStyle(el);
    var bg = effectiveBackground(el);
    return {
      text: textOf(el),
      tag: el.tagName.toLowerCase(),
      area: area(el),
      fontSizePx: round2(parseFloat(cs.fontSize) || 0),
      fontWeight: cs.fontWeight,
      color: cs.color,
      background: bg,
      contrastRatio: contrastRatio(cs.color, bg),
      visible: isVisible(el),
      selector: cssPath(el),
    };
  }

  /** Trimmed, collapsed visible text. Capped so evidence stays readable. */
  function textOf(el, max) {
    if (!el) return '';
    var t = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    max = max || 160;
    return t.length > max ? t.slice(0, max) + '…' : t;
  }

  /**
   * A short, stable selector for the evidence record. Prefers an id, then a
   * nth-of-type path, so a reviewer can find the exact element again.
   */
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + cssEscape(el.id);
    var parts = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 6) {
      var name = node.tagName.toLowerCase();
      var parent = node.parentElement;
      if (parent) {
        var sameTag = Array.prototype.filter.call(parent.children, function (c) {
          return c.tagName === node.tagName;
        });
        if (sameTag.length > 1) name += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')';
      }
      parts.unshift(name);
      if (node.id) { parts[0] = '#' + cssEscape(node.id); break; }
      node = parent;
      depth += 1;
    }
    return parts.join(' > ');
  }

  function cssEscape(s) {
    return String(s).replace(/([^a-zA-Z0-9_-])/g, '\\$1');
  }

  /** The accessible label for a control: aria-label, <label>, or own text. */
  function labelFor(el) {
    if (!el) return '';
    var aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria) return aria.replace(/\s+/g, ' ').trim();
    var labelledby = el.getAttribute && el.getAttribute('aria-labelledby');
    if (labelledby) {
      var ref = root.document.getElementById(labelledby);
      if (ref) return textOf(ref);
    }
    if (el.id) {
      var lab = root.document.querySelector('label[for="' + cssEscape(el.id) + '"]');
      if (lab) return textOf(lab);
    }
    var wrapper = el.closest && el.closest('label');
    if (wrapper) return textOf(wrapper);
    var own = textOf(el);
    if (own) return own;
    var parent = el.parentElement;
    return parent ? textOf(parent) : '';
  }

  /** Does the element sit inside something that looks like cart or checkout? */
  function inContext(el, words) {
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 8) {
      var hay = ((node.id || '') + ' ' + (node.className || '') + ' ' +
        (node.getAttribute('data-testid') || '')).toLowerCase();
      for (var i = 0; i < words.length; i += 1) {
        if (hay.indexOf(words[i]) !== -1) return words[i];
      }
      node = node.parentElement;
      depth += 1;
    }
    return null;
  }

  /** Fraction of the viewport an element covers, 0..1. */
  function viewportCoverage(el) {
    var r = el.getBoundingClientRect();
    var vw = root.innerWidth || 1;
    var vh = root.innerHeight || 1;
    var w = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    var h = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    return round3((w * h) / (vw * vh));
  }

  function round2(n) { return Math.round(n * 100) / 100; }
  function round3(n) { return Math.round(n * 1000) / 1000; }

  K.measure = {
    parseColor: parseColor,
    luminance: luminance,
    contrastRatio: contrastRatio,
    effectiveBackground: effectiveBackground,
    isVisible: isVisible,
    area: area,
    profile: profile,
    textOf: textOf,
    cssPath: cssPath,
    labelFor: labelFor,
    inContext: inContext,
    viewportCoverage: viewportCoverage,
    round2: round2,
    round3: round3,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
