/**
 * Kasauti — the CCPA-13 registry.
 *
 * India's Central Consumer Protection Authority notified the Guidelines for
 * Prevention and Regulation of Dark Patterns on 30 November 2023. They name
 * THIRTEEN specific practices and declare them unfair trade practices. On
 * 5 June 2025 the CCPA directed e-commerce platforms to self-audit against
 * these and file self-declarations.
 *
 * Twenty-six platforms filed. Independent review found dark patterns still
 * present on twenty-one of them.
 *
 * That gap is why this exists. There are public, legally-filed claims of
 * compliance and no reproducible, open instrument to check them. Surveys and
 * hand-done journalism are doing the work of a measuring tool.
 *
 * THE RULE THIS FILE ENFORCES
 * ---------------------------
 * Every pattern below declares its own DETECTABILITY. Four of the thirteen
 * genuinely cannot be established from a single page render — you cannot see
 * a cancellation flow, or what was delivered versus advertised, by looking at
 * a product page. Those are marked NOT_DETECTABLE and the report says so out
 * loud, with equal prominence to the findings.
 *
 * A tool that quietly reports 9 of 13 and lets the reader believe it checked
 * all 13 is worse than no tool: it converts a gap into a clean bill of health.
 * Existing dark-pattern extensions overwhelmingly do exactly that.
 *
 * Nothing here is legal advice. These are structured readings of the published
 * guidelines, recorded so a human reviewer can audit the machine's reasoning.
 */
(function (root) {
  'use strict';

  /** How well a single page render can establish this pattern. */
  var DETECTABILITY = {
    /** Directly measurable from the DOM with a deterministic rule. */
    MEASURABLE: 'MEASURABLE',
    /** Detectable, but by heuristic — text or layout signals that can misfire. */
    HEURISTIC: 'HEURISTIC',
    /** Needs more than one page state (a flow, a reload, or time). */
    REQUIRES_FLOW: 'REQUIRES_FLOW',
    /** Cannot be established from the client at all. Declared, never guessed. */
    NOT_DETECTABLE: 'NOT_DETECTABLE',
  };

  /** Strength of an individual finding. */
  var CONFIDENCE = {
    /** A measured fact. The rule cannot reasonably be disputed. */
    PROVEN: 'PROVEN',
    /** Strong signal with a measured component. */
    STRONG: 'STRONG',
    /** Text or layout signal consistent with the pattern; context may explain it. */
    INDICATIVE: 'INDICATIVE',
  };

  var PATTERNS = {
    FALSE_URGENCY: {
      id: 'FALSE_URGENCY',
      legalName: 'False urgency',
      clause: 'Annexure 1(1)',
      definition:
        'Falsely stating or implying a sense of urgency or scarcity so as to mislead a ' +
        'user into making an immediate purchase or taking an immediate action.',
      detectability: DETECTABILITY.HEURISTIC,
      /** What lifts this pattern from heuristic to proven. */
      proofAvailable:
        'A countdown that restarts at the same value on a fresh page load is fabricated ' +
        'urgency as a matter of fact, not interpretation. The CLI auditor performs this ' +
        'two-load comparison; a single in-page scan cannot.',
      whyItMatters:
        'Scarcity claims compress the decision window. A shopper who would have compared ' +
        'prices buys now instead.',
    },

    BASKET_SNEAKING: {
      id: 'BASKET_SNEAKING',
      legalName: 'Basket sneaking',
      clause: 'Annexure 1(2)',
      definition:
        'Inclusion of additional items such as products, services, payments to charity or ' +
        'donation at the time of checkout from a platform, without the consent of the user, ' +
        'such that the total amount payable is more than the amount payable for the ' +
        'product(s) and service(s) chosen by the user.',
      detectability: DETECTABILITY.MEASURABLE,
      proofAvailable:
        'A checkbox that carries a charge and arrives already ticked is directly readable ' +
        'from the DOM: the checked property is a fact, not an interpretation.',
      whyItMatters:
        'The default is the decision for most users. A pre-ticked charge is a purchase ' +
        'nobody made.',
    },

    CONFIRM_SHAMING: {
      id: 'CONFIRM_SHAMING',
      legalName: 'Confirm shaming',
      clause: 'Annexure 1(3)',
      definition:
        'Using a phrase, video, audio or any other means to create a sense of fear, shame, ' +
        'ridicule or guilt in the mind of the user, so as to nudge the user to act in a ' +
        'certain manner that results in the user purchasing a product or service.',
      detectability: DETECTABILITY.HEURISTIC,
      proofAvailable:
        'The decline control’s own text is quoted verbatim in the evidence, so a reviewer ' +
        'judges the wording directly rather than trusting a classifier.',
      whyItMatters:
        'It attaches a social cost to saying no, which is not a cost the product actually ' +
        'imposes.',
    },

    FORCED_ACTION: {
      id: 'FORCED_ACTION',
      legalName: 'Forced action',
      clause: 'Annexure 1(4)',
      definition:
        'Forcing a user into taking an action that would require the user to buy any ' +
        'additional good(s) or subscribe or sign up for an unrelated service, in order to ' +
        'buy or subscribe to the product or service originally intended.',
      detectability: DETECTABILITY.MEASURABLE,
      proofAvailable:
        'An overlay covering most of the viewport, with scroll locked and no reachable ' +
        'dismiss control, is a measurable geometric and style fact.',
      whyItMatters:
        'It converts a browse into a mandatory transaction, most often a mandatory ' +
        'disclosure of personal data.',
    },

    SUBSCRIPTION_TRAP: {
      id: 'SUBSCRIPTION_TRAP',
      legalName: 'Subscription trap',
      clause: 'Annexure 1(5)',
      definition:
        'Making cancellation of a paid subscription impossible or complex, hiding the ' +
        'cancellation option, requiring the user to share additional information to cancel, ' +
        'or auto-debiting a free trial without explicit consent.',
      detectability: DETECTABILITY.NOT_DETECTABLE,
      proofAvailable: null,
      undetectableBecause:
        'Establishing this requires holding a paid subscription and attempting to cancel it. ' +
        'No amount of reading a signup page can tell you how many steps the cancellation ' +
        'takes. This audit does NOT check it, and its absence from the findings must not be ' +
        'read as compliance.',
      whyItMatters:
        'It is the pattern with the clearest direct monetary harm, and the one an automated ' +
        'page scan is least able to see.',
    },

    INTERFACE_INTERFERENCE: {
      id: 'INTERFACE_INTERFERENCE',
      legalName: 'Interface interference',
      clause: 'Annexure 1(6)',
      definition:
        'An element of design that manipulates the user interface in ways that highlight ' +
        'certain specific information, and obscures other relevant information relative to ' +
        'the other information, to misdirect a user from taking an action as desired.',
      detectability: DETECTABILITY.MEASURABLE,
      proofAvailable:
        'Prominence is arithmetic: rendered area, WCAG contrast ratio and font size are all ' +
        'computed values. The asymmetry between an accept and a decline control is reported ' +
        'as a measured ratio, not as an impression.',
      whyItMatters:
        'This is the most quantifiable pattern in the list and the one most often waved away ' +
        'as a matter of taste. Numbers settle it.',
    },

    BAIT_AND_SWITCH: {
      id: 'BAIT_AND_SWITCH',
      legalName: 'Bait and switch',
      clause: 'Annexure 1(7)',
      definition:
        'The practice of advertising a particular outcome based on the user’s action, but ' +
        'deceptively serving an alternate outcome.',
      detectability: DETECTABILITY.NOT_DETECTABLE,
      proofAvailable: null,
      undetectableBecause:
        'This requires comparing what was advertised against what was actually delivered, ' +
        'which happens after a purchase and outside the browser. Not checked here.',
      whyItMatters:
        'Among the hardest to prove and the most damaging, which is precisely why it should ' +
        'not be silently omitted from a compliance report.',
    },

    DRIP_PRICING: {
      id: 'DRIP_PRICING',
      legalName: 'Drip pricing',
      clause: 'Annexure 1(8)',
      definition:
        'A practice whereby elements of prices are not revealed upfront or are revealed ' +
        'surreptitiously within the user experience, or the price is increased after ' +
        'confirmation, or a service is revealed to be unavailable after payment.',
      detectability: DETECTABILITY.REQUIRES_FLOW,
      proofAvailable:
        'Fully establishing this needs the listed price compared against the final payable ' +
        'amount across a checkout flow. A single page can only surface the disclaimers and ' +
        'fee lines that signal it, which this scan reports as indicative, not proven.',
      whyItMatters:
        'The single most-cited violation in Indian audits — convenience fees, platform fees ' +
        'and handling charges that appear only at the last step.',
    },

    DISGUISED_ADVERTISEMENT: {
      id: 'DISGUISED_ADVERTISEMENT',
      legalName: 'Disguised advertisement',
      clause: 'Annexure 1(9)',
      definition:
        'A practice of posing, masking or posturing advertisements as other types of content ' +
        'such as user generated content or new articles or false advertisements, to induce ' +
        'user interaction.',
      detectability: DETECTABILITY.MEASURABLE,
      proofAvailable:
        'Where a sponsorship label exists, its legibility relative to the content it labels ' +
        'is measurable: font size ratio and contrast ratio are both computed values.',
      whyItMatters:
        'A disclosure nobody can read is not a disclosure. Measuring legibility is how you ' +
        'tell a real label from a fig leaf.',
    },

    NAGGING: {
      id: 'NAGGING',
      legalName: 'Nagging',
      clause: 'Annexure 1(10)',
      definition:
        'Disruption of the normal browsing experience by repeated and persistent ' +
        'interactions, in the form of requests, information, options or interruptions, to ' +
        'make the user do something the platform wants.',
      detectability: DETECTABILITY.REQUIRES_FLOW,
      proofAvailable:
        'Nagging is defined by repetition, so it needs observation over time. The scan counts ' +
        'interruptions appearing during an observation window; a single instantaneous ' +
        'snapshot cannot establish repetition.',
      whyItMatters:
        'Each interruption is individually defensible. Only the count makes it a violation, ' +
        'which is exactly why it needs measuring rather than arguing.',
    },

    TRICK_QUESTION: {
      id: 'TRICK_QUESTION',
      legalName: 'Trick question',
      clause: 'Annexure 1(11)',
      definition:
        'The deliberate use of confusing or vague language such as confusing wording, double ' +
        'negatives or intentionally confusing or ambiguous phrases, in order to misguide or ' +
        'confuse a user.',
      detectability: DETECTABILITY.HEURISTIC,
      proofAvailable:
        'Negation density inside a consent label is countable. The label text is quoted in ' +
        'full so a reviewer can judge whether the count reflects real ambiguity.',
      whyItMatters:
        'Consent obtained through a sentence the user could not parse is not consent.',
    },

    SAAS_BILLING: {
      id: 'SAAS_BILLING',
      legalName: 'SaaS billing',
      clause: 'Annexure 1(12)',
      definition:
        'The process of generating and collecting payments from consumers on a recurring ' +
        'basis in a software as a service business model by exploiting positive acquisition ' +
        'and utilising dark patterns like silent recurring transactions.',
      detectability: DETECTABILITY.NOT_DETECTABLE,
      proofAvailable: null,
      undetectableBecause:
        'Requires visibility of actual recurring charges against the terms the user agreed ' +
        'to, which lives in billing records rather than in a page. Not checked here.',
      whyItMatters:
        'Silent recurring charges are invisible by design, and no page scan changes that.',
    },

    ROGUE_MALWARE: {
      id: 'ROGUE_MALWARE',
      legalName: 'Rogue malware',
      clause: 'Annexure 1(13)',
      definition:
        'Using a ransomware or scareware to mislead or trick a user into believing there is ' +
        'a malware on their device, or leads them to a specific web page to make them buy or ' +
        'pay for the fake removal of that malware.',
      detectability: DETECTABILITY.NOT_DETECTABLE,
      proofAvailable: null,
      undetectableBecause:
        'This is a malware-distribution offence rather than an interface-design one, and it ' +
        'belongs to security tooling. Deliberately out of scope so the scope boundary stays ' +
        'honest.',
      whyItMatters:
        'Listed here for completeness of the thirteen, so the report can never be mistaken ' +
        'for a full-spectrum check.',
    },
  };

  var ORDER = [
    'FALSE_URGENCY', 'BASKET_SNEAKING', 'CONFIRM_SHAMING', 'FORCED_ACTION',
    'SUBSCRIPTION_TRAP', 'INTERFACE_INTERFERENCE', 'BAIT_AND_SWITCH', 'DRIP_PRICING',
    'DISGUISED_ADVERTISEMENT', 'NAGGING', 'TRICK_QUESTION', 'SAAS_BILLING', 'ROGUE_MALWARE',
  ];

  root.Kasauti = root.Kasauti || {};
  root.Kasauti.DETECTABILITY = DETECTABILITY;
  root.Kasauti.CONFIDENCE = CONFIDENCE;
  root.Kasauti.PATTERNS = PATTERNS;
  root.Kasauti.ORDER = ORDER;
  root.Kasauti.CITATION =
    'Guidelines for Prevention and Regulation of Dark Patterns, 2023 — Central Consumer ' +
    'Protection Authority, Government of India (notified 30 November 2023).';
})(typeof globalThis !== 'undefined' ? globalThis : this);
