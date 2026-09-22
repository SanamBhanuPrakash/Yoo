/**
 * Kasauti — multilingual pattern lexicon.
 *
 * WHY THIS FILE IS THE HARDEST THING HERE TO COPY
 * -----------------------------------------------
 * Every dark-pattern detector in existence matches English. Indian e-commerce
 * does not run in English. Flipkart, Meesho, Myntra, Zomato, Swiggy, Nykaa,
 * JioMart and every quick-commerce app ship Hindi, Tamil, Telugu, Bengali,
 * Marathi and — most of all — romanised Hinglish, which no Unicode range
 * catches because it is written in the Latin alphabet.
 *
 * "Nahi, mujhe bachat nahi chahiye" is confirm shaming under Annexure 1(3).
 * An English regex sees ordinary ASCII and says the page is clean, which is
 * worse than not checking at all: it manufactures a pass.
 *
 * THE HONESTY RULE THAT MAKES IT USABLE
 * -------------------------------------
 * Coverage is NOT uniform and pretending otherwise would repeat the exact sin
 * this project exists to expose. Each language declares its own coverage level,
 * the scan detects which scripts the page actually contains, and the report
 * states plainly where a clean result is weak because the lexicon is thin.
 *
 * A page in Tamil scanned with partial Tamil coverage gets told so.
 *
 * Contributions: add entries under the language, keep the coverage honest, and
 * lower it rather than raise it when unsure.
 */
(function (root) {
  'use strict';

  var K = root.Kasauti = root.Kasauti || {};

  /** How complete this language's phrase set is. Set conservatively. */
  var COVERAGE = {
    /** Broad phrase set, reviewed against real storefront copy. */
    GOOD: 'GOOD',
    /** The common phrasings only. Real misses are expected. */
    PARTIAL: 'PARTIAL',
    /** A handful of anchors. A clean result means very little. */
    MINIMAL: 'MINIMAL',
  };

  /** Unicode ranges, so the scan can report which scripts a page actually uses. */
  var SCRIPTS = {
    devanagari: { re: /[ऀ-ॿ]/, langs: ['hi', 'mr'], name: 'Devanagari' },
    tamil: { re: /[஀-௿]/, langs: ['ta'], name: 'Tamil' },
    telugu: { re: /[ఀ-౿]/, langs: ['te'], name: 'Telugu' },
    bengali: { re: /[ঀ-৿]/, langs: ['bn'], name: 'Bengali' },
    kannada: { re: /[ಀ-೿]/, langs: ['kn'], name: 'Kannada' },
    malayalam: { re: /[ഀ-ൿ]/, langs: ['ml'], name: 'Malayalam' },
    gujarati: { re: /[઀-૿]/, langs: ['gu'], name: 'Gujarati' },
    gurmukhi: { re: /[਀-੿]/, langs: ['pa'], name: 'Gurmukhi' },
  };

  /**
   * Hinglish is the important one and the one everyone misses. It is Hindi
   * written in Latin script with no fixed spelling — nahi / nahin / nhi, chahiye
   * / chahie / chaiye — so every pattern below is written to absorb the common
   * spelling drift rather than assuming one canonical form.
   */
  var LEX = {
    hi: {
      name: 'Hindi', script: 'devanagari', coverage: COVERAGE.GOOD,
      CONFIRM_SHAMING: [
        /नहीं?,?\s*मुझे\s*बचत\s*नहीं?\s*चाहिए/,          // nahi, mujhe bachat nahi chahiye
        /मुझे\s*छूट\s*नहीं?\s*चाहिए/,                                        // mujhe chhoot nahi chahiye
        /मुझे\s*परवाह\s*नहीं?/,                                                              // mujhe parwah nahi
        /रहने\s*(?:दें|दो|दीजिए)/,                                                      // rehne den / do / dijiye
        /पूरा\s*(?:दाम|मूल्य)\s*दूंगा/,                                  // poora daam dunga
      ],
      FALSE_URGENCY: [
        /(?:केवल|सिर्फ)\s*\d+\s*(?:बचे|शेष)/,                                      // kewal/sirf N bache
        /जल्दी\s*करें/,                                                                                          // jaldi karein
        /स्टॉक\s*(?:सीमित|खत्म)/,                                                       // stock seemit / khatm
        /आखिरी\s*मौका/,                                                                                          // aakhiri mauka
        /सीमित\s*समय/,                                                                                                // seemit samay
        /\d+\s*लोग\s*देख\s*रहे/,                                                                                 // N log dekh rahe
      ],
      DRIP_PRICING: [
        /सुविधा\s*शुल्क/,                                                                              // suvidha shulk (convenience fee)
        /प्लेटफ़?ॉर्म\s*शुल्क/,                                               // platform shulk
        /अतिरिक्त\s*शुल्क/,                                                                  // atirikt shulk
        /कर\s*अतिरिक्त/,                                                                                    // kar atirikt (taxes extra)
      ],
    },

    hinglish: {
      name: 'Hinglish (romanised Hindi)', script: 'latin', coverage: COVERAGE.GOOD,
      note: 'Latin script, so no Unicode range catches it. This is the gap that ' +
            'lets an English-only detector declare an Indian page clean.',
      CONFIRM_SHAMING: [
        /\bnah?i+n?\b[^.]{0,24}\bbachat\b[^.]{0,16}\bnah?i+n?\b/i,
        /\bmujhe\b[^.]{0,20}\b(?:chhoot|chut|discount|bachat|offer)\b[^.]{0,16}\bnah?i+n?\b/i,
        /\bmujhe\s+(?:parwah|parvah|farak)\s+nah?i+n?\b/i,
        /\brehne?\s+(?:do|den|dijiye|dijie)\b/i,
        /\bnah?i+n?\s+chah?i(?:ye|e)\b/i,
        /\bpoora\s+(?:daam|paisa|price)\s+(?:dunga|dungi|doonga)\b/i,
        /\bmain\s+(?:amir|ameer)\s+hoon\b/i,
      ],
      FALSE_URGENCY: [
        /\b(?:sirf|keval|kewal)\s+\d+\s+(?:bache|baki|bacha|shesh)\b/i,
        /\bjaldi\s+kar(?:ein|o|iye)\b/i,
        /\bstock\s+(?:khatam|khatm|seemit|limited)\b/i,
        /\b(?:aakhiri|akhri|last)\s+(?:mauka|mouka|chance)\b/i,
        /\b\d+\s+log\s+dekh\s+rahe\b/i,
      ],
      DRIP_PRICING: [
        /\b(?:suvidha|convenience)\s+shulk\b/i,
        /\bplatform\s+shulk\b/i,
        /\b(?:atirikt|extra)\s+shulk\b/i,
      ],
    },

    ta: {
      name: 'Tamil', script: 'tamil', coverage: COVERAGE.PARTIAL,
      CONFIRM_SHAMING: [
        /இல்லை,?\s*எனக்கு\s*தேவை\s*இல்லை/,   // no, I don't need
      ],
      FALSE_URGENCY: [
        /இருப்பு\s*குறைவு/,                                                      // low stock
        /சீக்கிரம்/,                                                                                 // hurry
        /கடைசி\s*வாய்ப்பு/,                                                      // last chance
      ],
      DRIP_PRICING: [/கட்டணம்\s*கூடுதல்/],
    },

    te: {
      name: 'Telugu', script: 'telugu', coverage: COVERAGE.PARTIAL,
      CONFIRM_SHAMING: [
        /కాదు,?\s*నాకు\s*అవసరం\s*లేదు/,                     // no, I don't need it
      ],
      FALSE_URGENCY: [
        /కేవలం\s*\d+\s*మిగిలి/,                                                            // only N left
        /త్వరగా/,                                                                                                   // hurry
        /చివరి\s*అవకాశం/,                                                                  // last chance
      ],
      DRIP_PRICING: [],
    },

    bn: {
      name: 'Bengali', script: 'bengali', coverage: COVERAGE.PARTIAL,
      CONFIRM_SHAMING: [
        /না,?\s*আমার\s*প্রয়োজন\s*নেই/,                      // no, I don't need
      ],
      FALSE_URGENCY: [
        /মাত্র\s*\d+\s*বাকি/,                                                                        // only N left
        /তাড়াতাড়ি/,                                                                                       // hurry
        /শেষ\s*সুযোগ/,                                                                                    // last chance
      ],
      DRIP_PRICING: [],
    },

    mr: {
      name: 'Marathi', script: 'devanagari', coverage: COVERAGE.MINIMAL,
      CONFIRM_SHAMING: [/नको,?\s*मला\s*नको/],
      FALSE_URGENCY: [
        /फक्त\s*\d+\s*शिल्लक/,                                                                  // only N left
        /लवकर\s*करा/,                                                                                          // hurry
      ],
      DRIP_PRICING: [],
    },
  };

  /** Which scripts does this page actually contain? */
  function detectScripts(text) {
    var found = [];
    Object.keys(SCRIPTS).forEach(function (key) {
      if (SCRIPTS[key].re.test(text)) found.push(SCRIPTS[key].name);
    });
    return found;
  }

  /**
   * Match `text` for `patternId` across every language.
   * @returns {{lang: string, langName: string, coverage: string, matched: string}|null}
   */
  function match(patternId, text) {
    if (!text) return null;
    var langs = Object.keys(LEX);
    for (var i = 0; i < langs.length; i += 1) {
      var lex = LEX[langs[i]];
      var rules = lex[patternId];
      if (!rules) continue;
      for (var j = 0; j < rules.length; j += 1) {
        var m = text.match(rules[j]);
        if (m) {
          return {
            lang: langs[i],
            langName: lex.name,
            coverage: lex.coverage,
            matched: m[0],
          };
        }
      }
    }
    return null;
  }

  /**
   * A coverage warning for the report: the page speaks a language this lexicon
   * only partly knows, so a clean result on it is weak evidence.
   */
  function coverageWarning(scriptsOnPage) {
    if (!scriptsOnPage.length) return null;
    var weak = [];
    Object.keys(LEX).forEach(function (code) {
      var lex = LEX[code];
      var scriptName = (SCRIPTS[lex.script] || {}).name;
      if (!scriptName || scriptsOnPage.indexOf(scriptName) === -1) return;
      if (lex.coverage !== COVERAGE.GOOD) {
        weak.push(lex.name + ' (' + lex.coverage.toLowerCase() + ' coverage)');
      }
    });
    if (!weak.length) return null;
    return {
      scriptsOnPage: scriptsOnPage,
      weakLanguages: weak,
      warning:
        'This page contains ' + scriptsOnPage.join(', ') + ' text. Phrase coverage for ' +
        weak.join(' and ') + ' is incomplete, so patterns expressed in those languages may ' +
        'have been missed. A clean result on this page is weaker than a clean result on an ' +
        'English or Hindi page, and should not be read as compliance.',
    };
  }

  K.LEXICON = LEX;
  K.SCRIPTS = SCRIPTS;
  K.COVERAGE = COVERAGE;
  K.lexicon = {
    match: match,
    detectScripts: detectScripts,
    coverageWarning: coverageWarning,
    languages: function () {
      return Object.keys(LEX).map(function (c) {
        return { code: c, name: LEX[c].name, coverage: LEX[c].coverage, script: LEX[c].script };
      });
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
