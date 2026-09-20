/**
 * License registry — licensing as executable policy, not a README table.
 *
 * WHY THIS EXISTS
 * ---------------
 * God's Eye View ships a 57,000-word DATA_SOURCES.md that carefully records,
 * per feed, what the licence permits. It is genuinely excellent work. It is
 * also *prose*, which means it is advisory: nothing in the running system
 * stops you shipping an OpenSky-backed commercial product tomorrow. The gap
 * between "documented" and "enforced" is where every open-data compliance
 * incident is born.
 *
 * Here the licence is a first-class property of the adapter, and the engine
 * mechanically refuses to emit a commercial attestation that depends on a
 * source whose licence forbids commercial use. The refusal is not a warning
 * banner; the evidence bundle simply cannot be produced.
 *
 * That inversion is the point. Compliance you cannot forget to do.
 *
 * NOT LEGAL ADVICE. These are structured summaries of publicly stated terms,
 * current as of the `verifiedOn` date, recorded so that a human reviewer can
 * audit the machine's reasoning. Terms change; re-verify before relying.
 *
 * @module license/registry
 */

/** What a downstream use may do with values derived from a source. */
export const USE = Object.freeze({
  /** Personal, research, evaluation. No revenue attached. */
  NONCOMMERCIAL: 'NONCOMMERCIAL',
  /** Internal use by a commercial entity, outputs not sold or published. */
  INTERNAL_COMMERCIAL: 'INTERNAL_COMMERCIAL',
  /** Outputs sold, licensed, or used to settle money with a third party. */
  COMMERCIAL_REDISTRIBUTION: 'COMMERCIAL_REDISTRIBUTION',
});

export const USE_RANK = Object.freeze({
  NONCOMMERCIAL: 1,
  INTERNAL_COMMERCIAL: 2,
  COMMERCIAL_REDISTRIBUTION: 3,
});

/** Obligations that attach to a permitted use. */
export const OBLIGATION = Object.freeze({
  ATTRIBUTION: 'ATTRIBUTION',
  /** ODbL: derived databases must be offered under the same terms. */
  SHARE_ALIKE_DATABASE: 'SHARE_ALIKE_DATABASE',
  /** Provider asks for a citation but does not require it. */
  CITATION_REQUESTED: 'CITATION_REQUESTED',
  /** Terms forbid bulk re-publication of the raw feed. */
  NO_BULK_REDISTRIBUTION: 'NO_BULK_REDISTRIBUTION',
  /** Provider requires a separate written agreement above a usage threshold. */
  WRITTEN_PERMISSION_REQUIRED: 'WRITTEN_PERMISSION_REQUIRED',
  /** Rate limit is part of the terms, not just an engineering concern. */
  RATE_LIMITED: 'RATE_LIMITED',
});

/**
 * @typedef {object} LicenseFact
 * @property {string} sourceId
 * @property {string} license            short identifier
 * @property {string} licenseUrl
 * @property {string} maxUse             highest USE the licence permits
 * @property {string[]} obligations
 * @property {string} attribution        the exact string that must be displayed
 * @property {string} verifiedOn         ISO date this summary was checked
 * @property {string} note               the human-readable caveat
 */

/** @type {Record<string, LicenseFact>} */
export const LICENSE_REGISTRY = Object.freeze({
  'usgs-earthquakes': {
    sourceId: 'usgs-earthquakes',
    license: 'US-PUBLIC-DOMAIN',
    licenseUrl: 'https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits',
    maxUse: USE.COMMERCIAL_REDISTRIBUTION,
    obligations: [OBLIGATION.CITATION_REQUESTED],
    attribution: 'Data courtesy of the U.S. Geological Survey',
    verifiedOn: '2026-09-20',
    note: 'Work of the US federal government; no copyright attaches. The cleanest source in the registry.',
  },

  'open-meteo': {
    sourceId: 'open-meteo',
    license: 'CC-BY-4.0',
    licenseUrl: 'https://open-meteo.com/en/license',
    maxUse: USE.COMMERCIAL_REDISTRIBUTION,
    obligations: [OBLIGATION.ATTRIBUTION, OBLIGATION.RATE_LIMITED],
    attribution: 'Weather data by Open-Meteo.com (CC BY 4.0)',
    verifiedOn: '2026-09-20',
    note: 'Attribution must appear adjacent to the displayed data. Free tier is daily-quota limited; a commercial deployment needs the paid tier.',
  },

  'open-meteo-archive': {
    sourceId: 'open-meteo-archive',
    license: 'CC-BY-4.0',
    licenseUrl: 'https://open-meteo.com/en/license',
    maxUse: USE.COMMERCIAL_REDISTRIBUTION,
    obligations: [OBLIGATION.ATTRIBUTION, OBLIGATION.RATE_LIMITED],
    attribution: 'Historical weather: Open-Meteo.com reanalysis (CC BY 4.0), derived from ERA5 (Copernicus/ECMWF)',
    verifiedOn: '2026-09-20',
    note: 'Reanalysis, NOT station observation. Values are MODELED by construction — see sources/openMeteoArchive.js.',
  },

  gdelt: {
    sourceId: 'gdelt',
    license: 'GDELT-TOU',
    licenseUrl: 'https://www.gdeltproject.org/about.html#termsofuse',
    maxUse: USE.COMMERCIAL_REDISTRIBUTION,
    obligations: [OBLIGATION.ATTRIBUTION, OBLIGATION.CITATION_REQUESTED],
    attribution: 'The GDELT Project',
    verifiedOn: '2026-09-20',
    note: 'Dataset use is unrestricted for academic, commercial and governmental purposes with citation. Individual linked articles remain under their publishers’ terms — Sakshya stores only URL, domain, timestamp and title, never article bodies.',
  },

  nominatim: {
    sourceId: 'nominatim',
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    maxUse: USE.COMMERCIAL_REDISTRIBUTION,
    obligations: [
      OBLIGATION.ATTRIBUTION,
      OBLIGATION.SHARE_ALIKE_DATABASE,
      OBLIGATION.RATE_LIMITED,
      OBLIGATION.NO_BULK_REDISTRIBUTION,
    ],
    attribution: '© OpenStreetMap contributors (ODbL)',
    verifiedOn: '2026-09-20',
    note: 'Max 1 request/second, identifying User-Agent required, results must be cached. Share-alike attaches to derived DATABASES, not to a single resolved place name used as context.',
  },

  /* ---------------------------------------------------------------------- *
   * Deliberately present and deliberately blocked.
   *
   * OpenSky is the backbone of most hobby flight-tracking projects, including
   * God's Eye View's primary flight layer. Its terms are non-commercial. It
   * is registered here so the gate has something real to refuse, and so that
   * anyone reading this file learns the constraint before they build a
   * business on it rather than after.
   * ---------------------------------------------------------------------- */
  opensky: {
    sourceId: 'opensky',
    license: 'OPENSKY-NONCOMMERCIAL',
    licenseUrl: 'https://opensky-network.org/about/terms-of-use',
    maxUse: USE.NONCOMMERCIAL,
    obligations: [OBLIGATION.ATTRIBUTION, OBLIGATION.WRITTEN_PERMISSION_REQUIRED, OBLIGATION.RATE_LIMITED],
    attribution: 'Schäfer et al., "Bringing Up OpenSky", IPSN 2014 — opensky-network.org',
    verifiedOn: '2026-09-20',
    note: 'Research/education licence. Operational or commercial use requires written permission. THIS IS THE TRAP: an MIT-licensed repository does not relicense the feeds it calls.',
  },

  'telegeography-cables': {
    sourceId: 'telegeography-cables',
    license: 'CC-BY-NC-SA-3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    maxUse: USE.NONCOMMERCIAL,
    obligations: [OBLIGATION.ATTRIBUTION, OBLIGATION.SHARE_ALIKE_DATABASE],
    attribution: 'Submarine cable data © TeleGeography (CC BY-NC-SA 3.0)',
    verifiedOn: '2026-09-20',
    note: 'NonCommercial. Bundled in God’s Eye View with an explicit warning to remove it for commercial use — registered here so the gate enforces what that warning only asks.',
  },

  'google-map-tiles': {
    sourceId: 'google-map-tiles',
    license: 'GOOGLE-MAPS-PLATFORM-TOS',
    licenseUrl: 'https://cloud.google.com/maps-platform/terms',
    maxUse: USE.INTERNAL_COMMERCIAL,
    obligations: [OBLIGATION.ATTRIBUTION, OBLIGATION.NO_BULK_REDISTRIBUTION, OBLIGATION.WRITTEN_PERMISSION_REQUIRED],
    attribution: 'Google',
    verifiedOn: '2026-09-20',
    note: 'Proprietary, metered, your own key. Caching and extraction are restricted; deriving geodata from the imagery (e.g. running detection over 3D tiles) is outside the permitted visualisation use. Registered as INTERNAL_COMMERCIAL because redistributing derived output is not a decision this registry can make for you.',
  },
});

/** @param {string} sourceId @returns {LicenseFact} */
export function licenseFor(sourceId) {
  const fact = LICENSE_REGISTRY[sourceId];
  if (!fact) {
    // Unknown provenance is treated as maximally restrictive. Fails closed.
    return Object.freeze({
      sourceId,
      license: 'UNKNOWN',
      licenseUrl: '',
      maxUse: USE.NONCOMMERCIAL,
      obligations: [OBLIGATION.WRITTEN_PERMISSION_REQUIRED],
      attribution: `${sourceId} (licence unverified)`,
      verifiedOn: null,
      note: 'No verified licence record. Treated as non-commercial by default: the registry fails closed.',
    });
  }
  return fact;
}
